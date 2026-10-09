'use client'
import {useCallback,useEffect,useState} from 'react'
import {useParams,useRouter} from 'next/navigation'
import {QRCodeSVG} from 'qrcode.react'
import {supabase,ensureAuth} from '@/lib/supabase'
type P={id:string;user_id:string;nickname:string;is_host:boolean;is_connected:boolean}
type S={id:string;question_text:string;round:number;status:string;ends_at:string;game_type:string;subject_id:string|null;ended_at:string|null;ok_count:number;buzz_count:number}
type Deck={pos:number;face:string;suit:string;drawn_by:string|null}
type Card={idx:number;target:string;forbidden:string[];result:string|null}
type V={voter_id:string;target_player_id:string|null;choice:string|null}
type R={id:string;status:string;host_id:string}
type Sec={player_id:string;word:string;is_odd:boolean}
const COL=['bg-purple-500','bg-pink-500','bg-orange-500','bg-cyan-500','bg-emerald-500','bg-yellow-500']
const GAMES=[['cards','🃏','ไพ่ปาร์ตี้ 52 ใบ'],['taboo','🙊','ใบ้คำห้ามพูด'],['roulette','🎰','รูเล็ตต์ลงโทษ'],['quiz-th','🧩','Quiz (ไทย)'],['quiz-en','🌍','Quiz (English)'],['odd','🕵️','ตัวปลอม'],['sync','🧠','คิดตรงกัน'],['most-likely','😂','ใครมีโอกาสมากที่สุด'],['never','🙋','ใครเคย…'],['either','⚖️','เลือกข้าง'],['truth','🤥','จริงหรือมั่ว'],['quick','⏱️','5 วิ ตอบให้ทัน'],['mission','🎡','สุ่มภารกิจ']]
const CARD_RULES:Record<string,[string,string]>={
  A:['A • ทุกคนชูมือ','ทุกคนชูมือขึ้นพร้อมกัน คนที่ชูช้าที่สุดโดนลงโทษ'],
  '2':['2 • ชี้เลย','คนเปิดไพ่เลือกชี้เพื่อน 1 คนให้โดนลงโทษ'],
  '3':['3 • ตัวคุณเอง','คนเปิดไพ่โดนลงโทษเอง'],
  '4':['4 • แตะพื้น','ทุกคนแตะพื้น คนสุดท้ายที่แตะโดนลงโทษ'],
  '5':['5 • คนเด็กสุด','คนที่อายุน้อยที่สุดในวงโดนลงโทษ'],
  '6':['6 • เพื่อนซ้ายมือ','เพื่อนที่นั่งทางซ้ายของคนเปิดไพ่โดนลงโทษ'],
  '7':['7 • ชี้ฟ้า','ทุกคนชี้นิ้วขึ้นฟ้า คนสุดท้ายโดนลงโทษ'],
  '8':['8 • คู่หู','เลือกคู่หู 1 คน เวลาคุณโดนลงโทษ คู่หูโดนด้วย จนกว่าจะหมดสำรับ'],
  '9':['9 • คำคล้องจอง','คนเปิดไพ่พูดคำหนึ่งคำ ผลัดกันพูดคำคล้องจอง คนที่ติดหรือซ้ำโดนลงโทษ'],
  '10':['10 • หมวดหมู่','คนเปิดไพ่ตั้งหมวด (เช่น ผลไม้) ผลัดกันพูดคนละคำ คนที่ติดหรือซ้ำโดนลงโทษ'],
  J:['J • ตั้งกฎใหม่','คนเปิดไพ่ตั้งกฎใหม่ 1 ข้อ ใช้จนหมดสำรับ ใครทำผิดโดนลงโทษ'],
  Q:['Q • ราชินีคำถาม','คนเปิดไพ่ถามคำถามเพื่อนได้ ใครตอบเป็นประโยคบอกเล่าแทนที่จะถามกลับโดนลงโทษ'],
  K:['K • ราชาสั่งการ','คนเปิดไพ่สั่งภารกิจสั้น ๆ ให้เพื่อน 1 คนทำ']}
