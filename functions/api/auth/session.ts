import type { PagesFunction } from '@cloudflare/workers-types';
interface Env { sph_management_db: D1Database }
export const onRequestGet: PagesFunction<Env> = async ({request,env}) => {
 const sid=(request.headers.get('cookie')||'').match(/(?:^|; )sph_session=([^;]+)/)?.[1];
 if(!sid)return Response.json({user:null});
 const u=await env.sph_management_db.prepare('SELECT u.id,u.email,u.role,u.full_name FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?').bind(sid,new Date().toISOString()).first<any>();
 return Response.json({user:u?{id:u.id,email:u.email,role:u.role,fullName:u.full_name}:null});
};
