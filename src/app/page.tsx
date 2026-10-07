import Link from 'next/link'
export default function Home(){return(
<main className="min-h-dvh flex flex-col items-center justify-center gap-6 p-6 text-center max-w-md mx-auto">
<div className="text-8xl fl" aria-hidden>🍻</div>
<h1 className="text-5xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">วงแตก</h1>
<p className="text-lg text-white/80">รวมแก๊งให้ครบ แล้วเริ่มความวุ่นวาย<br/><span className="text-sm text-white/50">เล่นฟรี • ไม่ต้องสมัคร • เล่นบนมือถือ</span></p>
<div className="w-full space-y-3"><Link className="btn text-center" href="/create">🎉 สร้างห้อง</Link><Link className="btn alt text-center" href="/join">🚪 เข้าร่วมห้อง</Link></div>
</main>)}
