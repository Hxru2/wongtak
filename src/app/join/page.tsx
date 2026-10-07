'use client'
import Link from 'next/link'
import {Suspense,useState} from 'react'
import {useRouter,useSearchParams} from 'next/navigation'
import {supabase,ensureAuth} from '@/lib/supabase'
const MSG:Record<string,string>={ROOM_NOT_FOUND:'😵 หาห้องไม่เจอ',ROOM_FULL:'😵 ห้องเต็มแล้ว',ROOM_EXPIRED:'⌛ ห้องนี้หมดอายุแล้ว',ROOM_IN_GAME:'ห้องกำลังเล่นอยู่ รอรอบหน้านะ'}
function Form(){
  const q=useSearchParams();const [c,setC]=useState((q.get('room')||'').toUpperCase());const [n,setN]=useState('');const [err,setE]=useState('');const [busy,setB]=useState(false);const r=useRouter()
  async function go(){setB(true);setE('')
    try{await ensureAuth();const {error}=await supabase.rpc('join_room',{p_code:c,p_nickname:n});if(error)throw error;r.push(`/room/${c}`)}
    catch(e){const m=(e as {message?:string}).message||'';setE(MSG[m]||'เข้าห้องไม่สำเร็จ');setB(false)}}
  return(<main className="max-w-md mx-auto p-6 min-h-dvh flex flex-col justify-center gap-4 text-center">
    <Link href="/" aria-label="กลับหน้าแรก" className="fixed left-4 top-[calc(env(safe-area-inset-top)+1rem)] px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm active:scale-95 transition-transform">← กลับ</Link>
    <div className="text-6xl">🚪</div><h1 className="text-3xl font-bold">เข้าร่วมห้อง</h1>
    <label className="text-left text-sm text-white/70" htmlFor="c">ROOM CODE</label>
    <input id="c" className="inp text-center tracking-[.4em] font-mono uppercase" maxLength={6} value={c} onChange={e=>setC(e.target.value.toUpperCase())}/>
    <label className="text-left text-sm text-white/70" htmlFor="n">ชื่อของคุณ</label>
    <input id="n" className="inp" maxLength={20} value={n} onChange={e=>setN(e.target.value)}/>
    {err&&<p role="alert" className="text-pink-400">{err}</p>}
    <button className="btn" disabled={busy||c.length!==6||!n.trim()} onClick={go}>🚀 เข้าร่วม</button></main>)}
export default function Join(){return <Suspense><Form/></Suspense>}
