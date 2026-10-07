import {createClient} from '@supabase/supabase-js'
export const supabase=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export async function ensureAuth(){
  const {data}=await supabase.auth.getSession()
  if(data.session)return data.session.user.id
  const r=await supabase.auth.signInAnonymously()
  if(r.error||!r.data.user)throw new Error('AUTH_FAILED: '+(r.error?.message??'no user'))
  return r.data.user.id
}