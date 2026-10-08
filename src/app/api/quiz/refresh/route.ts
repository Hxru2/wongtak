import {NextRequest,NextResponse} from 'next/server'
import {createClient} from '@supabase/supabase-js'
export const dynamic='force-dynamic'
const dec=(s:string)=>decodeURIComponent(s).replace(/\|/g,'/')
type Item={category:string;question:string;correct_answer:string;incorrect_answers:string[]}
export async function GET(req:NextRequest){
  const secret=process.env.CRON_SECRET
  const ok=secret&&(req.headers.get('authorization')===`Bearer ${secret}`||req.nextUrl.searchParams.get('key')===secret)
  if(!ok)return NextResponse.json({error:'unauthorized'},{status:401})
  const res=await fetch('https://opentdb.com/api.php?amount=50&type=multiple&encode=url3986',{cache:'no-store'})
  const j=await res.json()
  if(j.response_code!==0)return NextResponse.json({error:'source',code:j.response_code},{status:502})
  const rows=(j.results as Item[]).map(r=>({source:'opentdb',lang:'en',category:dec(r.category),question:dec(r.question),correct:dec(r.correct_answer),wrong:r.incorrect_answers.map(dec)}))
  const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const {error}=await db.from('quiz_questions').upsert(rows,{onConflict:'question',ignoreDuplicates:true})
  if(error)return NextResponse.json({error:error.message},{status:500})
  return NextResponse.json({fetched:rows.length})
}