const HINT:Record<string,string>={either:'พิมพ์สองตัวเลือก คั่นด้วย | เช่น กินเผ็ด|กินหวาน',sync:'พิมพ์คำถามตามด้วย 4 ตัวเลือก คั่นด้วย | เช่น ไปเที่ยวไหน|ทะเล|ภูเขา|ต่างประเทศ|อยู่บ้าน',never:'พิมพ์ต่อจาก "ใครเคย" เช่น แอบดูโทรศัพท์คนอื่น',truth:'พิมพ์เรื่องที่ให้ผู้เล่นบอก เช่น เคยหลับในโรงหนัง',quick:'พิมพ์โจทย์ เช่น บอกชื่อสัตว์ 3 ชนิด',mission:'พิมพ์ภารกิจ เช่น เต้นท่าอะไรก็ได้ 10 วินาที','most-likely':'พิมพ์ในรูป ใครมีโอกาส…?'}
const DESC:Record<string,string>={
  cards:'สำรับไพ่จริง 52 ใบ ผลัดกันกดเปิดไพ่ทีละใบ แต่ละใบมีกติกาสนุก ๆ ให้ทำทั้งวง ไพ่ที่เปิดแล้วไม่กลับเข้ามาสุ่มอีกจนกว่า Host จะเริ่มสำรับใหม่ (ลงโทษจะดื่มน้ำหรือทำภารกิจเล็ก ๆ ตกลงกันในวง)',
  taboo:'สุ่มคนหนึ่งมาใบ้คำที่เห็นบนจอให้เพื่อนทายภายใน 60 วินาที โดยห้ามพูดคำต้องห้ามที่ขึ้นใต้คำนั้น! เพื่อนช่วยกันทายด้วยปาก ถ้าคนใบ้หลุดพูดคำห้าม เพื่อนกดปุ่ม 🚨 ได้ คะแนน = ทายถูก − โดนบัซเซอร์',
  roulette:'ทุกคนกดปุ่มบนจอตัวเองพร้อมกัน แล้วระบบจะสุ่มคัดออกทีละคนจนเหลือคนสุดท้าย คนนั้นต้องโดนบทลงโทษ! ใครไม่กดทัน 15 วินาที = โดนเลย',
  'quiz-th':'ตอบคำถามความรู้ทั่วไปภาษาไทย 4 ตัวเลือก ใครตอบถูกบ้างเฉลยพร้อมกัน (25 วินาที)',
  'quiz-en':'คำถามความรู้ภาษาอังกฤษจาก Open Trivia DB ที่อัปเดตเรื่อย ๆ 4 ตัวเลือก (25 วินาที)',
  odd:'ทุกคนได้คำลับบนมือถือ ทุกคนได้คำเดียวกันยกเว้น 1 คนที่ได้คำคล้ายกัน ผลัดกันอธิบายคำโดยไม่บอกตรง ๆ แล้วโหวตหาตัวปลอม (ต้อง 3 คนขึ้นไป • 90 วินาที)',
  sync:'มีคำถาม 4 ตัวเลือก ให้เลือกข้อที่คิดว่าเพื่อนส่วนใหญ่จะเลือก ใครตรงกับคนส่วนใหญ่ได้ 👑 (20 วินาที)',
  'most-likely':'ระบบถามว่า "ใครมีโอกาส…มากที่สุด" ทุกคนโหวตเพื่อนที่เข้ากับคำถามที่สุด โหวตตัวเองไม่ได้ (15 วินาที)',
  never:'ระบบบอกเรื่องหนึ่ง ทุกคนตอบพร้อมกันว่า เคย หรือ ไม่เคย แล้วดูว่าวงเป็นยังไง (15 วินาที)',
  either:'เลือกข้าง A หรือ B ที่ยากจะตัดสินใจ เฉลยแล้วดูว่าใครอยู่ฝั่งไหน เถียงกันได้เต็มที่ (15 วินาที)',
  truth:'สุ่มคนหนึ่งมาเล่าเรื่องของตัวเอง เพื่อนโหวตว่า จริง หรือ มั่ว แล้วคนเล่าเฉลย (20 วินาที)',
  quick:'สุ่มคนหนึ่งมาตอบโจทย์ให้ครบภายใน 5 วินาที เพื่อน ๆ ช่วยกันตัดสินว่าทำทันไหม',
  mission:'ทุกคนเห็นภารกิจพร้อมกัน ทำให้เสร็จก่อนหมดเวลา 30 วินาที ไม่มีการโหวต'}
function Bar({label,n,total,note}:{label:string;n:number;total:number;note?:string}){return(
  <div><div className="flex justify-between"><span>{label}</span><b>{n}</b></div>
  <div className="h-3 rounded bg-white/10"><div className="h-3 rounded bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{width:`${total?n/total*100:0}%`}}/></div>
  {note&&<div className="text-xs text-white/50 mt-1">{note}</div>}</div>)}
