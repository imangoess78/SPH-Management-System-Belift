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
    //
    // Sekaligus hitung jumlah data milik tiap akun: admin perlu tahu sebelum
    // menghapus akun bahwa data miliknya akan kehilangan pemilik.
    const data = await Promise.all((results || []).map(async r => {
      const milik = await hitungMilik(env, r.id, r.email, r.full_name);
      return {
        ...r,
        role: normalisasiPeran(r.role),
        permissions: bersihkanIzin(r.permissions ? JSON.parse(r.permissions) : null),
        izin_efektif: izinEfektif(r.role, r.permissions),
        milik,
      };
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

    // Jangan hapus akun yang masih punya dokumen. Kepemilikan dokumen disimpan
    // lewat `user_id` dan `nama_sales`. Kalau akunnya dihapus, dokumen itu
    // kehilangan pemilik dan tidak lagi terlihat sales mana pun — persis yang
    // terjadi pada 8 dokumen ber-user_id tak dikenal.
    const dipaksa = url.searchParams.get('paksa') === '1';
    const milik = await hitungMilik(env, id, target.email, target.full_name);
    if (milik.total > 0 && !dipaksa) {
      return json({
        error: `Akun ini masih memiliki ${milik.total} dokumen/data. Menghapusnya membuat data itu tidak terlihat sales mana pun. Sebaiknya nonaktifkan saja, atau pindahkan datanya dulu.`,
        milik,
        butuhKonfirmasi: true,
      }, 409);
    }

    await env.sph_management_db.prepare('DELETE FROM app_sessions WHERE user_id=?').bind(id).run();
    await env.sph_management_db.prepare('DELETE FROM app_users WHERE id=?').bind(id).run();
    await catatRiwayatIzin(env, {
      idUser: id, olehUserId: akses.userId, olehNama: akses.nama,
      roleLama: target.role, roleBaru: null, izinLama: target.permissions, izinBaru: null,
    });
    return json({ ok: true, dihapus: milik.total });
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

    if (fields.status !== undefined && !['approved', 'nonaktif', 'pending', 'rejected'].includes(String(fields.status))) {
      return json({ error: 'Status tidak valid. Pilihan: approved, nonaktif, pending, rejected' }, 400);
    }

    // Menonaktifkan diri sendiri akan langsung memutus sesi sendiri — bisa
    // membuat admin terkunci di luar. Tolak.
    if (id === akses.userId && fields.status !== undefined && fields.status !== 'approved') {
      return json({ error: 'Tidak dapat menonaktifkan akun sendiri' }, 400);
    }

    // Menonaktifkan pengelola akun terakhir = sistem tak bisa dikelola lagi.
    if (fields.status !== undefined && fields.status !== 'approved') {
      const izinTarget = izinEfektif(target.role, target.permissions);
      const targetKelolaAkun = izinTarget.includes('akun') || izinTarget.includes('*');
      if (targetKelolaAkun && (await jumlahPengelolaAkun(env, id)) === 0) {
        return json({
          error: 'Ini satu-satunya akun yang bisa mengelola akun. Angkat pengelola lain dulu sebelum dinonaktifkan.',
        }, 400);
      }
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

/**
 * Hitung data milik sebuah akun. Dipakai sebelum menghapus akun: kalau masih
 * ada data, penghapusan akan membuat data itu kehilangan pemilik.
 *
 * Dicocokkan lewat `user_id` (paling pasti) dan nama sales sebagai cadangan.
 * Setiap tabel dibungkus try/catch supaya kolom yang belum ada di satu
 * lingkungan tidak membuat seluruh pemeriksaan gagal.
 */
async function hitungMilik(
  env: Env, userId: string, email: string, nama: string | null,
): Promise<{ sph: number; lead: number; survey: number; po: number; total: number }> {
  const n = (v: unknown) => (typeof v === 'number' ? v : Number((v as any)?.n) || 0);

  const hitung = async (sql: string, ...bind: unknown[]) => {
    try {
      const r = await env.sph_management_db.prepare(sql).bind(...bind).first<any>();
      return n(r);
    } catch { return 0; }
  };

  const nm = (nama || '').trim();
  const sph = await hitung(
    `SELECT COUNT(*) n FROM sph WHERE user_id=?
       OR (user_id IS NULL AND ?<>'' AND lower(trim(coalesce(nama_sales,''))) = lower(?))`,
    userId, nm, nm);
  const lead = await hitung(
    `SELECT COUNT(*) n FROM crm_leads WHERE ?<>'' AND lower(trim(coalesce(sales,''))) = lower(?)`,
    nm, nm);
  const survey = await hitung(
    `SELECT COUNT(*) n FROM survey_teknis WHERE dibuat_oleh=? OR diubah_oleh=? OR disurvey_oleh=?`,
    userId, userId, userId);
  const po = await hitung(
    `SELECT COUNT(*) n FROM po_pabrik WHERE dibuat_oleh=?`, userId);

  return { sph, lead, survey, po, total: sph + lead + survey + po };
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
