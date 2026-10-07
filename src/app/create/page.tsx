'use client'
import Link from 'next/link'
import {useState} from 'react'
import {useRouter} from 'next/navigation'
import {supabase,ensureAuth} from '@/lib/supabase'
export default function Create(){
  const [n,setN]=useState('');const [busy,setB]=useState(false);const [err,setE]=useState('');const r=useRouter()
  async function go(){setB(true);setE('')
    try{await ensureAuth();const {data,error}=await supabase.rpc('create_room',{p_nickname:n});if(error)throw error;r.push(`/room/${data}`)}
    catch(e){setE(e instanceof Error?e.message:JSON.stringify(e));setB(false)}}
  return(<main className="max-w-md mx-auto p-6 min-h-dvh flex flex-col justify-center gap-4 text-center">
    <Link href="/" aria-label="กลับหน้าแรก" className="fixed left-4 top-[calc(env(safe-area-inset-top)+1rem)] px-4 py-2 rounded-full bg-white/10 border border-white/20 text-sm active:scale-95 transition-transform">← กลับ</Link>
    <div className="text-6xl">🍻</div><h1 className="text-3xl font-bold">สร้างห้อง</h1>
    <label className="text-left text-sm text-white/70" htmlFor="n">ชื่อของคุณ</label>
    <input id="n" className="inp" maxLength={20} value={n} onChange={e=>setN(e.target.value)} placeholder="เช่น Bank"/>
    {err&&<p role="alert" className="text-pink-400">{err}</p>}
    <button className="btn" disabled={busy||!n.trim()} onClick={go}>🎉 สร้างห้อง</button></main>)}
