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
    const peta = await hitungMilikSemua(env);
    const data = (results || []).map(r => ({
      ...r,
      role: normalisasiPeran(r.role),
      permissions: bersihkanIzin(r.permissions ? JSON.parse(r.permissions) : null),
      izin_efektif: izinEfektif(r.role, r.permissions),
      milik: ambilMilik(peta, r.id, r.full_name),
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
      // `izinBaru === null` berarti "kembali ke bawaan peran baru", jadi yang
      // berlaku adalah izin bawaan — BUKAN null. Sebelumnya nilai null dipakai
      // langsung, lalu `null.includes('akun')` melempar TypeError dan seluruh
      // permintaan gagal dengan error 1101. Akibatnya tombol ganti peran
      // tampak "tidak berfungsi" — padahal server sedang crash.
      const izinSetelah = izinBaru === undefined
        ? izinEfektif(roleBaru, target.permissions)
        : (izinBaru ?? izinEfektif(roleBaru, null));
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

type Milik = { sph: number; lead: number; survey: number; po: number; total: number };
type PetaMilik = { perUserId: Map<string, Milik>; perNama: Map<string, Milik> };

const kosong = (): Milik => ({ sph: 0, lead: 0, survey: 0, po: 0, total: 0 });

/**
 * Hitung data milik SETIAP akun sekaligus dengan beberapa kueri agregat.
 *
 * Sengaja TIDAK dilakukan satu kueri per akun: D1 akan gagal diam-diam bila
 * puluhan kueri ditembakkan bersamaan lewat Promise.all — dan kegagalan itu
 * sempat tersamarkan sebagai "0 data" (jadi admin diberi tahu akunnya kosong
 * padahal berisi). Satu kueri agregat jauh lebih andal.
 *
 * Tiap kueri dibungkus try/catch supaya kolom yang belum ada di satu lingkungan
 * tidak mematikan seluruh pemeriksaan.
 */
async function hitungMilikSemua(env: Env): Promise<PetaMilik> {
  const perUserId = new Map<string, Milik>();
  const perNama = new Map<string, Milik>();
  const ambil = (m: Map<string, Milik>, kunci: string) => {
    if (!kunci) return kosong();
    if (!m.has(kunci)) m.set(kunci, kosong());
    return m.get(kunci)!;
  };

  const jalankan = async (sql: string) => {
    try {
      const { results } = await env.sph_management_db.prepare(sql).all<any>();
      return results || [];
    } catch { return []; }
  };

  // SPH/SPK — dipisah supaya TIDAK terhitung dobel.
  // Baris yang sudah punya user_id dihitung lewat user_id; pencocokan nama
  // hanya untuk baris lama yang belum punya user_id.
  for (const r of await jalankan(
    `SELECT user_id, COUNT(*) n FROM sph WHERE user_id IS NOT NULL GROUP BY user_id`)) {
    const n = Number(r.n) || 0;
    const m = ambil(perUserId, String(r.user_id));
    m.sph += n; m.total += n;
  }
  for (const r of await jalankan(
    `SELECT nama_sales, COUNT(*) n FROM sph
      WHERE user_id IS NULL AND trim(coalesce(nama_sales,''))<>'' GROUP BY nama_sales`)) {
    const n = Number(r.n) || 0;
    const m = ambil(perNama, String(r.nama_sales).trim().toLowerCase());
    m.sph += n; m.total += n;
  }

  // Lead CRM — hanya punya nama sales.
  for (const r of await jalankan(
    `SELECT sales, COUNT(*) n FROM crm_leads GROUP BY sales`)) {
    const n = Number(r.n) || 0;
    const nm = String(r.sales || '').trim().toLowerCase();
    if (nm) { const m = ambil(perNama, nm); m.lead += n; m.total += n; }
  }

  // Survey teknis — dicatat lewat id akun.
  for (const r of await jalankan(
    `SELECT dibuat_oleh, COUNT(*) n FROM survey_teknis
      WHERE dibuat_oleh IS NOT NULL GROUP BY dibuat_oleh`)) {
    const n = Number(r.n) || 0;
    if (r.dibuat_oleh) { const m = ambil(perUserId, String(r.dibuat_oleh)); m.survey += n; m.total += n; }
  }

  // PO pabrik — dicatat lewat id akun.
  for (const r of await jalankan(
    `SELECT dibuat_oleh, COUNT(*) n FROM po_pabrik
      WHERE dibuat_oleh IS NOT NULL GROUP BY dibuat_oleh`)) {
    const n = Number(r.n) || 0;
    if (r.dibuat_oleh) { const m = ambil(perUserId, String(r.dibuat_oleh)); m.po += n; m.total += n; }
  }

  return { perUserId, perNama };
}

/** Ambil jumlah data milik satu akun dari peta. */
function ambilMilik(peta: PetaMilik, userId: string, nama: string | null): Milik {
  const a = peta.perUserId.get(userId);
  const b = peta.perNama.get((nama || '').trim().toLowerCase());
  if (!a) return b ? { ...b } : kosong();
  if (!b) return { ...a };
  return {
    sph: a.sph + b.sph, lead: a.lead + b.lead,
    survey: a.survey + b.survey, po: a.po + b.po,
    total: a.total + b.total,
  };
}

/**
 * Hitung data milik SATU akun. Dipakai sebelum menghapus akun.
 *
 * Memakai peta dari `hitungMilikSemua` supaya tidak ada kueri terpisah yang
 * bisa gagal diam-diam.
 */
async function hitungMilik(env: Env, userId: string, _email: string, nama: string | null): Promise<Milik> {
  return ambilMilik(await hitungMilikSemua(env), userId, nama);
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
