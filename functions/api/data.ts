import type { PagesFunction } from '@cloudflare/workers-types';
import { boleh } from '../../shared/akses';
import { json, wajibHalaman, type Akses } from '../lib/akses';

interface Env { sph_management_db: D1Database }

const jsonColumns = new Set(['specs', 'items', 'payments', 'terms', 'designs', 'include_ppn']);

/**
 * Tabel yang boleh diakses lewat endpoint generik ini, beserta halaman yang
 * mengawasinya. `sph` = dokumen penawaran/kontrak, `sales` = daftar sales.
 */
const TABEL: Record<string, { halaman: 'sph' | 'master'; pemilik?: string }> = {
  sph: { halaman: 'sph', pemilik: 'nama_sales' },
  sales: { halaman: 'master' },
  design_items: { halaman: 'master' },
  profiles: { halaman: 'master' },
  user_roles: { halaman: 'master' },
};

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const table = url.searchParams.get('table') || '';
  const aturan = TABEL[table];
  if (!aturan) return json({ error: 'Invalid table' }, 400);

  const cek = await wajibHalaman(request, env, aturan.halaman);
  if ('tolak' in cek) return cek.tolak;
  const akses: Akses = cek.akses;

  const id = url.searchParams.get('id');

  // ── Batasan kepemilikan untuk dokumen SPH/SPK ──
  // Sales hanya boleh melihat dokumennya sendiri. Dicocokkan lewat `user_id`
  // (paling pasti) atau `nama_sales` (cadangan untuk dokumen lama).
  //
  // Penting: dokumen yang `user_id`-nya menunjuk ke akun yang TIDAK ADA di
  // app_users TIDAK dianggap milik siapa pun. Kalau tidak begitu, dokumen itu
  // akan muncul di daftar setiap sales — kebocoran yang justru terlihat seperti
  // "data lengkap" sehingga tidak disadari.
  const batasPemilik = aturan.pemilik && akses.cakupanLihat === 'sendiri'
    ? `((user_id = ? AND user_id IN (SELECT id FROM app_users))
        OR (user_id IS NULL AND lower(trim(coalesce(nama_sales,''))) <> ''
            AND lower(trim(nama_sales)) IN (lower(trim(?)), lower(trim(?)))))`
    : null;
  const paramPemilik = batasPemilik ? [akses.userId, akses.namaSales, akses.nama] : [];

  if (request.method === 'GET') {
    let sql = `SELECT * FROM ${table}`;
    const params: unknown[] = [];
    const where: string[] = [];

    if (id) { where.push('id = ?'); params.push(id); }
    else if (table === 'sph' && url.searchParams.get('status')) {
      where.push('status = ?'); params.push(url.searchParams.get('status')!);
    }
    if (batasPemilik) { where.push(batasPemilik); params.push(...paramPemilik); }

    if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
    else sql += ' ORDER BY created_at DESC';

    const result = await env.sph_management_db.prepare(sql).bind(...params).all();
    const data = (result.results || []).map((row: any) => {
      const out = { ...row };
      for (const k of jsonColumns) {
        if (typeof out[k] === 'string') { try { out[k] = JSON.parse(out[k]); } catch { /* biarkan */ } }
      }
      return out;
    });
    return json({ data });
  }

  // ── Ubah data: perlu wewenang ubah ──
  if (request.method === 'POST' || request.method === 'PUT') {
    if (akses.cakupanUbah === 'tidak') {
      return json({ error: 'Peran Anda tidak berwenang mengubah data.' }, 403);
    }

    const body = await request.json() as Record<string, unknown>;

    // Menyentuh dokumen milik orang lain butuh izin ubah_semua.
    if (request.method === 'PUT') {
      if (!id) return json({ error: 'id required' }, 400);
      if (batasPemilik) {
        const milik = await env.sph_management_db
          .prepare(`SELECT 1 AS ok FROM ${table} WHERE id=? AND ${batasPemilik}`)
          .bind(id, ...paramPemilik).first();
        if (!milik) return json({ error: 'Dokumen ini bukan milik Anda.' }, 403);
      }
    }

    const clean = Object.fromEntries(
      Object.entries(body)
        .filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k))
        .map(([k, v]) => [k, jsonColumns.has(k) && typeof v !== 'string' ? JSON.stringify(v) : v]),
    );

    // Dokumen baru otomatis milik pembuatnya bila belum ditentukan.
    if (request.method === 'POST' && !boleh(akses.izin, 'ubah_semua')) {
      clean.user_id = akses.userId;
      if (!clean.nama_sales) clean.nama_sales = akses.namaSales;
    }

    if (request.method === 'PUT') {
      const entries = Object.entries(clean);
      if (!entries.length) return json({ error: 'Tidak ada perubahan' }, 400);
      const result = await env.sph_management_db
        .prepare(`UPDATE ${table} SET ${entries.map(([k]) => `${k}=?`).join(',')}, updated_at=? WHERE id=?`)
        .bind(...entries.map(([, v]) => v), new Date().toISOString(), id).run();
      // PENTING: UPDATE yang tidak mengenai baris mana pun tetap "sukses" di D1
      // (changes: 0, tanpa error). Kalau ini dianggap berhasil, klien tidak akan
      // pernah jatuh ke jalur POST dan dokumen baru hilang tanpa jejak.
      if (!result.meta?.changes) {
        return json({ error: 'Not found', kode: 'TIDAK_ADA' }, 404);
      }
    } else {
      const newId = String(body.id || crypto.randomUUID());
      const entries = Object.entries({
        ...clean, id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      await env.sph_management_db
        .prepare(`INSERT INTO ${table} (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`)
        .bind(...entries.map(([, v]) => v)).run();
    }
    return json({ ok: true });
  }

  // ── Hapus data: perlu wewenang hapus ──
  if (request.method === 'DELETE') {
    if (!id) return json({ error: 'id required' }, 400);
    if (!boleh(akses.izin, 'hapus_data')) {
      return json({ error: 'Peran Anda tidak berwenang menghapus data.' }, 403);
    }
    if (batasPemilik) {
      const milik = await env.sph_management_db
        .prepare(`SELECT 1 AS ok FROM ${table} WHERE id=? AND ${batasPemilik}`)
        .bind(id, ...paramPemilik).first();
      if (!milik) return json({ error: 'Dokumen ini bukan milik Anda.' }, 403);
    }
    const result = await env.sph_management_db.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();
    if (!result.meta?.changes) return json({ error: 'Not found' }, 404);
    return json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
};
