-- 🍻 วงแตก — Supabase schema (รันทั้งไฟล์ใน SQL Editor)
-- ก่อนใช้: Authentication > Providers > เปิด "Allow anonymous sign-ins"
-- ฝั่งเว็บเรียก supabase.auth.signInAnonymously() ครั้งแรก แล้ว auth.uid() คือตัวตนผู้เล่น

create extension if not exists pgcrypto;

-- ───────── TABLES ─────────
create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_id uuid not null,                       -- auth.uid() ของ host
  status text not null default 'waiting' check (status in ('waiting','playing','finished','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 hours'
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  user_id uuid not null,                       -- auth.uid()
  nickname text not null check (char_length(nickname) between 1 and 20),
  is_host boolean not null default false,
  is_connected boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (room_id, user_id)
);

create table questions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  category text not null check (category in ('funny','friend','love','party','random')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table custom_questions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);

create table game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  game_type text not null default 'most-likely',
  round int not null default 1,
  question_id uuid references questions(id),
  question_text text not null,
  status text not null default 'voting' check (status in ('voting','finished')),
  started_at timestamptz not null default now(),
  ends_at timestamptz not null,
  ended_at timestamptz
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  game_session_id uuid not null references game_sessions(id) on delete cascade,
  voter_id uuid not null references players(id) on delete cascade,
  target_player_id uuid not null references players(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (game_session_id, voter_id),          -- กัน vote ซ้ำ
  check (voter_id <> target_player_id)         -- กัน vote ตัวเอง
);

create index on players (room_id);
create index on game_sessions (room_id, started_at desc);
create index on votes (game_session_id);

-- ───────── RLS: อ่านได้เฉพาะสมาชิกห้อง, เขียนผ่าน RPC เท่านั้น ─────────
create or replace function is_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where room_id = p_room and user_id = auth.uid());
$$;

alter table rooms enable row level security;
alter table players enable row level security;
alter table questions enable row level security;
alter table custom_questions enable row level security;
alter table game_sessions enable row level security;
alter table votes enable row level security;

create policy rooms_read on rooms for select to authenticated using (is_member(id));
create policy players_read on players for select to authenticated using (is_member(room_id));
create policy cq_read on custom_questions for select to authenticated using (is_member(room_id));
create policy sessions_read on game_sessions for select to authenticated using (is_member(room_id));
create policy questions_read on questions for select to authenticated using (is_active);
-- เห็นโหวตของตัวเองเสมอ; โหวตของคนอื่นเห็นหลังรอบจบ (กันเลือกตามกัน)
create policy votes_read on votes for select to authenticated using (
  exists (select 1 from players p where p.id = votes.voter_id and p.user_id = auth.uid())
  or exists (select 1 from game_sessions s where s.id = votes.game_session_id
             and s.status = 'finished' and is_member(s.room_id))
);
-- ไม่มี policy insert/update/delete = ปิดหมด ต้องผ่านฟังก์ชันด้านล่าง

-- ───────── RPC ─────────
create or replace function clean_text(t text) returns text
language sql immutable as $$ select btrim(regexp_replace(coalesce(t,''), '[<>&"''`\x00-\x1f]', '', 'g')) $$;

create or replace function create_room(p_nickname text) returns text
language plpgsql security definer set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- ไม่มี I O 0 1
  v_code text; v_room uuid; v_nick text := clean_text(p_nickname);
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if char_length(v_nick) not between 1 and 20 then raise exception 'INVALID_NICKNAME'; end if;
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(alphabet, 1 + floor(random()*32)::int, 1);
    end loop;
    begin
      insert into rooms (code, host_id) values (v_code, auth.uid()) returning id into v_room;
      exit;
    exception when unique_violation then null;  -- สุ่มใหม่
    end;
  end loop;
  insert into players (room_id, user_id, nickname, is_host) values (v_room, auth.uid(), v_nick, true);
  return v_code;
end $$;

