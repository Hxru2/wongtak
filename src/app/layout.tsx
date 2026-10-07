import './globals.css'
import type {Viewport} from 'next'
export const metadata={title:'วงแตก 🍻',description:'รวมแก๊งให้ครบ แล้วมาดูกันว่าใครจะวงแตกก่อน'}
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0b0b12'}
export default function L({children}:{children:React.ReactNode}){return <html lang="th"><body>{children}</body></html>}