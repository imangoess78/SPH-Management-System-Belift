import type { PagesFunction } from '@cloudflare/workers-types';
import type { D1Database } from '@cloudflare/workers-types';
import { izinEfektif, normalisasiPeran } from '../../../shared/akses';

interface Env { sph_management_db: D1Database }

/**
 * Sesi + hak akses efektif.
 *
 * Izin dikirim ke tampilan supaya menu bisa disembunyikan. Tapi ingat:
 * tampilan hanya menyembunyikan, tidak mengamankan. Penolakan yang
 * sebenarnya terjadi di setiap endpoint (functions/lib/akses.ts).
 */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const sid = (request.headers.get('cookie') || '').match(/(?:^|; )sph_session=([^;]+)/)?.[1];
  const noStore = { 'cache-control': 'no-store, no-cache, must-revalidate' };

  if (!sid) return Response.json({ user: null }, { headers: noStore });

  const u = await env.sph_management_db
    .prepare(`SELECT u.id, u.email, u.role, u.full_name, u.status, u.permissions
              FROM app_sessions s JOIN app_users u ON u.id = s.user_id
              WHERE s.id=? AND s.expires_at>? AND u.status='approved'`)
    .bind(sid, new Date().toISOString())
    .first<{ id: string; email: string; role: string; full_name: string | null; status: string; permissions: string | null }>();

  if (!u) return Response.json({ user: null }, { headers: noStore });

  // Nama sales untuk pencocokan kepemilikan data (kolom `sales` pada leads).
  const ref = await env.sph_management_db
    .prepare('SELECT nama FROM crm_ref_sales WHERE lower(email)=lower(?) LIMIT 1')
    .bind(u.email).first<{ nama: string }>();

  return Response.json({
    user: {
      id: u.id,
      email: u.email,
      role: normalisasiPeran(u.role),
      fullName: u.full_name,
      permissions: izinEfektif(u.role, u.permissions),
      namaSales: ref?.nama || u.full_name || u.email,
    },
  }, { headers: noStore });
};
