import type { PagesFunction } from '@cloudflare/workers-types';
import type { D1Database } from '@cloudflare/workers-types';
import { PERAN, SEMUA_KUNCI, izinEfektif, normalisasiPeran } from '../../../shared/akses';
import { catatRiwayatIzin, json, wajibHalaman, type Akses } from '../../lib/akses';

interface Env { sph_management_db: D1Database }

const KOLOM = 'id,email,full_name,role,status,permissions,approved_at,approved_by,rejection_reason,created_at,updated_at';

/** Saring daftar izin dari masukan: buang kunci tak dikenal, buang duplikat. */
function bersihkanIzin(v: unknown): string[] | null {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v)) return null;
  const sah = new Set<string>(SEMUA_KUNCI as string[]);
  return Array.from(new Set(v.map(String).filter(k => sah.has(k))));
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const cek = await wajibHalaman(request, env, 'akun');
  if ('tolak' in cek) return cek.tolak;
  const akses: Akses = cek.akses;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  // ── Daftar akun ──
  if (request.method === 'GET') {
    const { results } = await env.sph_management_db
      .prepare(`SELECT ${KOLOM} FROM app_users ORDER BY created_at DESC`)
      .all<any>();

    // Sertakan izin efektif supaya tampilan tidak perlu menghitung ulang —
    // kalau dihitung dua kali, bisa berbeda.
    const data = (results || []).map(r => ({
      ...r,
      role: normalisasiPeran(r.role),
      permissions: bersihkanIzin(r.permissions ? JSON.parse(r.permissions) : null),
      izin_efektif: izinEfektif(r.role, r.permissions),
    }));

    return json({ data });
  }

  if (!id) return json({ error: 'id required' }, 400);

  const target = await env.sph_management_db
    .prepare('SELECT id,email,full_name,role,permissions FROM app_users WHERE id=?')
    .bind(id).first<any>();
  if (!target) return json({ error: 'Akun tidak ditemukan' }, 404);

  // ── Hapus akun ──
  if (request.method === 'DELETE') {
    if (id === akses.userId) return json({ error: 'Tidak dapat menghapus akun sendiri' }, 400);

    // Jangan sampai admin terakhir terhapus dan sistem tak bisa dikelola lagi.
    const sisa = await jumlahPengelolaAkun(env, id);
    if (sisa === 0) {
      return json({ error: 'Ini satu-satunya akun yang bisa mengelola akun. Angkat pengelola lain dulu.' }, 400);
    }

    await env.sph_management_db.prepare('DELETE FROM app_sessions WHERE user_id=?').bind(id).run();
    await env.sph_management_db.prepare('DELETE FROM app_users WHERE id=?').bind(id).run();
    return json({ ok: true });
  }

  // ── Ubah akun ──
  if (request.method === 'PUT') {
    const b = await request.json() as any;
    const fields: Record<string, unknown> = {};
    for (const k of ['full_name', 'role', 'status', 'rejection_reason']) {
      if (b[k] !== undefined) fields[k] = b[k];
    }

    if (fields.role !== undefined && !(PERAN as readonly string[]).includes(String(fields.role))) {
      return json({ error: `Role tidak valid. Pilihan: ${PERAN.join(', ')}` }, 400);
    }

    // Izin: `null` = kembali ke bawaan peran, array = izin khusus.
    let izinBaru: string[] | null | undefined;
    if (b.permissions !== undefined) {
      izinBaru = bersihkanIzin(b.permissions);
      if (izinBaru === null && b.permissions !== null) {
        return json({ error: 'permissions harus berupa array atau null' }, 400);
      }
    }

    // Pengaman: jangan biarkan seseorang mencabut wewenang kelola akun miliknya
    // sendiri — itu mengunci dirinya keluar dari halaman ini.
    if (id === akses.userId) {
      const roleBaru = fields.role !== undefined ? normalisasiPeran(String(fields.role)) : normalisasiPeran(target.role);
      const izinSetelah = izinBaru !== undefined
        ? (izinBaru ?? izinEfektif(roleBaru, null))
        : izinEfektif(roleBaru, target.permissions);
      if (!izinSetelah.includes('akun') && !izinSetelah.includes('*')) {
        return json({
          error: 'Tidak dapat mencabut wewenang Manajemen Akun dari akun sendiri. Minta admin lain melakukannya.',
        }, 400);
      }
    }

    // Pengaman: jangan biarkan pengelola akun terakhir kehilangan wewenangnya.
    if (izinBaru !== undefined || fields.role !== undefined) {
      const roleBaru = fields.role !== undefined ? normalisasiPeran(String(fields.role)) : normalisasiPeran(target.role);
      const izinSetelah = izinBaru !== undefined ? izinBaru : izinEfektif(roleBaru, target.permissions);
      const tetapPengelola = izinSetelah.includes('akun') || izinSetelah.includes('*');
      if (!tetapPengelola && (await jumlahPengelolaAkun(env, id)) === 0) {
        return json({
          error: 'Ini satu-satunya akun yang bisa mengelola akun. Angkat pengelola lain dulu.',
        }, 400);
      }
    }

    if (izinBaru !== undefined) fields.permissions = izinBaru === null ? null : JSON.stringify(izinBaru);
    if (fields.status === 'approved') {
      fields.approved_at = new Date().toISOString();
      fields.approved_by = akses.userId;
    }

    const entries = Object.entries(fields);
    if (!entries.length) return json({ error: 'Tidak ada perubahan' }, 400);

    await env.sph_management_db.prepare(
      `UPDATE app_users SET ${entries.map(([k]) => `${k}=?`).join(',')},updated_at=? WHERE id=?`,
    ).bind(...entries.map(([, v]) => v), new Date().toISOString(), id).run();

    // Catat siapa mengubah hak akses siapa.
    await catatRiwayatIzin(env, {
      idUser: id,
      olehUserId: akses.userId,
      olehNama: akses.nama,
      roleLama: target.role,
      roleBaru: fields.role !== undefined ? String(fields.role) : null,
      izinLama: target.permissions,
      izinBaru: izinBaru !== undefined ? (izinBaru === null ? null : JSON.stringify(izinBaru)) : null,
    });

    // Perubahan hak akses harus langsung berlaku — sesi lama masih membawa
    // izin lama bila tidak diputus.
    if (izinBaru !== undefined || fields.role !== undefined || fields.status !== undefined) {
      await env.sph_management_db.prepare('DELETE FROM app_sessions WHERE user_id=? AND id!=?')
        .bind(id, idSesiDari(request) || '').run();
    }

    if (fields.status && fields.status !== 'approved') {
      await env.sph_management_db.prepare('DELETE FROM app_sessions WHERE user_id=?').bind(id).run();
    }

    return json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
};

function idSesiDari(request: Request): string | null {
  return (request.headers.get('cookie') || '').match(/(?:^|; )sph_session=([^;]+)/)?.[1] || null;
}

/** Hitung berapa akun (selain `kecuali`) yang masih bisa mengelola akun. */
async function jumlahPengelolaAkun(env: Env, kecuali: string): Promise<number> {
  const { results } = await env.sph_management_db
    .prepare(`SELECT id, role, permissions FROM app_users WHERE id!=? AND status='approved'`)
    .bind(kecuali).all<any>();

  return (results || []).filter(r => {
    const izin = izinEfektif(r.role, r.permissions);
    return izin.includes('akun') || izin.includes('*');
  }).length;
}
