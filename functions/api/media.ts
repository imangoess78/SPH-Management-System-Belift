import type { PagesFunction } from '@cloudflare/workers-types';
interface Env { belift_media: R2Bucket; sph_management_db: D1Database }
function keyFor(bucket:string,path:string){ return `recovery/2026-08-19/${bucket}/${path.replace(/^\//,'')}`; }
async function authorized(request:Request,env:Env){const sid=(request.headers.get('cookie')||'').match(/(?:^|; )sph_session=([^;]+)/)?.[1]; if(!sid)return false; return !!(await env.sph_management_db.prepare('SELECT 1 FROM app_sessions WHERE id=? AND expires_at>?').bind(sid,new Date().toISOString()).first());}
export const onRequest: PagesFunction<Env> = async ({request,env}) => {
 if(request.method==='POST' && !(await authorized(request,env))) return new Response('Unauthorized',{status:401});
 if(request.method==='POST'){const form=await request.formData(), file=form.get('file'), bucket=String(form.get('bucket')||''), path=String(form.get('path')||''); if(!(file instanceof File)||!['design-images','signatures'].includes(bucket)||!/^[A-Za-z0-9._-]+$/.test(path))return Response.json({error:'Invalid upload'},{status:400}); const key=keyFor(bucket,path); await env.belift_media.put(key,file.stream(),{httpMetadata:{contentType:file.type||'application/octet-stream'}}); return Response.json({url:`/api/media?key=${encodeURIComponent(key)}`});}
 const key=new URL(request.url).searchParams.get('key')||''; if(!/^recovery\/2026-08-19\/(design-images|signatures)\/[A-Za-z0-9._-]+$/.test(key))return new Response('Not found',{status:404}); const object=await env.belift_media.get(key); if(!object)return new Response('Not found',{status:404}); const headers=new Headers(); object.writeHttpMetadata(headers); headers.set('etag',object.httpEtag); headers.set('cache-control','private, max-age=3600'); return new Response(object.body,{headers});
};
