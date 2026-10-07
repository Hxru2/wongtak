# 🍻 วงแตก
1. Supabase: สร้างโปรเจกต์ → Authentication > Providers > เปิด Anonymous sign-ins → SQL Editor วาง `supabase/schema.sql` แล้ว Run
2. คัดลอก `.env.local.example` เป็น `.env.local` ใส่ URL และ anon key (Project Settings > API)
3. `npm install` แล้ว `npm run dev` เปิด http://localhost:3000
4. Deploy: push GitHub → vercel.com Import → ใส่ env 2 ตัว → Deploy