create or replace function join_room(p_code text, p_nickname text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r rooms; v_nick text := clean_text(p_nickname); v_player uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into r from rooms where code = upper(btrim(p_code));
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if r.status = 'closed' or r.expires_at < now() then raise exception 'ROOM_EXPIRED'; end if;
  -- reconnect: เคยอยู่ในห้องนี้แล้วให้กลับเข้าที่เดิม
  update players set is_connected = true, last_seen = now()
    where room_id = r.id and user_id = auth.uid() returning id into v_player;
  if v_player is not null then return v_player; end if;
  if char_length(v_nick) not between 1 and 20 then raise exception 'INVALID_NICKNAME'; end if;
  if r.status = 'playing' then raise exception 'ROOM_IN_GAME'; end if;
  if (select count(*) from players where room_id = r.id) >= 12 then raise exception 'ROOM_FULL'; end if;
  insert into players (room_id, user_id, nickname) values (r.id, auth.uid(), v_nick) returning id into v_player;
  update rooms set expires_at = now() + interval '3 hours', updated_at = now() where id = r.id;
  return v_player;
end $$;

create or replace function start_round(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare r rooms; q_id uuid; q_text text; v_round int; v_session uuid;
begin
  select * into r from rooms where code = upper(p_code);
  if not found or r.host_id <> auth.uid() then raise exception 'NOT_HOST'; end if;
  if r.status = 'closed' or r.expires_at < now() then raise exception 'ROOM_EXPIRED'; end if;
  if (select count(*) from players where room_id = r.id) < 2 then raise exception 'NEED_MORE_PLAYERS'; end if;
  -- สุ่มจากคำถามระบบ + คำถามของห้อง โดยเลี่ยงคำถามที่เล่นไปแล้ว
  select id, text into q_id, q_text from (
    select id, text from questions where is_active
    union all
    select null::uuid, text from custom_questions where room_id = r.id
  ) pool
  where text not in (select question_text from game_sessions where room_id = r.id)
  order by random() limit 1;
  if q_text is null then  -- ใช้หมดแล้ว เริ่มวนใหม่
    select id, text into q_id, q_text from questions where is_active order by random() limit 1;
  end if;
  select coalesce(max(round),0)+1 into v_round from game_sessions where room_id = r.id;
  insert into game_sessions (room_id, question_id, question_text, round, ends_at)
    values (r.id, q_id, q_text, v_round, now() + interval '15 seconds') returning id into v_session;
  update rooms set status = 'playing', updated_at = now(), expires_at = now() + interval '3 hours' where id = r.id;
  return v_session;
end $$;

create or replace function cast_vote(p_session uuid, p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s game_sessions; me uuid;
begin
  select * into s from game_sessions where id = p_session;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;
  select id into me from players where room_id = s.room_id and user_id = auth.uid();
  if me is null then raise exception 'NOT_MEMBER'; end if;
  if s.status <> 'voting' or now() >= s.ends_at then raise exception 'VOTING_CLOSED'; end if;
  if me = p_target then raise exception 'CANNOT_VOTE_SELF'; end if;
  if not exists (select 1 from players where id = p_target and room_id = s.room_id) then
    raise exception 'INVALID_TARGET';
  end if;
  begin
    insert into votes (game_session_id, voter_id, target_player_id) values (p_session, me, p_target);
  exception when unique_violation then raise exception 'ALREADY_VOTED';
  end;
end $$;

-- ปิดรอบ: เรียกได้เมื่อหมดเวลา หรือทุกคน (ยกเว้นที่ออกไป) โหวตครบ
create or replace function finish_round(p_session uuid) returns void
language plpgsql security definer set search_path = public as $$
declare s game_sessions; total int; voted int;
begin
  select * into s from game_sessions where id = p_session for update;
  if not found or not is_member(s.room_id) then raise exception 'NOT_MEMBER'; end if;
  if s.status = 'finished' then return; end if;
  select count(*) into total from players where room_id = s.room_id and is_connected;
  select count(*) into voted from votes where game_session_id = s.id;
  if now() < s.ends_at and voted < total then raise exception 'ROUND_NOT_OVER'; end if;
  update game_sessions set status = 'finished', ended_at = now() where id = s.id;
end $$;

create or replace function back_to_lobby(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set status = 'waiting', updated_at = now()
   where code = upper(p_code) and host_id = auth.uid() and status <> 'closed';
  if not found then raise exception 'NOT_HOST'; end if;
end $$;

create or replace function add_custom_question(p_code text, p_text text) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms; v_text text := clean_text(p_text);
begin
  select * into r from rooms where code = upper(p_code);
  if not found or r.host_id <> auth.uid() then raise exception 'NOT_HOST'; end if;
  if char_length(v_text) not between 1 and 200 then raise exception 'INVALID_QUESTION'; end if;
  insert into custom_questions (room_id, text) values (r.id, v_text);
end $$;

create or replace function kick_player(p_code text, p_player uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  select * into r from rooms where code = upper(p_code);
  if not found or r.host_id <> auth.uid() then raise exception 'NOT_HOST'; end if;
  delete from players where id = p_player and room_id = r.id and not is_host;
end $$;

create or replace function leave_room(p_code text) returns void
language sql security definer set search_path = public as $$
  update players set is_connected = false, last_seen = now()
  where user_id = auth.uid() and room_id = (select id from rooms where code = upper(p_code));
$$;

create or replace function close_room(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set status = 'closed', updated_at = now() where code = upper(p_code) and host_id = auth.uid();
  if not found then raise exception 'NOT_HOST'; end if;
end $$;

-- ล้างห้องหมดอายุ: ไม่ต้องใช้ cron — เรียกแบบสุ่มตอนสร้างห้องจากฝั่งเว็บ หรือจะเรียกเองก็ได้
create or replace function purge_expired_rooms() returns void
language sql security definer set search_path = public as $$
  delete from rooms where expires_at < now() - interval '1 day' or (status = 'closed' and updated_at < now() - interval '1 hour');
$$;

revoke all on all functions in schema public from public, anon;
grant execute on function create_room, join_room, start_round, cast_vote, finish_round, back_to_lobby,
  add_custom_question, kick_player, leave_room, close_room, purge_expired_rooms, is_member to authenticated;

-- ───────── REALTIME (respect RLS) ─────────
alter publication supabase_realtime add table rooms, players, game_sessions, votes, custom_questions;

-- ───────── SEED (ตัวอย่าง 24 ข้อ — ต้องเพิ่มให้ครบ 50) ─────────
insert into questions (text, category) values
('ใครมีโอกาสมาสายมากที่สุด?','funny'),
('ใครมีโอกาสรวยก่อนเพื่อน?','friend'),
('ใครมีโอกาสส่งข้อความผิดคนมากที่สุด?','funny'),
('ใครมีโอกาสนอนก่อนเพื่อนในวงมากที่สุด?','party'),
('ใครมีโอกาสหายออกจากวงก่อน?','friend'),
('ใครมีโอกาสเป็น influencer?','random'),
('ใครมีโอกาสแต่งงานก่อนเพื่อน?','love'),
('ใครมีโอกาสซื้อของโดยไม่ดูราคา?','funny'),
('ใครมีโอกาสลืมว่าตัวเองพูดอะไรเมื่อคืน?','party'),
('ใครมีโอกาสหัวเราะดังที่สุด?','funny'),
('ใครมีโอกาสทักหาคนเก่าตอนดึกมากที่สุด?','love'),
('ใครมีโอกาสตกหลุมรักเร็วที่สุด?','love'),
('ใครมีโอกาสเป็นคนแรกที่บอกว่า "กลับบ้านกัน"?','party'),
('ใครมีโอกาสหลงทางทั้งที่เปิดแผนที่อยู่?','funny'),
('ใครมีโอกาสถ่ายรูปอาหารก่อนกินนานที่สุด?','friend'),
('ใครมีโอกาสผิดนัดมากที่สุด?','friend'),
('ใครมีโอกาสร้องไห้ตอนดูหนังมากที่สุด?','friend'),
('ใครมีโอกาสพูดว่า "แป๊บเดียว" แล้วนานที่สุด?','funny'),
('ใครมีโอกาสได้เป็นเจ้าของธุรกิจก่อนเพื่อน?','random'),
('ใครมีโอกาสเล่นมือถือตอนเพื่อนคุยอยู่มากที่สุด?','friend'),
('ใครมีโอกาสเป็นคนจองร้านผิดวันที่สุด?','funny'),
('ใครมีโอกาสไปเที่ยวต่างประเทศคนเดียวได้?','random'),
('ใครมีโอกาสเป็นตัวตึงของวงตอนเล่นเกม?','party'),
('ใครมีโอกาสทำของหายบ่อยที่สุด?','random');
