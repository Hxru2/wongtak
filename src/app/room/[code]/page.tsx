'use client'
import {Fragment,useCallback,useEffect,useRef,useState} from 'react'
import {useParams,useRouter} from 'next/navigation'
import {QRCodeSVG} from 'qrcode.react'
import {supabase,ensureAuth} from '@/lib/supabase'
type P={id:string;user_id:string;nickname:string;is_host:boolean;is_connected:boolean}
type S={id:string;question_text:string;round:number;status:string;ends_at:string;game_type:string;subject_id:string|null;ended_at:string|null;ok_count:number;buzz_count:number;votes_count:number;phase:string|null;turn_id:string|null;last_shot:Shot|null;outcome?:string|null;shots_left?:number|null;shot_targets?:string[]|null}
type Deck={pos:number;face:string;suit:string;drawn_by:string|null}
type Shot={type:string;by?:string;target?:string;cell?:number;result?:string;size?:number;out?:boolean;n:number}
type Mission={id:string;player_id:string;mission_text:string;status:string;completed_at:string|null}
type BP={player_id:string;seq:number;alive:boolean}
type BShip={player_id:string;ship_idx:number;cells:number[]}
type BHit={player_id:string;cell:number}
type Card={idx:number;target:string;forbidden:string[];result:string|null}
type V={voter_id:string;target_player_id:string|null;choice:string|null}
type R={id:string;status:string;host_id:string}
type Sec={player_id:string;word:string;is_odd:boolean}
const COL=['bg-purple-500','bg-pink-500','bg-orange-500','bg-cyan-500','bg-emerald-500','bg-yellow-500']
const GAMES=[['insider','🎭','Insider'],['battle','🚢','เรือรบ'],['king','👑','พระราชา'],['cards','🃏','ไพ่ปาร์ตี้ 52 ใบ'],['taboo','🙊','ใบ้คำห้ามพูด'],['roulette','🎰','รูเล็ตต์ลงโทษ'],['quiz-th','🧩','Quiz (ไทย)'],['quiz-en','🌍','Quiz (English)'],['odd','🕵️','ตัวปลอม'],['sync','🧠','คิดตรงกัน'],['most-likely','😂','ใครมีโอกาสมากที่สุด'],['never','🙋','ใครเคย…'],['either','⚖️','เลือกข้าง'],['truth','🤥','จริงหรือมั่ว'],['quick','⏱️','5 วิ ตอบให้ทัน'],['mission','🎡','สุ่มภารกิจ']]
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
  insider:'สุ่ม 1 คนเป็น “ผู้ตอบ” และอีก 1 คนเป็น 😈 Insider ทั้งคู่เห็นคำลับ คนที่เหลือต้องทายคำโดยถามผู้ตอบได้แค่ ใช่/ไม่ใช่ ภายใน 4 นาที Insider ต้องแอบชี้นำให้ทายถูกโดยไม่ให้ใครจับได้ พอทายถูกแล้วทุกคนโหวตหา Insider (60 วินาที) ถ้าโหวตถูกฝ่ายผู้ทายชนะ ถ้าพลาดหรือเสมอ Insider ชนะ ทายไม่ทันทุกคนแพ้ (ต้อง 4 คนขึ้นไป • ผู้ตอบสลับคนอัตโนมัติ)',
  battle:'ทุกคนวางเรือลับบนกระดาน 5×5 (เรือ 3 ลำ ยาว 3/2/2 ช่อง) แล้วผลัดกันยิง: เลือกคนที่จะยิงก่อน จากนั้นเลือกช่อง ระบบบอกแค่ โดน/พลาด/จม ของนัดล่าสุด ไม่มีกระดานจดช่องที่ยิงไปแล้ว ต้องจำเอง! เรือหมดลำก็ตกรอบ เหลือคนสุดท้ายชนะ กระสุนจำกัด: 1 ตายิงได้ “จำนวนเป้าหมาย − 1” นัด (ขั้นต่ำ 1) และยิงได้คนละ 1 นัดต่อตา เช่น 4 คน ยิงได้ 2 นัด จะมี 1 คนที่ไม่โดนยิง ยิ่งคนตกรอบกระสุนยิ่งน้อยลง หมดเวลา = ระบบสุ่มยิงกระสุนที่เหลือให้ (วางเรือ 90 วินาที • ตาละ 25 วินาที + 10 วินาทีต่อกระสุนที่เพิ่ม)',
  king:'ทุกคนกดจั่วไพ่จากสำรับเดียวกันบนมือถือตัวเอง (เห็นเฉพาะไพ่ตัวเองก่อน) แล้วเปิดพร้อมกัน ใครแต้มสูงสุดได้เป็น 👑 พระราชา ออกคำสั่งให้ใครในวงก็ได้ ให้ทำภารกิจหรือดื่ม (ไม่สบายใจจะเปลี่ยนเป็นดื่มน้ำก็ได้)',
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
const N=5,FLEET=[3,2,2],COLS='ABCDE'
const cellName=(c:number)=>`${COLS[c%N]}${Math.floor(c/N)+1}`
function shotText(ls:Shot|null,nameOf:(id?:string|null)=>string){
  if(!ls||ls.type==='start')return 'เริ่มยิงได้เลย!'
  if(ls.type==='timeout')return `⏰ ${nameOf(ls.by)} หมดเวลา ข้ามตา`
  const r=ls.result==='miss'?'💧 พลาด':ls.result==='sunk'?`🔥 จมเรือ (${ls.size} ช่อง)!`:'💥 โดน!'
  return `${(ls as Shot&{auto?:boolean}).auto?'⏰ หมดเวลา สุ่มยิงให้: ':''}${nameOf(ls.by)} ยิง ${nameOf(ls.target)} ช่อง ${cellName(ls.cell??0)} → ${r}${ls.out?` • ${nameOf(ls.target)} ตกรอบ 💀`:''}`
}
function Grid({cls,sym,onTap,small}:{cls:(i:number)=>string;sym:(i:number)=>string;onTap?:(i:number)=>void;small?:boolean}){
  return(<div className={`grid grid-cols-6 gap-1 items-center text-center text-xs text-white/50 mx-auto ${small?'max-w-[12rem]':'max-w-[19rem]'}`}>
    <span/>{[...COLS].map(l=><span key={l}>{l}</span>)}
    {Array.from({length:N},(_,r)=><Fragment key={r}><span>{r+1}</span>
      {Array.from({length:N},(_,c)=>{const i=r*N+c;return <button key={i} type="button" disabled={!onTap} aria-label={`ช่อง ${cellName(i)}`} onClick={()=>onTap?.(i)} className={`aspect-square rounded-lg border ${small?'text-sm':'text-xl'} ${cls(i)}`}>{sym(i)}</button>})}</Fragment>)}</div>)}
