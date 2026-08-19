import type { PagesFunction } from '@cloudflare/workers-types';
interface Env { sph_management_db: D1Database }
const enc = new TextEncoder();
function b64(bytes: ArrayBuffer) {
  let out = '';
  for (const byte of new Uint8Array(bytes)) out += String.fromCharCode(byte);
  return btoa(out);
}
async function derive(password: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:120000,hash:'SHA-256'}, key, 256);
  return b64(bits);
}
export const onRequestPost: PagesFunction<Env> = async ({request,env}) => {
  let body: {email?:string;password?:string};
  try { body=await request.json(); } catch { return Response.json({error:'Request tidak valid'},{status:400}); }
  if (!body.email || !body.password) return Response.json({error:'Email dan password wajib diisi'},{status:400});
  const user=await env.sph_management_db.prepare('SELECT id,email,role,full_name,password_hash FROM app_users WHERE email=? COLLATE NOCASE').bind(body.email.trim()).first<any>();
  if (!user) return Response.json({error:'Email atau password salah'},{status:401});
  const [salt,expected]=String(user.password_hash).split('$');
  if (!salt || (await derive(body.password,salt))!==expected) return Response.json({error:'Email atau password salah'},{status:401});
  const sid=crypto.randomUUID(), now=new Date().toISOString(), exp=new Date(Date.now()+7*86400000).toISOString();
  await env.sph_management_db.prepare('INSERT INTO app_sessions(id,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(sid,user.id,exp,now).run();
  return new Response(JSON.stringify({user:{id:user.id,email:user.email,role:user.role,fullName:user.full_name}}),{headers:{'content-type':'application/json','set-cookie':`sph_session=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`}});
};
