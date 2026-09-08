import type { PagesFunction } from '@cloudflare/workers-types';
interface Env { sph_management_db: D1Database }
const enc = new TextEncoder();
function b64(bytes: ArrayBuffer) { let out=''; for (const byte of new Uint8Array(bytes)) out += String.fromCharCode(byte); return btoa(out); }
async function derive(password:string,salt:string){const key=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},key,256);return b64(bits);}
export const onRequestPost: PagesFunction<Env> = async ({request,env}) => {
  let body:{email?:string;password?:string;fullName?:string}; try{body=await request.json()}catch{return Response.json({error:'Request tidak valid'},{status:400})}
  const email=String(body.email||'').trim().toLowerCase(), password=String(body.password||''), fullName=String(body.fullName||'').trim();
  if(!email||!password||!fullName)return Response.json({error:'Nama, email, dan password wajib diisi'},{status:400});
  if(password.length<8)return Response.json({error:'Password minimal 8 karakter'},{status:400});
  const exists=await env.sph_management_db.prepare('SELECT id FROM app_users WHERE email=? COLLATE NOCASE').bind(email).first();
  if(exists)return Response.json({error:'Email sudah terdaftar'},{status:409});
  const id=crypto.randomUUID(), salt=crypto.randomUUID().replaceAll('-',''), now=new Date().toISOString();
  const hash=`${salt}$${await derive(password,salt)}`;
  await env.sph_management_db.prepare('INSERT INTO app_users(id,email,password_hash,role,full_name,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,email,hash,'staff',fullName,'pending',now,now).run();
  return Response.json({ok:true,message:'Pendaftaran berhasil. Tunggu persetujuan Admin sebelum login.'},{status:201});
};