const boardCls=(cells:number[],hit:number[])=>(i:number)=>cells.includes(i)&&hit.includes(i)?'bg-red-500/50 border-red-400':cells.includes(i)?'bg-cyan-500/40 border-cyan-300':'bg-white/5 border-white/10'
const boardSym=(cells:number[],hit:number[])=>(i:number)=>cells.includes(i)&&hit.includes(i)?'💥':cells.includes(i)?'🚢':''
function Battle({s,me,ps,bp,ships,hits,call}:{s:S;me?:P;ps:P[];bp:BP[];ships:BShip[];hits:BHit[];call:(fn:string,args:object)=>void}){
  const [horiz,setHoriz]=useState(true);const [plan,setPlan]=useState<number[][]>([])
  const [tgt,setTgt]=useState('');const [cell,setCell]=useState<number|null>(null)
  useEffect(()=>{setTgt('');setCell(null)},[s.ends_at,s.turn_id,s.last_shot?.n])
  const nameOf=(id?:string|null)=>ps.find(p=>p.id===id)?.nickname??'?'
  const mine=bp.find(b=>b.player_id===me?.id)
  const myCells=ships.filter(x=>x.player_id===me?.id).flatMap(x=>x.cells)
  const myHit=hits.filter(h=>h.player_id===me?.id).map(h=>h.cell)
  const ownBoard=<Grid small cls={boardCls(myCells,myHit)} sym={boardSym(myCells,myHit)}/>
  if(s.phase==='place'){
    if(!mine)return <p className="text-center text-white/60">เกมนี้เริ่มไปแล้ว คุณดูอยู่</p>
    if(myCells.length>0)return(<div className="space-y-3"><p className="text-center text-lg">✓ วางเรือแล้ว<br/><span className="text-white/60 text-sm">รอเพื่อน... ({s.votes_count}/{bp.length})</span></p>{ownBoard}<p className="text-center text-sm text-white/60">กระดานของคุณ — จำตำแหน่งเรือไว้!</p></div>)
    const size:number|undefined=FLEET[plan.length];const used=plan.flat()
    const tap=(i:number)=>{
      if(size===undefined)return
      const r=Math.floor(i/N),c=i%N
      if(horiz?c+size>N:r+size>N)return
      const cells=Array.from({length:size},(_,k)=>horiz?i+k:i+k*N)
      if(cells.some(x=>used.includes(x)))return
      setPlan([...plan,cells])}
    return(<div className="space-y-3">
      <p className="text-center">{size!==undefined?`วางเรือยาว ${size} ช่อง (${plan.length+1}/${FLEET.length}) — แตะช่องเริ่มต้น`:'วางครบแล้ว กดยืนยันได้เลย'}</p>
      <Grid cls={i=>used.includes(i)?'bg-cyan-500/40 border-cyan-300':'bg-white/5 border-white/20'} sym={i=>used.includes(i)?'🚢':''} onTap={tap}/>
      <div className="grid grid-cols-2 gap-2"><button className="btn alt" onClick={()=>setHoriz(v=>!v)}>{horiz?'↔️ แนวนอน':'↕️ แนวตั้ง'}</button><button className="btn alt" disabled={plan.length===0} onClick={()=>setPlan(plan.slice(0,-1))}>↩️ ลบลำล่าสุด</button></div>
      <button className="btn" disabled={plan.length!==FLEET.length} onClick={()=>call('place_ships',{p_session:s.id,p_ships:plan})}>✅ ยืนยันการวางเรือ</button>
      <button className="btn alt" onClick={()=>call('place_ships',{p_session:s.id})}>🎲 สุ่มวางให้</button></div>)
  }
  const turn=s.turn_id
  const myTurn=!!me&&turn===me.id&&!!mine?.alive
  const others=bp.filter(b=>b.alive&&b.player_id!==me?.id)
  const doneT=s.shot_targets??[];const ammo=s.shots_left??1
  return(<div className="space-y-3">
    <p className="card text-center text-sm" aria-live="polite">{shotText(s.last_shot,nameOf)}</p>
    <p className="text-center text-xs text-white/40">แสดงเฉพาะการยิงล่าสุด — ใครยิงช่องไหนไปแล้วต้องจำเอง!</p>
    <ul className="flex flex-wrap gap-2 justify-center">{bp.map(b=><li key={b.player_id} className={`px-3 py-1 rounded-full text-sm border ${turn===b.player_id?'border-pink-400 bg-pink-500/20':'border-white/20'} ${b.alive?'':'opacity-40 line-through'}`}>{nameOf(b.player_id)}{!b.alive&&' 💀'}{turn===b.player_id&&' 🎯'}</li>)}</ul>
    {myTurn?<div className="space-y-2">
      <h3 className="text-center font-bold">ตาของคุณ! 1) เลือกคนที่จะยิง</h3>
      <p className="text-center text-sm text-pink-300">🔫 กระสุนเหลือ {ammo} นัด • ยิงได้คนละ 1 นัดเท่านั้น</p>
      <ul className="grid grid-cols-2 gap-2">{others.map(b=><li key={b.player_id}><button aria-pressed={tgt===b.player_id} disabled={doneT.includes(b.player_id)} className={`card w-full py-3 ${tgt===b.player_id?'border-pink-400 shadow-[0_0_16px_#ec489966]':''} ${doneT.includes(b.player_id)?'opacity-40':''}`} onClick={()=>{setTgt(b.player_id);setCell(null)}}>{nameOf(b.player_id)}{doneT.includes(b.player_id)&&' ✓ ยิงแล้ว'}</button></li>)}</ul>
      {tgt&&<><h3 className="text-center font-bold">2) เลือกช่องที่จะยิงใส่ {nameOf(tgt)}</h3>
        <Grid cls={i=>cell===i?'bg-pink-500/40 border-pink-400':'bg-white/5 border-white/20'} sym={i=>cell===i?'🎯':''} onTap={setCell}/>
        <button className="btn" disabled={cell===null} onClick={()=>{if(cell!==null)call('battle_fire',{p_session:s.id,p_target:tgt,p_cell:cell})}}>🔥 ยิง{cell!==null?` ช่อง ${cellName(cell)}`:''}</button></>}</div>
      :<p className="text-center text-lg">{mine&&!mine.alive?'💀 คุณตกรอบแล้ว ดูเพื่อนเล่นต่อ':`⏳ รอ ${nameOf(turn)} ยิง... (กระสุน ${ammo} นัด)`}</p>}
    {mine&&<div><p className="text-center text-sm text-white/60 mb-1">กระดานของคุณ (💥 = เรือโดนยิง)</p>{ownBoard}</div>}</div>)}
