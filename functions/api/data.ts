import type { PagesFunction } from '@cloudflare/workers-types';
interface Env { sph_management_db: D1Database }
const allowed = new Set(['sph','design_items','sales','profiles','user_roles']);
export const onRequestGet: PagesFunction<Env> = async ({request,env}) => {
  const cookie=request.headers.get('cookie')||'';
  const sid=cookie.match(/(?:^|; )sph_session=([^;]+)/)?.[1];
  if(!sid) return Response.json({error:'Unauthorized'},{status:401});
  const session=await env.sph_management_db.prepare('SELECT user_id FROM app_sessions WHERE id=? AND expires_at>?').bind(sid,new Date().toISOString()).first<{user_id:string}>();
  if(!session) return Response.json({error:'Unauthorized'},{status:401});
  const url=new URL(request.url), table=url.searchParams.get('table')||'';
  if(!allowed.has(table)) return Response.json({error:'Invalid table'},{status:400});
  const query = url.searchParams;
  const id = query.get('id');
  const status = query.get('status');
  let statement = `SELECT * FROM ${table}`;
  const params: string[] = [];
  if (table === 'sph' && id) { statement += ' WHERE id=?'; params.push(id); }
  else if (table === 'sph' && status) { statement += ' WHERE status=?'; params.push(status); }
  else statement += ' ORDER BY created_at DESC';
  const result=await env.sph_management_db.prepare(statement).bind(...params).all();
  const jsonColumns = new Set(['specs','items','payments','terms','include_ppn']);
  const data=(result.results||[]).map((row:any)=>{
    const out={...row};
    for(const key of jsonColumns){
      if(typeof out[key] !== 'string') continue;
      try { out[key]=JSON.parse(out[key]); } catch { /* keep scalar */ }
    }
    return out;
  });
  return Response.json({data});
};