export default function Room(){
  const code=String(useParams().code).toUpperCase();const router=useRouter()
  const [uid,setUid]=useState('');const [room,setRoom]=useState<R|null>(null);const [ps,setPs]=useState<P[]>([])
  const [s,setS]=useState<S|null>(null);const [vs,setVs]=useState<V[]>([]);const [sec,setSec]=useState<Sec[]>([]);const [ans,setAns]=useState<number|null>(null)
  const [now,setNow]=useState(Date.now());const [qr,setQr]=useState(false);const [off,setOff]=useState(false);const [err,setErr]=useState('')
  const [game,setGame]=useState('cards');const [skew,setSkew]=useState(0);const [cards,setCards]=useState<Card[]>([]);const [deck,setDeck]=useState<Deck[]>([])
  const load=useCallback(async()=>{
    const id=await ensureAuth();setUid(id)
    const {data:r}=await supabase.from('rooms').select('id,status,host_id').eq('code',code).maybeSingle()
    if(!r){router.replace(`/join?room=${code}`);return}
    setRoom(r)
    const [p,g]=await Promise.all([supabase.from('players').select('*').eq('room_id',r.id).order('joined_at'),
      supabase.from('game_sessions').select('*').eq('room_id',r.id).order('started_at',{ascending:false}).limit(1).maybeSingle()])
    setPs((p.data||[]).filter((x:P)=>x.is_connected));setS(g.data)
    if(g.data){
      const v=await supabase.from('votes').select('voter_id,target_player_id,choice').eq('game_session_id',g.data.id);setVs(v.data||[])
      if(g.data.game_type==='odd'||g.data.game_type==='roulette'){const k=await supabase.from('game_secrets').select('player_id,word,is_odd').eq('session_id',g.data.id);setSec(k.data||[])}else setSec([])
      if(g.data.game_type==='quiz'){const a=await supabase.from('game_answers').select('correct').eq('session_id',g.data.id).maybeSingle();setAns(a.data?a.data.correct:null)}else setAns(null)
    if(g.data.game_type==='taboo'){const c=await supabase.from('taboo_cards').select('idx,target,forbidden,result').eq('session_id',g.data.id).order('idx');setCards(c.data||[])}else setCards([])
      if(g.data.game_type==='cards'){const d=await supabase.from('card_deck').select('pos,face,suit,drawn_by').eq('session_id',g.data.id).not('drawn_at','is',null).order('pos');setDeck(d.data||[])}else setDeck([])
    }else{setVs([]);setSec([]);setAns(null);setCards([]);setDeck([])}
  },[code,router])
  useEffect(()=>{load()
    const t0=Date.now()
    ensureAuth().then(()=>supabase.rpc('server_now')).then(({data})=>{if(data)setSkew(new Date(data).getTime()-(t0+Date.now())/2)})
    const ch=supabase.channel(`room-${code}`)
    for(const table of ['players','rooms','game_sessions','votes'])ch.on('postgres_changes',{event:'*',schema:'public',table},load)
    ch.subscribe(st=>setOff(st==='CLOSED'||st==='CHANNEL_ERROR'))
    const t=setInterval(()=>setNow(Date.now()),250)
    return()=>{supabase.removeChannel(ch);clearInterval(t)}},[code,load])
  const me=ps.find(p=>p.user_id===uid);const host=room?.host_id===uid
  const gt=s?.game_type
  const left=s?Math.max(0,Math.ceil((new Date(s.ends_at).getTime()-(now+skew))/1000)):0
  const myVote=vs.find(v=>v.voter_id===me?.id)
  useEffect(()=>{if(s?.status==='voting'&&s.game_type!=='roulette'&&(left===0
    ||(['most-likely','never','either','odd','sync','quiz'].includes(s.game_type)&&ps.length>1&&vs.length>=ps.length)
    ||(s.game_type==='truth'&&ps.length>1&&vs.length>=ps.length-1)))
    supabase.rpc('finish_round',{p_session:s.id}).then(load)},[left,vs.length,ps.length,s,load])
  useEffect(()=>{if(gt!=='roulette'||!s||s.status!=='voting')return
    const id=s.id;const t=setInterval(()=>{supabase.rpc('finish_roulette',{p_session:id}).then(r=>{if(!r.error)load()})},1500)
    return()=>clearInterval(t)},[gt,s,load])
  useEffect(()=>{if(gt!=='taboo'||!s||s.status!=='voting'||left>0)return
    const id=s.id;const t=setInterval(()=>{supabase.rpc('finish_round',{p_session:id}).then(r=>{if(!r.error)load()})},1500)
    return()=>clearInterval(t)},[gt,s,left,load])
  async function call(fn:string,args:object){const {error}=await supabase.rpc(fn,args);setErr(error?error.message:'');load()}
  const go=(g:string)=>g==='cards'?call('start_cards',{p_code:code}):g==='taboo'?call('start_taboo',{p_code:code}):g==='roulette'?call('start_roulette',{p_code:code}):g.startsWith('quiz')?call('start_quiz',{p_code:code,p_lang:g.includes('-')?g.split('-')[1]:null}):call('start_game',{p_code:code,p_game:g})
  if(!room)return <main className="p-10 text-center text-xl">กำลังโหลด…</main>
  if(room.status==='closed')return <main className="p-10 text-center space-y-4"><div className="text-6xl">⌛</div><p>ห้องนี้ปิดแล้ว</p><a className="btn" href="/">กลับหน้าแรก</a></main>
  const link=typeof window!=='undefined'?`${location.origin}/join?room=${code}`:''
  const tally=ps.map(p=>({p,n:vs.filter(v=>v.target_player_id===p.id).length})).sort((a,b)=>b.n-a.n)
  const top=tally.filter(t=>t.n===tally[0]?.n&&t.n>0)
  const nm=ps.find(p=>p.id===s?.subject_id)?.nickname??'?'
  const yes=vs.filter(v=>v.choice==='true').length,no=vs.filter(v=>v.choice==='false').length
  const parts=(s?.question_text??'').split('|');const [oa,ob]=parts;const opts=parts.slice(1)
  const names=(c:string)=>vs.filter(v=>v.choice===c).map(v=>ps.find(p=>p.id===v.voter_id)?.nickname).join(', ')
  const myWord=sec.find(k=>k.player_id===me?.id)?.word
  const oddK=sec.find(k=>k.is_odd);const oddP=ps.find(p=>p.id===oddK?.player_id)
  const majWord=sec.find(k=>!k.is_odd)?.word
  const title=!s?'':gt==='cards'?'🃏 ไพ่ปาร์ตี้':gt==='taboo'?`🙊 ${nm} กำลังใบ้!`:gt==='roulette'?`🎰 คนสุดท้ายต้อง: ${s.question_text}`:gt==='truth'?`${nm} บอกว่า “${s.question_text}” จริงหรือมั่ว?`
    :gt==='quick'?`${nm} ต้อง${s.question_text} ใน 5 วิ!`:gt==='mission'?s.question_text
    :gt==='never'?`ใครเคย ${s.question_text}?`:gt==='either'?'เลือกข้าง!':(gt==='sync'||gt==='quiz')?oa:gt==='odd'?`หมวด: ${s.question_text}`:`“${s.question_text}”`
  const gname=GAMES.find(g=>g[0]===game)?.[2]
  const noCustom=game==='odd'||game==='taboo'||game==='cards'||game==='roulette'||game.startsWith('quiz')
  const pick=(c:string)=>call('cast_choice',{p_session:s?.id,p_choice:c})
  const nextGame=gt==='quiz'?(game.startsWith('quiz')?game:'quiz'):(gt??'')
  const remain=52-deck.length;const last=deck[deck.length-1];const turnP=ps[deck.length%Math.max(ps.length,1)]
  const canDraw=!!me&&remain>0&&(me.id===turnP?.id||host)
  const redS=(x:string)=>x==='♥'||x==='♦'
  const iGive=me?.id===s?.subject_id;const cur=cards.find(c=>c.result===null)
  const ordered=[...sec].sort((a,b)=>Number(a.word)-Number(b.word));const nR=ordered.length
  const endMs=s?.ended_at?new Date(s.ended_at).getTime():0
  const k=Math.min(Math.max(nR-1,0),Math.max(0,Math.floor((now+skew-endMs)/2000)))
  const done=nR>0&&k>=nR-1
  const loserName=ps.find(x=>x.id===ordered.find(o=>o.is_odd)?.player_id)?.nickname??'?'
  const playerGrid=<ul className="grid grid-cols-2 gap-3">{ps.filter(p=>p.id!==me?.id).map((p,i)=><li key={p.id}>
    <button className="card w-full py-6 hover:border-pink-400" onClick={()=>call('cast_vote',{p_session:s?.id,p_target:p.id})}>
    <span className={`block mx-auto w-12 h-12 rounded-full leading-[3rem] font-bold ${COL[i%COL.length]}`}>{p.nickname[0]}</span>{p.nickname}</button></li>)}</ul>
  return(<main className="max-w-md mx-auto p-4 space-y-4">
    {off&&<div role="status" className="card text-center">📡 การเชื่อมต่อขาดหาย กำลังเชื่อมต่อใหม่...</div>}
    {err&&<p role="alert" className="text-pink-400 text-center">{err==='NO_QUESTIONS'?'ยังไม่มีคำถามในชุดนี้':err}</p>}
    <header className="text-center"><div className="text-sm text-white/60">🍻 วงแตก • ROOM</div>
      <div className="text-4xl font-mono font-extrabold tracking-[.3em]">{code}</div></header>
    {room.status==='waiting'&&<>
      <div className="flex gap-2"><button className="btn alt" onClick={()=>navigator.clipboard.writeText(link)}>📋 คัดลอกลิงก์</button><button className="btn alt" onClick={()=>setQr(true)}>📱 QR</button></div>
      <section className="card"><h2 className="mb-3 font-bold">ผู้เล่น {ps.length} คน</h2>
        <ul className="grid grid-cols-2 gap-3">{ps.map((p,i)=><li key={p.id} className="flex items-center gap-2">
          <span className={`w-10 h-10 rounded-full grid place-items-center font-bold ${COL[i%COL.length]}`}>{p.nickname[0]}</span>
          <span className="truncate">{p.nickname}{p.is_host&&' 👑'}</span>
          {host&&!p.is_host&&<button aria-label={`เตะ ${p.nickname}`} onClick={()=>call('kick_player',{p_code:code,p_player:p.id})}>✕</button>}</li>)}</ul></section>
      {host?<div className="space-y-2">
        <h2 className="font-bold text-center">เลือกเกม</h2>
        <ul className="grid grid-cols-2 gap-2">{GAMES.map(([id,ic,t])=><li key={id}><button aria-pressed={game===id} onClick={()=>setGame(id)} className={`card w-full py-4 ${game===id?'border-pink-400 shadow-[0_0_16px_#ec489966]':''}`}><div className="text-3xl">{ic}</div><div className="text-sm">{t}</div></button></li>)}</ul>
        <section className="card text-sm" aria-live="polite"><b>{GAMES.find(g=>g[0]===game)?.[1]} {gname}</b><p className="text-white/70 mt-1">{DESC[game]}</p></section>
        {!noCustom&&<button className="btn alt" onClick={()=>{const t=prompt(`เพิ่มคำถามให้เกม “${gname}”\n${HINT[game]}`);if(t)call('add_custom_question',{p_code:code,p_text:t,p_game:game})}}>+ เพิ่มคำถามให้เกม “{gname}”</button>}
        <button className="btn" disabled={ps.length<(game==='odd'?3:2)} onClick={()=>go(game)}>🎲 เริ่มเกม</button>
        <button className="btn alt" onClick={()=>confirm('ปิดห้อง?')&&call('close_room',{p_code:code})}>ปิดห้อง</button></div>
        :<p className="text-center text-white/60">รอ Host เลือกเกม...</p>}</>}
    {room.status==='playing'&&s&&<>
      <p className="text-center text-white/60">รอบที่ {s.round}</p>
      <h1 className="text-2xl font-bold text-center">{s.status==='voting'&&gt==='either'?'เลือกข้าง!':title}</h1>
      {s.status==='voting'?<>
        {gt!=='cards'&&<div className={`mx-auto w-20 h-20 rounded-full grid place-items-center text-3xl font-bold border-4 ${left<=5?'border-red-500 animate-pulse':'border-pink-500'}`} aria-live="polite">{left}</div>}
        {gt==='odd'&&<div className="card text-center"><div className="text-sm text-white/60">คำลับของคุณ (อย่าให้ใครเห็น!)</div><div className="text-4xl font-extrabold my-2">{myWord??'…'}</div><p className="text-sm text-white/60">ผลัดกันอธิบายคำนี้แบบไม่บอกตรง ๆ แล้วโหวตคนที่น่าสงสัยที่สุด</p></div>}
        {gt==='cards'?<div className="space-y-3">
          <p className="text-center text-sm text-white/60">เหลือในสำรับ {remain} / 52 ใบ</p>
          {last?<div className="card text-center border-pink-400"><div className={`text-7xl font-extrabold ${redS(last.suit)?'text-red-400':'text-white'}`}>{last.face}{last.suit}</div><div className="mt-2 font-bold">{CARD_RULES[last.face]?.[0]}</div><p className="text-white/70 text-sm mt-1">{CARD_RULES[last.face]?.[1]}</p><p className="text-xs text-white/50 mt-2">เปิดโดย {ps.find(x=>x.id===last.drawn_by)?.nickname??'?'}</p></div>:<div className="card text-center text-white/60">🂠 ยังไม่ได้เปิดไพ่ใบแรก</div>}
          {remain>0?(canDraw?<button className="btn text-xl py-6" onClick={()=>call('draw_card',{p_session:s.id,p_expected:deck.length})}>🃏 เปิดไพ่</button>:<p className="text-center text-lg">รอ {turnP?.nickname??'...'} เปิดไพ่...</p>):<p className="text-center text-lg font-bold">หมดสำรับแล้ว! 🎉</p>}
          {remain>0&&turnP&&<p className="text-center text-sm text-white/60">ตาของ {turnP.nickname}{host&&me?.id!==turnP.id?' (Host เปิดแทนได้)':''}</p>}
          <ul className="flex flex-wrap gap-1 justify-center">{deck.map(c=><li key={c.pos} className={`px-2 py-1 rounded bg-white/10 text-sm ${redS(c.suit)?'text-red-400':''}`}>{c.face}{c.suit}</li>)}</ul>
          {host&&<div className="space-y-2"><button className="btn alt" onClick={()=>confirm('สับสำรับใหม่? ไพ่ที่เปิดไปแล้วจะกลับเข้ามาสุ่มใหม่')&&call('start_cards',{p_code:code})}>🔀 เริ่มสำรับใหม่</button><button className="btn alt" onClick={()=>call('back_to_lobby',{p_code:code})}>🏠 กลับ Lobby</button></div>}</div>
        :gt==='taboo'?(iGive
          ?<div className="space-y-3"><div className="card text-center border-pink-400"><div className="text-sm text-white/60">ใบ้คำนี้ให้เพื่อนทาย</div><div className="text-4xl font-extrabold my-2">{cur?.target??'…'}</div><div className="text-sm text-red-400">🚫 ห้ามพูด: {cur?.forbidden.join(' • ')}</div></div>
            <div className="grid grid-cols-2 gap-3"><button className="btn" onClick={()=>call('taboo_next',{p_session:s.id,p_result:'ok'})}>✅ ทายถูก</button><button className="btn alt" onClick={()=>call('taboo_next',{p_session:s.id,p_result:'skip'})}>⏭️ ข้าม</button></div>
            <p className="text-center text-sm text-white/60">✅ {s.ok_count} • 🚨 {s.buzz_count}</p></div>
          :<div className="space-y-3"><p className="text-center text-lg">🙊 {nm} กำลังใบ้ ช่วยกันทาย!</p><p className="text-center text-3xl font-bold">✅ {s.ok_count} <span className="text-base text-white/60">• 🚨 {s.buzz_count}</span></p>
            <button className="btn alt text-xl py-6 border-red-500" onClick={()=>call('taboo_next',{p_session:s.id,p_result:'buzz'})}>🚨 พูดคำห้าม!</button><p className="text-center text-sm text-white/60">คนใบ้หลุดพูดคำต้องห้าม? กดบัซเซอร์เลย</p></div>)
        :gt==='roulette'?(myVote?<p className="text-center text-lg">✓ กดแล้ว<br/><span className="text-white/60 text-sm">รอเพื่อนกดให้ครบ...</span></p>:<div className="space-y-2"><button className="btn text-3xl py-10 animate-pulse" onClick={()=>call('tap_roulette',{p_session:s.id})}>👆 กดเลย!</button><p className="text-center text-sm text-white/60">ใครไม่กดทัน = โดนเลย!</p></div>)
        :gt==='mission'?<p className="text-center text-white/60">ทำภารกิจให้ทันเวลา!</p>
        :gt==='quick'?<p className="text-center text-lg">⏱️ {nm} กำลังตอบ...</p>
        :gt==='truth'&&me?.id===s.subject_id?<p className="text-center text-lg">รอเพื่อนโหวต... ({vs.length}/{ps.length-1})</p>
        :myVote?<p className="text-center text-lg">✓ เลือกแล้ว<br/><span className="text-white/60 text-sm">รอผู้เล่นคนอื่น... ({vs.length}/{gt==='truth'?ps.length-1:ps.length})</span></p>
        :gt==='truth'?<div className="grid grid-cols-2 gap-3"><button className="btn" onClick={()=>pick('true')}>✅ จริง</button><button className="btn alt" onClick={()=>pick('false')}>❌ มั่ว</button></div>
        :gt==='never'?<div className="grid grid-cols-2 gap-3"><button className="btn" onClick={()=>pick('true')}>🙋 เคย</button><button className="btn alt" onClick={()=>pick('false')}>🙅 ไม่เคย</button></div>
        :gt==='either'?<div className="space-y-3"><button className="btn" onClick={()=>pick('true')}>🅰️ {oa}</button><button className="btn alt" onClick={()=>pick('false')}>🅱️ {ob}</button></div>
        :(gt==='sync'||gt==='quiz')?<div className="space-y-2"><p className="text-center text-sm text-white/60">{gt==='quiz'?'เลือกคำตอบที่ถูกต้อง':'เลือกให้ตรงกับที่เพื่อนส่วนใหญ่จะเลือก'}</p>{opts.map((o,i)=><button key={i} className={i===0?'btn':'btn alt'} onClick={()=>pick(String(i))}>{'ABCD'[i]}. {o}</button>)}</div>
        :playerGrid}</>
      :<section className="space-y-3">
        {gt==='taboo'&&<>
          <div className="text-center text-5xl">🙊</div>
          <h2 className="text-center text-2xl font-bold">{nm} ใบ้ได้ {s.ok_count-s.buzz_count} คะแนน</h2>
          <p className="text-center text-white/60">✅ ทายถูก {s.ok_count} • 🚨 พูดคำห้าม {s.buzz_count}</p>
          <ul className="card space-y-1 text-sm">{cards.filter(c=>c.result).map(c=><li key={c.idx} className="flex justify-between"><span>{c.target}</span><span>{c.result==='ok'?'✅':c.result==='buzz'?'🚨':'⏭️'}</span></li>)}</ul></>}
        {gt==='roulette'&&<>
          <div className="text-center text-5xl">{done?'💀':'🎰'}</div>
          <h2 className="text-center text-xl font-bold">{nR===0?'กำลังสุ่ม...':done?`${loserName} โดน!`:'กำลังสุ่มคัดออก...'}</h2>
          <ul className="grid grid-cols-2 gap-2">{ordered.map(o=>{const pl=ps.find(x=>x.id===o.player_id);const out=Number(o.word)<k;const lose=done&&o.is_odd;const tapped=vs.some(v=>v.voter_id===o.player_id)
            return <li key={o.player_id} className={`card text-center transition-all ${lose?'border-red-500 shadow-[0_0_24px_#ef4444aa] scale-105':''} ${out?'opacity-30 line-through':''}`}>{pl?.nickname??'?'}{!tapped&&' 🐢'}{out&&' ❌'}{lose&&' 💀'}</li>})}</ul>
          {done&&<div className="card text-center"><div className="text-sm text-white/60">บทลงโทษ</div><div className="text-xl font-bold">{s.question_text}</div></div>}</>}
        {gt==='quiz'&&<>
          <div className="text-center text-5xl">🧩</div>
          {opts.map((o,i)=><Bar key={i} label={`${'ABCD'[i]}. ${o}${ans===i?' ✅':''}`} n={vs.filter(v=>v.choice===String(i)).length} total={ps.length} note={names(String(i))}/>)}
          {ans!==null&&<p className="text-center text-lg font-bold">ตอบถูก {vs.filter(v=>v.choice===String(ans)).length}/{ps.length} คน{vs.some(v=>v.choice===String(ans))&&`: ${names(String(ans))}`}</p>}
          <p className="text-center text-xs text-white/40">ชุด English: Open Trivia DB (CC BY-SA 4.0)</p></>}
        {gt==='most-likely'&&<>
          <div className="text-center text-5xl">{top.length===1?'👑':'🔥'}</div>
          <h2 className="text-center text-2xl font-bold">{top.length===1?`${top[0].p.nickname} ตัวตึงประจำวง`:top.length>1?`เสมอกัน! ${top.map(t=>t.p.nickname).join(' vs ')}`:'ไม่มีใครโหวต'}</h2>
          {tally.map(({p,n})=><Bar key={p.id} label={p.nickname} n={n} total={ps.length}/>)}</>}
        {gt==='odd'&&<>
          <div className="text-center text-5xl">{top.length===1&&top[0].p.id===oddK?.player_id?'🎉':'😈'}</div>
          <h2 className="text-center text-2xl font-bold">{top.length===1&&top[0].p.id===oddK?.player_id?'จับตัวปลอมได้!':'ตัวปลอมรอดไปได้!'}</h2>
          <div className="card text-center">ตัวปลอมคือ <b className="text-pink-400">{oddP?.nickname??'?'}</b><br/><span className="text-white/70">คำของวง: {majWord} • คำของตัวปลอม: {oddK?.word}</span></div>
          {tally.map(({p,n})=><Bar key={p.id} label={p.nickname} n={n} total={ps.length}/>)}</>}
        {gt==='sync'&&<>
          <div className="text-center text-5xl">🧠</div><h2 className="text-center text-xl font-bold">{oa}</h2>
          {opts.map((o,i)=>{const c=vs.filter(v=>v.choice===String(i)).length;const mx=Math.max(...opts.map((_,j)=>vs.filter(v=>v.choice===String(j)).length))
            return <Bar key={i} label={`${'ABCD'[i]}. ${o}${c===mx&&mx>0?' 👑':''}`} n={c} total={ps.length} note={names(String(i))}/>})}
          <p className="text-center text-white/60">👑 = คำตอบที่ตรงกับคนส่วนใหญ่ คนที่เลือกต่างจากวงคือตัวแปลก!</p></>}
        {gt==='never'&&<><div className="text-center text-5xl">🙋</div><h2 className="text-center text-xl font-bold">{title}</h2>
          <Bar label="🙋 เคย" n={yes} total={ps.length}/><Bar label="🙅 ไม่เคย" n={no} total={ps.length}/></>}
        {gt==='either'&&<><div className="text-center text-5xl">⚖️</div>
          <Bar label={`🅰️ ${oa}`} n={yes} total={ps.length}/><Bar label={`🅱️ ${ob}`} n={no} total={ps.length}/>
          <p className="text-center text-white/60">{yes===no?'เสมอ! ช่วยกันเถียงหน่อย':yes>no?'ฝั่ง A ชนะ':'ฝั่ง B ชนะ'}</p></>}
        {gt==='truth'&&<div className="text-center space-y-1"><div className="text-5xl">🤥</div><h2 className="text-2xl font-bold">{yes>no?'เพื่อนเชื่อ ✅':yes<no?'เพื่อนไม่เชื่อ ❌':'เสมอ!'}</h2><p>จริง {yes} • มั่ว {no}</p><p className="text-white/60">{nm} เฉลยหน่อย!</p></div>}
        {gt==='quick'&&<div className="text-center space-y-1"><div className="text-5xl">⏱️</div><h2 className="text-2xl font-bold">หมดเวลา!</h2><p className="text-white/60">{nm} ทำทันไหม? เพื่อน ๆ ช่วยกันตัดสิน</p></div>}
        {gt==='mission'&&<div className="text-center space-y-1"><div className="text-5xl">🎡</div><h2 className="text-2xl font-bold">หมดเวลา!</h2><p className="text-white/60">ทำภารกิจเสร็จกันหรือยัง?</p></div>}
        {(gt==='roulette'&&!done)?null:host?<div className="space-y-2"><button className="btn" onClick={()=>go(nextGame)}>🎲 เล่นรอบต่อไป</button>
          <button className="btn alt" onClick={()=>call('back_to_lobby',{p_code:code})}>🏠 กลับ Lobby</button></div>:<p className="text-center text-white/60">รอ Host...</p>}</section>}</>}
    {qr&&<div role="dialog" aria-modal className="fixed inset-0 bg-black/80 grid place-items-center p-6 z-10" onClick={()=>setQr(false)}>
      <div className="card text-center space-y-3" onClick={e=>e.stopPropagation()}><h2 className="font-bold">สแกนเพื่อเข้าห้อง</h2>
        <div className="bg-white p-3 rounded-xl inline-block"><QRCodeSVG value={link} size={220}/></div>
        <div className="font-mono text-2xl tracking-widest">{code}</div><button className="btn" onClick={()=>setQr(false)}>ปิด</button></div></div>}
  </main>)}