function BattleOver({s,ps,bp,ships,hits}:{s:S;ps:P[];bp:BP[];ships:BShip[];hits:BHit[]}){
  const nameOf=(id?:string|null)=>ps.find(p=>p.id===id)?.nickname??'?'
  const win=s.subject_id
  return(<div className="space-y-3"><div className="text-center text-6xl">🏆</div>
    <h2 className="text-center text-2xl font-bold">{win?`${nameOf(win)} ชนะ! เรือรอดลำสุดท้าย`:'เกมจบ'}</h2>
    <p className="card text-center text-sm">{shotText(s.last_shot,nameOf)}</p>
    <div className="grid grid-cols-2 gap-3">{bp.map(b=>{const cs=ships.filter(x=>x.player_id===b.player_id).flatMap(x=>x.cells);const hs=hits.filter(h=>h.player_id===b.player_id).map(h=>h.cell)
      return <div key={b.player_id} className="space-y-1"><p className="text-center text-sm font-bold">{nameOf(b.player_id)}{b.player_id===win&&' 👑'}</p><Grid small cls={boardCls(cs,hs)} sym={boardSym(cs,hs)}/></div>})}</div></div>)}
const MAX_REROLL=3
function MissionPanel({code,me,host,ps,ms,startOpen,compact,call}:{code:string;me:P;host:boolean;ps:P[];ms:Mission[];startOpen:boolean;compact:boolean;call:(fn:string,args:object)=>void}){
  const [open,setOpen]=useState(startOpen);const [peek,setPeek]=useState(false);const [flash,setFlash]=useState('')
  const prev=useRef<number|null>(null)
  const nameOf=(id:string)=>ps.find(p=>p.id===id)?.nickname??'?'
  const mine=ms.find(m=>m.player_id===me.id&&m.status==='active')
  const skips=ms.filter(m=>m.player_id===me.id&&m.status==='skipped').length
  const doneMine=ms.filter(m=>m.player_id===me.id&&m.status==='done').length
  const done=ms.filter(m=>m.status==='done').sort((a,b)=>(b.completed_at??'').localeCompare(a.completed_at??''))
  const board=ps.map(p=>({p,n:done.filter(m=>m.player_id===p.id).length})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n)
  const newest=done[0]
  useEffect(()=>{
    if(prev.current!==null&&done.length>prev.current&&newest&&newest.player_id!==me.id){
      setFlash(`🎉 ${nameOf(newest.player_id)} ทำภารกิจลับสำเร็จ: “${newest.mission_text}”`)
      const t=setTimeout(()=>setFlash(''),8000)
      prev.current=done.length
      return()=>clearTimeout(t)
    }
    prev.current=done.length
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[done.length])
  useEffect(()=>{setPeek(false)},[mine?.id])
  useEffect(()=>{if(compact)setOpen(false)},[compact])
  if(compact&&!open)return(<div className="flex flex-col items-end gap-1">
    {flash&&<p role="status" className="text-xs text-pink-300 text-right">{flash}</p>}
    <button type="button" className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/20" aria-label="เปิดภารกิจลับ" onClick={()=>setOpen(true)}>🕵️{mine?' ●':''}</button></div>)
  return(<section className="card space-y-2" aria-label="ภารกิจลับ">
    {flash&&<p role="status" className="text-sm text-center text-pink-300">{flash}</p>}
    <button type="button" className="w-full flex items-center justify-between gap-2 text-left" aria-expanded={open} onClick={()=>setOpen(v=>!v)}>
      <span className="font-bold">🕵️ ภารกิจลับ{mine?' • มีภารกิจอยู่!':''}</span>
      <span className="text-sm text-white/60">{doneMine>0?`สำเร็จ ${doneMine} • `:''}{open?'ซ่อน ▲':'เปิด ▼'}</span></button>
    {open&&<div className="space-y-3">
      {mine?<div className="space-y-2">
        <button type="button" className="card w-full text-center py-4" aria-pressed={peek} onClick={()=>setPeek(v=>!v)}>
          {peek?<span className="text-lg font-bold">{mine.mission_text}</span>:<span className="text-white/60">🂠 แตะเพื่อดูภารกิจของคุณ (อย่าให้ใครเห็น!)</span>}</button>
        <p className="text-xs text-white/50 text-center">ห้ามบอกใครว่าภารกิจคืออะไร และห้ามสั่งตรง ๆ ทำให้สำเร็จแบบเนียน ๆ ระหว่างที่ทุกคนสังสรรค์ แล้วค่อยกดรายงาน</p>
        <button className="btn" onClick={()=>{if(confirm('ทำภารกิจสำเร็จจริงใช่ไหม? ภารกิจจะถูกเปิดเผยให้ทุกคนเห็น'))call('complete_mission',{p_assignment:mine.id})}}>✅ ทำสำเร็จแล้ว! เปิดเผยภารกิจ</button>
        <button className="btn alt" disabled={skips>=MAX_REROLL} onClick={()=>call('skip_mission',{p_assignment:mine.id})}>🔄 เปลี่ยนภารกิจ (เหลือ {Math.max(0,MAX_REROLL-skips)} ครั้ง)</button></div>
      :<div className="space-y-2"><p className="text-center text-sm text-white/70">{doneMine>0?'ภารกิจเสร็จแล้ว! รับภารกิจใหม่ต่อได้เลย':'ยังไม่มีภารกิจลับ'}</p>
        <button className="btn" onClick={()=>call('claim_mission',{p_code:code})}>🎯 รับภารกิจลับ</button></div>}
      {host&&<button className="btn alt" onClick={()=>call('deal_missions',{p_code:code})}>🕵️ แจกภารกิจลับให้ทุกคน (ที่ยังไม่มี)</button>}
      {done.length>0&&<div className="space-y-1"><h3 className="font-bold text-sm">🏅 ผู้ทำภารกิจสำเร็จ</h3>
        <p className="text-sm text-white/70">{board.map(x=>`${x.p.nickname} ${x.n}`).join(' • ')}</p>
        <ul className="space-y-1 text-sm">{done.slice(0,8).map(m=><li key={m.id}><b>{nameOf(m.player_id)}</b> ✅ “{m.mission_text}”</li>)}</ul></div>}
    </div>}
  </section>)}
function Bar({label,n,total,note}:{label:string;n:number;total:number;note?:string}){return(
  <div><div className="flex justify-between"><span>{label}</span><b>{n}</b></div>
  <div className="h-3 rounded bg-white/10"><div className="h-3 rounded bg-gradient-to-r from-purple-500 to-pink-500 transition-all" style={{width:`${total?n/total*100:0}%`}}/></div>
  {note&&<div className="text-xs text-white/50 mt-1">{note}</div>}</div>)}
export default function Room(){
  const code=String(useParams().code).toUpperCase();const router=useRouter()
  const [uid,setUid]=useState('');const [room,setRoom]=useState<R|null>(null);const [ps,setPs]=useState<P[]>([])
  const [s,setS]=useState<S|null>(null);const [vs,setVs]=useState<V[]>([]);const [sec,setSec]=useState<Sec[]>([]);const [ans,setAns]=useState<number|null>(null)
  const [now,setNow]=useState(Date.now());const [qr,setQr]=useState(false);const [off,setOff]=useState(false);const [err,setErr]=useState('')
  const [game,setGame]=useState('battle');const [skew,setSkew]=useState(0);const [cards,setCards]=useState<Card[]>([]);const [deck,setDeck]=useState<Deck[]>([]);const [peek,setPeek]=useState(false);const [cmd,setCmd]=useState('');const [tgt,setTgt]=useState('ALL');const [bp,setBp]=useState<BP[]>([]);const [bShips,setBShips]=useState<BShip[]>([]);const [bHits,setBHits]=useState<BHit[]>([]);const [ms,setMs]=useState<Mission[]>([])
  const loadMissions=useCallback(async(roomId:string)=>{
    const m=await supabase.from('mission_assignments').select('id,player_id,mission_text,status,completed_at').eq('room_id',roomId).order('assigned_at')
    setMs((m.data as Mission[]|null)||[])
  },[])
  const load=useCallback(async()=>{
    const id=await ensureAuth();setUid(id)
    const {data:r}=await supabase.from('rooms').select('id,status,host_id').eq('code',code).maybeSingle()
    if(!r){router.replace(`/join?room=${code}`);return}
    setRoom(r)
    loadMissions(r.id)
    const [p,g]=await Promise.all([supabase.from('players').select('*').eq('room_id',r.id).order('joined_at'),
      supabase.from('game_sessions').select('*').eq('room_id',r.id).order('started_at',{ascending:false}).limit(1).maybeSingle()])
    setPs((p.data||[]).filter((x:P)=>x.is_connected));setS(g.data)
    if(g.data){
      const v=await supabase.from('votes').select('voter_id,target_player_id,choice').eq('game_session_id',g.data.id);setVs(v.data||[])
      if(g.data.game_type==='odd'||g.data.game_type==='roulette'||g.data.game_type==='insider'){const k=await supabase.from('game_secrets').select('player_id,word,is_odd').eq('session_id',g.data.id);setSec(k.data||[])}else setSec([])
      if(g.data.game_type==='quiz'){const a=await supabase.from('game_answers').select('correct').eq('session_id',g.data.id).maybeSingle();setAns(a.data?a.data.correct:null)}else setAns(null)
    if(g.data.game_type==='taboo'){const c=await supabase.from('taboo_cards').select('idx,target,forbidden,result').eq('session_id',g.data.id).order('idx');setCards(c.data||[])}else setCards([])
      if(g.data.game_type==='cards'){const d=await supabase.from('card_deck').select('pos,face,suit,drawn_by').eq('session_id',g.data.id).not('drawn_at','is',null).order('pos');setDeck(d.data||[])}else if(g.data.game_type==='king'){const d=await supabase.from('king_deck').select('pos,face,suit,drawn_by').eq('session_id',g.data.id).not('drawn_by','is',null);setDeck(d.data||[])}else setDeck([])
    
      if(g.data.game_type==='battle'){
        const [a,b,c]=await Promise.all([supabase.from('battle_players').select('player_id,seq,alive').eq('session_id',g.data.id).order('seq'),
          supabase.from('battle_ships').select('player_id,ship_idx,cells').eq('session_id',g.data.id),
          supabase.from('battle_hits').select('player_id,cell').eq('session_id',g.data.id)])
        setBp(a.data||[]);setBShips(b.data||[]);setBHits(c.data||[])
      }else{setBp([]);setBShips([]);setBHits([])}
    }else{setVs([]);setSec([]);setAns(null);setCards([]);setDeck([]);setBp([]);setBShips([]);setBHits([])}
  },[code,router,loadMissions])
  useEffect(()=>{load()
    const t0=Date.now()
    ensureAuth().then(()=>supabase.rpc('server_now')).then(({data})=>{if(data)setSkew(new Date(data).getTime()-(t0+Date.now())/2)})
    const ch=supabase.channel(`room-${code}`)
    for(const table of ['players','rooms','game_sessions','votes','mission_assignments'])ch.on('postgres_changes',{event:'*',schema:'public',table},load)
    ch.subscribe(st=>setOff(st==='CLOSED'||st==='CHANNEL_ERROR'))
    const t=setInterval(()=>setNow(Date.now()),250)
    return()=>{supabase.removeChannel(ch);clearInterval(t)}},[code,load])
  const me=ps.find(p=>p.user_id===uid);const host=room?.host_id===uid
  const gt=s?.game_type
  const left=s?Math.max(0,Math.ceil((new Date(s.ends_at).getTime()-(now+skew))/1000)):0
  const myVote=vs.find(v=>v.voter_id===me?.id)
  useEffect(()=>{if(s?.status==='voting'&&!['roulette','king','battle','insider'].includes(s.game_type)&&(left===0
    ||(['most-likely','never','either','odd','sync','quiz'].includes(s.game_type)&&ps.length>1&&s.votes_count>=ps.length)
    ||(s.game_type==='truth'&&ps.length>1&&s.votes_count>=ps.length-1)))
    supabase.rpc('finish_round',{p_session:s.id}).then(load)},[left,ps.length,s,load])
  useEffect(()=>{if(gt!=='roulette'||!s||s.status!=='voting')return
    const id=s.id;const t=setInterval(()=>{supabase.rpc('finish_roulette',{p_session:id}).then(r=>{if(!r.error)load()})},1500)
    return()=>clearInterval(t)},[gt,s,load])
  useEffect(()=>{if(gt!=='taboo'||!s||s.status!=='voting'||left>0)return
    const id=s.id;const t=setInterval(()=>{supabase.rpc('finish_round',{p_session:id}).then(r=>{if(!r.error)load()})},1500)
    return()=>clearInterval(t)},[gt,s,left,load])
  useEffect(()=>{if(gt!=='king'||!s||s.status!=='voting')return
    const cnt=Number(s.question_text)||0
    if(left>0&&!(ps.length>1&&cnt>=ps.length))return
    const id=s.id;const run=()=>supabase.rpc('finish_king',{p_session:id}).then(r=>{if(!r.error)load()});run()
    const t=setInterval(run,1500)
    return()=>clearInterval(t)},[gt,s,left,ps.length,load])
  useEffect(()=>{if(gt!=='insider'||!s||s.status!=='voting')return
    if(left>0&&!(s.phase==='vote'&&ps.length>1&&s.votes_count>=ps.length))return
    const id=s.id;const run=()=>supabase.rpc('insider_tick',{p_session:id}).then(r=>{if(r.data)load()});run()
    const t=setInterval(run,1500)
    return()=>clearInterval(t)},[gt,s,left,ps.length,load])
  useEffect(()=>{if(gt!=='battle'||!s||s.status!=='voting'||left>0)return
    const id=s.id;const run=()=>supabase.rpc('battle_tick',{p_session:id}).then(r=>{if(r.data)load()});run()
    const t=setInterval(run,1500)
    return()=>clearInterval(t)},[gt,s,left,load])
  const rid=room?.id
  useEffect(()=>{if(!rid)return;const t=setInterval(()=>{loadMissions(rid)},15000);return()=>clearInterval(t)},[rid,loadMissions])
  async function call(fn:string,args:object){const {error}=await supabase.rpc(fn,args);setErr(error?error.message:'');load()}
  const go=(g:string)=>g==='insider'?call('start_insider',{p_code:code}):g==='battle'?call('start_battle',{p_code:code}):g==='king'?call('start_king',{p_code:code}):g==='cards'?call('start_cards',{p_code:code}):g==='taboo'?call('start_taboo',{p_code:code}):g==='roulette'?call('start_roulette',{p_code:code}):g.startsWith('quiz')?call('start_quiz',{p_code:code,p_lang:g.includes('-')?g.split('-')[1]:null}):call('start_game',{p_code:code,p_game:g})
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
  const oddK=sec.find(k=>k.is_odd);const insMaster=ps.find(p=>p.id===s?.subject_id);const iMaster=!!me&&me.id===s?.subject_id;const iInsider=!!oddK&&oddK.player_id===me?.id
  const insWon=s?.outcome==='group_win'
  const oddP=ps.find(p=>p.id===oddK?.player_id)
  const majWord=sec.find(k=>!k.is_odd)?.word
  const title=!s?'':gt==='insider'?`🎭 Insider • หมวด: ${s.question_text}`:gt==='battle'?'🚢 เรือรบ':gt==='king'?'👑 พระราชา':gt==='cards'?'🃏 ไพ่ปาร์ตี้':gt==='taboo'?`🙊 ${nm} กำลังใบ้!`:gt==='roulette'?`🎰 คนสุดท้ายต้อง: ${s.question_text}`:gt==='truth'?`${nm} บอกว่า “${s.question_text}” จริงหรือมั่ว?`
    :gt==='quick'?`${nm} ต้อง${s.question_text} ใน 5 วิ!`:gt==='mission'?s.question_text
    :gt==='never'?`ใครเคย ${s.question_text}?`:gt==='either'?'เลือกข้าง!':(gt==='sync'||gt==='quiz')?oa:gt==='odd'?`หมวด: ${s.question_text}`:`“${s.question_text}”`
  const gname=GAMES.find(g=>g[0]===game)?.[2]
  const noCustom=game==='insider'||game==='odd'||game==='taboo'||game==='cards'||game==='king'||game==='battle'||game==='roulette'||game.startsWith('quiz')
  const pick=(c:string)=>call('cast_choice',{p_session:s?.id,p_choice:c})
  const nextGame=gt==='quiz'?(game.startsWith('quiz')?game:'quiz'):(gt??'')
  const remain=52-deck.length;const last=deck[deck.length-1];const turnP=ps[deck.length%Math.max(ps.length,1)]
  const canDraw=!!me&&remain>0&&(me.id===turnP?.id||host)
  const redS=(x:string)=>x==='♥'||x==='♦'
  const valOf=(f:string)=>f==='A'?14:f==='K'?13:f==='Q'?12:f==='J'?11:Number(f)
  const sRank=(x:string)=>x==='♠'?4:x==='♥'?3:x==='♦'?2:1
  const myCard=deck.find(c=>c.drawn_by===me?.id);const kingCnt=Number(s?.question_text)||0
  const hands=[...deck].sort((a,b)=>valOf(b.face)-valOf(a.face)||sRank(b.suit)-sRank(a.suit))
  const kingP=ps.find(x=>x.id===s?.subject_id);const iKing=!!me&&me.id===s?.subject_id
  const cmdRaw=s?.question_text??'';const hasCmd=cmdRaw.includes('|')
  const cmdTarget=hasCmd?cmdRaw.slice(0,cmdRaw.indexOf('|')):'';const cmdText=hasCmd?cmdRaw.slice(cmdRaw.indexOf('|')+1):''
  const iGive=me?.id===s?.subject_id;const cur=cards.find(c=>c.result===null)
  const ordered=[...sec].sort((a,b)=>Number(a.word)-Number(b.word));const nR=ordered.length
  const endMs=s?.ended_at?new Date(s.ended_at).getTime():0
  const k=Math.min(Math.max(nR-1,0),Math.max(0,Math.floor((now+skew-endMs)/2000)))
  const done=nR>0&&k>=nR-1
  const loserName=ps.find(x=>x.id===ordered.find(o=>o.is_odd)?.player_id)?.nickname??'?'
  const playerGrid=<ul className="grid grid-cols-2 gap-3">{ps.filter(p=>p.id!==me?.id).map((p,i)=><li key={p.id}>
    <button className="card w-full py-6 hover:border-pink-400" onClick={()=>call('cast_vote',{p_session:s?.id,p_target:p.id})}>
    <span className={`block mx-auto w-12 h-12 rounded-full leading-[3rem] font-bold ${COL[i%COL.length]}`}>{p.nickname[0]}</span>{p.nickname}</button></li>)}</ul>
  const inRound=room.status==='playing'&&s?.status==='voting'
  return(<main className="max-w-md mx-auto p-4 space-y-4">
    {off&&<div role="status" className="card text-center">📡 การเชื่อมต่อขาดหาย กำลังเชื่อมต่อใหม่...</div>}
    {err&&<p role="alert" className="text-pink-400 text-center">{({NO_QUESTIONS:'ยังไม่มีคำถามในชุดนี้',NO_REROLLS_LEFT:'ใช้สิทธิ์เปลี่ยนภารกิจครบแล้ว',ALREADY_ACTIVE:'คุณมีภารกิจอยู่แล้ว',NO_MISSIONS:'ยังไม่มีภารกิจในคลัง'} as Record<string,string>)[err]??err}</p>}
    {!inRound&&<header className="text-center"><div className="text-sm text-white/60">🍻 วงแตก • ROOM</div>
      <div className="text-4xl font-mono font-extrabold tracking-[.3em]">{code}</div></header>}
    {me&&<MissionPanel code={code} me={me} host={host} ps={ps} ms={ms} startOpen={room.status==='waiting'} compact={inRound} call={call}/>}
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
        <button className="btn" disabled={ps.length<(game==='insider'?4:game==='odd'?3:2)} onClick={()=>go(game)}>🎲 เริ่มเกม</button>
        <button className="btn alt" onClick={()=>confirm('ปิดห้อง?')&&call('close_room',{p_code:code})}>ปิดห้อง</button></div>
        :<p className="text-center text-white/60">รอ Host เลือกเกม...</p>}</>}
    {room.status==='playing'&&s&&<>
      {!inRound&&<p className="text-center text-white/60">รอบที่ {s.round}</p>}
      <h1 className="text-2xl font-bold text-center">{s.status==='voting'&&gt==='either'?'เลือกข้าง!':title}</h1>
      {s.status==='voting'?<>
        {gt!=='cards'&&<div className={`mx-auto w-20 h-20 rounded-full grid place-items-center text-3xl font-bold border-4 ${left<=5?'border-red-500 animate-pulse':'border-pink-500'}`} aria-live="polite">{left}</div>}
        {gt==='odd'&&<div className="card text-center"><div className="text-sm text-white/60">คำลับของคุณ (อย่าให้ใครเห็น!)</div><div className="text-4xl font-extrabold my-2">{myWord??'…'}</div><p className="text-sm text-white/60">ผลัดกันอธิบายคำนี้แบบไม่บอกตรง ๆ แล้วโหวตคนที่น่าสงสัยที่สุด</p></div>}
        {gt==='insider'?(s.phase==='vote'
          ?<div className="space-y-3"><p className="text-center text-lg">🗳️ ทายถูกแล้ว! ใครคือ 😈 Insider?</p>
            {myVote?<p className="text-center text-lg">✓ โหวตแล้ว<br/><span className="text-white/60 text-sm">รอเพื่อนโหวต... ({s.votes_count}/{ps.length})</span></p>
            :<div className="grid grid-cols-2 gap-2">{ps.filter(x=>x.id!==me?.id&&x.id!==s.subject_id).map(x=><button key={x.id} className="btn alt" onClick={()=>call('insider_vote',{p_session:s.id,p_target:x.id})}>{x.nickname}</button>)}</div>}
            <p className="text-center text-xs text-white/50">โหวตตัวเองและผู้ตอบไม่ได้ • คะแนนสูงสุดต้องชัดเจนจึงจะจับได้ (เสมอ = Insider รอด)</p></div>
          :<div className="space-y-3">
            <div className="card text-center border-pink-400"><div className="text-sm text-white/60">{iMaster?'คุณคือ ผู้ตอบ 🙋 • คำลับ (ตอบได้แค่ ใช่/ไม่ใช่)':iInsider?'คุณคือ 😈 Insider • คำลับ (แอบชี้นำ อย่าให้ใครจับได้!)':'คุณคือผู้ทาย 🔎'}</div>
              <div className="text-4xl font-extrabold my-2">{iMaster||iInsider?(myWord??'…'):'???'}</div>
              <p className="text-sm text-white/60">{iMaster?'เพื่อนจะถามคุณ ตอบได้แค่ ใช่ / ไม่ใช่ / ไม่เกี่ยว เมื่อมีคนทายถูกกดปุ่มด้านล่าง':iInsider?'ผู้ตอบกับคุณรู้คำเดียวกัน ช่วยให้เพื่อนทายถูกอย่างเนียน ๆ':`ถาม ${insMaster?.nickname??'ผู้ตอบ'} ได้แค่คำถามที่ตอบ ใช่/ไม่ใช่ แล้วทายคำให้ได้ • หมวด: ${s.question_text}`}</p></div>
            {iMaster&&<button className="btn text-xl py-5" onClick={()=>call('insider_guessed',{p_session:s.id})}>✅ มีคนทายถูกแล้ว!</button>}
            <p className="text-center text-sm text-white/60">ผู้ตอบ: {insMaster?.nickname??'?'}</p></div>)
        :gt==='battle'?<Battle key={s.id} s={s} me={me} ps={ps} bp={bp} ships={bShips} hits={bHits} call={call}/>
        :gt==='king'?<div className="space-y-3">
          <p className="text-center text-lg">👑 ใครไพ่แต้มสูงสุดได้เป็นพระราชา!</p>
          {myCard?<button className="card w-full text-center py-6" aria-pressed={peek} onClick={()=>setPeek(v=>!v)}>{peek?<span className={`text-7xl font-extrabold ${redS(myCard.suit)?'text-red-400':'text-white'}`}>{myCard.face}{myCard.suit}</span>:<span className="text-6xl">🂠<br/><span className="text-sm text-white/60">แตะเพื่อดูไพ่ของคุณ (ปิดบังจากเพื่อนข้าง ๆ)</span></span>}</button>
          :<button className="btn text-xl py-6" onClick={()=>call('draw_king',{p_session:s.id})}>🃏 จั่วไพ่</button>}
          <p className="text-center text-sm text-white/60">จั่วแล้ว {kingCnt}/{ps.length} คน • ไพ่ทุกใบมาจากสำรับเดียวกัน</p></div>
        :gt==='cards'?<div className="space-y-3">
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
        :gt==='truth'&&me?.id===s.subject_id?<p className="text-center text-lg">รอเพื่อนโหวต... ({s.votes_count}/{ps.length-1})</p>
        :myVote?<p className="text-center text-lg">✓ เลือกแล้ว<br/><span className="text-white/60 text-sm">รอผู้เล่นคนอื่น... ({s.votes_count}/{gt==='truth'?ps.length-1:ps.length})</span></p>
        :gt==='truth'?<div className="grid grid-cols-2 gap-3"><button className="btn" onClick={()=>pick('true')}>✅ จริง</button><button className="btn alt" onClick={()=>pick('false')}>❌ มั่ว</button></div>
        :gt==='never'?<div className="grid grid-cols-2 gap-3"><button className="btn" onClick={()=>pick('true')}>🙋 เคย</button><button className="btn alt" onClick={()=>pick('false')}>🙅 ไม่เคย</button></div>
        :gt==='either'?<div className="space-y-3"><button className="btn" onClick={()=>pick('true')}>🅰️ {oa}</button><button className="btn alt" onClick={()=>pick('false')}>🅱️ {ob}</button></div>
        :(gt==='sync'||gt==='quiz')?<div className="space-y-2"><p className="text-center text-sm text-white/60">{gt==='quiz'?'เลือกคำตอบที่ถูกต้อง':'เลือกให้ตรงกับที่เพื่อนส่วนใหญ่จะเลือก'}</p>{opts.map((o,i)=><button key={i} className={i===0?'btn':'btn alt'} onClick={()=>pick(String(i))}>{'ABCD'[i]}. {o}</button>)}</div>
        :playerGrid}</>
      :<section className="space-y-3">
        {gt==='king'&&<>
          <div className="text-center text-6xl">👑</div>
          <h2 className="text-center text-2xl font-bold">{kingP?`${kingP.nickname} คือพระราชา!`:'ไม่มีใครจั่วไพ่'}</h2>
          <ul className="card space-y-1 text-sm">{hands.map((c,i)=><li key={c.pos} className={`flex justify-between ${i===0?'font-bold text-pink-300':''}`}><span>{i===0&&'👑 '}{ps.find(x=>x.id===c.drawn_by)?.nickname??'?'}</span><span className={redS(c.suit)?'text-red-400':''}>{c.face}{c.suit}</span></li>)}</ul>
          {kingP&&(hasCmd
            ?<div className="card text-center border-pink-400"><div className="text-sm text-white/60">พระราชามีบัญชา</div><div className="font-bold mt-1">ถึง {cmdTarget==='ALL'?'ทุกคน':(ps.find(x=>x.id===cmdTarget)?.nickname??'?')}</div><div className="text-xl mt-1">{cmdText}</div><p className="text-xs text-white/50 mt-2">ทำตามหรือรับบทลงโทษ (ดื่มน้ำ/เครื่องดื่ม หรือภารกิจเล็ก ๆ) • ไม่สบายใจจะข้ามก็ได้ ไม่ต้องฝืน</p></div>
            :iKing?<div className="card space-y-2"><h3 className="font-bold text-center">ออกคำสั่งของคุณ</h3>
              <select className="inp" aria-label="เลือกผู้รับคำสั่ง" value={tgt} onChange={e=>setTgt(e.target.value)}><option value="ALL">ทุกคน</option>{ps.filter(x=>x.id!==me?.id).map(x=><option key={x.id} value={x.id}>{x.nickname}</option>)}</select>
              <input className="inp" maxLength={200} aria-label="คำสั่ง" placeholder="เช่น ร้องเพลงท่อนฮุก หรือ ดื่ม 1 จิบ" value={cmd} onChange={e=>setCmd(e.target.value)}/>
              <button className="btn" disabled={!cmd.trim()} onClick={()=>{call('king_command',{p_session:s.id,p_target:tgt==='ALL'?null:tgt,p_text:cmd});setCmd('')}}>👑 ประกาศบัญชา</button></div>
            :<p className="text-center text-white/60">รอ {kingP.nickname} ออกคำสั่ง...</p>)}</>}
        {gt==='insider'&&<>
          <div className="text-center text-5xl">{s.outcome==='timeout'?'⌛':insWon?'🎉':'😈'}</div>
          <h2 className="text-center text-2xl font-bold">{s.outcome==='timeout'?'ทายไม่ทัน! ทุกคนแพ้':insWon?'จับ Insider ได้! ผู้ทายชนะ':'Insider รอดไปได้! Insider ชนะ'}</h2>
          <div className="card text-center space-y-1"><div>คำลับคือ <b className="text-pink-400 text-2xl">{oddK?.word||insMaster&&sec.find(k=>k.player_id===insMaster.id)?.word||'?'}</b></div>
            <div className="text-white/70">ผู้ตอบ: {insMaster?.nickname??'?'} • 😈 Insider: <b className="text-pink-400">{oddP?.nickname??'?'}</b></div></div>
          {s.outcome!=='timeout'&&tally.map(({p,n})=><Bar key={p.id} label={p.nickname+(p.id===oddK?.player_id?' 😈':'')} n={n} total={ps.length}/>)}</>}
        {gt==='battle'&&<BattleOver s={s} ps={ps} bp={bp} ships={bShips} hits={bHits}/>}
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