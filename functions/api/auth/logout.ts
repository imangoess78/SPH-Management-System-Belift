import type { PagesFunction } from '@cloudflare/workers-types';
interface Env { sph_management_db: D1Database }
export const onRequestPost: PagesFunction<Env> = async ({request,env}) => {
 const sid=(request.headers.get('cookie')||'').match(/(?:^|; )sph_session=([^;]+)/)?.[1];
 if(sid) await env.sph_management_db.prepare('DELETE FROM app_sessions WHERE id=?').bind(sid).run();
 return new Response(null,{status:204,headers:{'set-cookie':'sph_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'}});
};
