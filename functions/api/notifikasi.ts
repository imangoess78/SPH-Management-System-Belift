// ============================================================
//  API NOTIFIKASI
//
//  GET    /api/notifikasi                 → daftar + jumlah belum dibaca
//  GET    /api/notifikasi?jumlah=1        → hanya jumlah belum dibaca
//  POST   /api/notifikasi  { id? }        → tandai dibaca (satu / semua)
//
//  ⚠️ PENYARINGAN PENERIMA BUKAN SEKADAR KERAPIAN.
//
//  Izin halaman `notifikasi` hanya menentukan boleh-tidaknya membuka
//  endpoint ini. Isi yang terlihat SELALU disaring ke id pengguna yang
//  sedang masuk. Kalau tidak, siapa pun yang punya izin halaman bisa
//  membaca pemberitahuan milik orang lain — termasuk arahan dari
//  direktur. Karena itu setiap query di bawah memakai `penerimaSaya()`.
//
//  Pencocokan penerima memakai pola `,id,` dengan koma di kedua ujung.
//  Kolom `penerima` berbentuk daftar id dipisah koma; pencocokan
//  `LIKE '%id%'` biasa bisa salah cocok kalau satu id menjadi bagian
//  dari id lain (mis. 'abc' cocok dengan 'abc-1'). Koma di kedua ujung
//  menutup kasus itu.
// ============================================================

import type { PagesFunction } from '@cloudflare/workers-types';
import { json, wajibHalaman } from '../lib/akses';

interface Env { sph_management_db: D1Database }

/** Pola `,<id>,` untuk mencocokkan keanggotaan daftar penerima. */
function penerimaSaya(userId: string): string {
  return `%,${userId},%`;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const cek = await wajibHalaman(request, env, 'notifikasi');
  if ('tolak' in cek) return cek.tolak;
  const akses = cek.akses;
  const userId = akses.userId;
  const url = new URL(request.url);

  // ── Jumlah belum dibaca (dipakai lencana di menu) ──
  const hanyaJumlah = url.searchParams.get('jumlah') === '1';

  if (request.method === 'GET') {
    const jumlah = await env.sph_management_db
      .prepare(
        `SELECT COUNT(*) AS n FROM app_notifikasi n
         WHERE n.penerima LIKE ?
           AND NOT EXISTS (SELECT 1 FROM app_notifikasi_baca b
                           WHERE b.id_notif=n.id AND b.user_id=?)`,
      )
      .bind(penerimaSaya(userId), userId)
      .first<{ n: number }>();

    if (hanyaJumlah) return json({ jumlah: jumlah?.n || 0 });

    const batas = Math.min(Math.max(Number(url.searchParams.get('batas') || 50), 1), 200);
    const daftar = await env.sph_management_db
      .prepare(
        `SELECT n.id, n.jenis, n.judul, n.pesan, n.tautan, n.oleh_nama, n.tingkat, n.created_at,
                CASE WHEN b.user_id IS NULL THEN 0 ELSE 1 END AS dibaca
         FROM app_notifikasi n
         LEFT JOIN app_notifikasi_baca b ON b.id_notif=n.id AND b.user_id=?
         WHERE n.penerima LIKE ?
         ORDER BY n.created_at DESC
         LIMIT ?`,
      )
      .bind(userId, penerimaSaya(userId), batas)
      .all<Record<string, unknown>>();

    return json({
      // Kolom `dibaca` datang sebagai 0/1 dari SQLite; diterjemahkan di sini
      // supaya tampilan tidak perlu tahu bentuk penyimpanannya.
      daftar: (daftar.results || []).map(r => ({ ...r, dibaca: !!r.dibaca })),
      jumlahBelumDibaca: jumlah?.n || 0,
    });
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({})) as { id?: string };
    const id = String(body.id || '').trim();
    const now = new Date().toISOString();

    if (id) {
      // Hanya boleh menandai notifikasi yang memang ditujukan ke akun ini.
      // Tanpa syarat `penerima LIKE`, siapa pun bisa menandai notifikasi
      // orang lain sebagai terbaca — menghapus lencana orang itu.
      const milik = await env.sph_management_db
        .prepare('SELECT 1 AS ok FROM app_notifikasi WHERE id=? AND penerima LIKE ?')
        .bind(id, penerimaSaya(userId)).first();
      if (!milik) return json({ error: 'Notifikasi tidak ditemukan.' }, 404);

      // `INSERT OR IGNORE`: menekan tombol dua kali tidak boleh jadi galat.
      await env.sph_management_db
        .prepare('INSERT OR IGNORE INTO app_notifikasi_baca (id_notif, user_id, dibaca_at) VALUES (?,?,?)')
        .bind(id, userId, now).run();
      return json({ ok: true });
    }

    // Tanpa `id` = tandai semua milik saya sebagai terbaca.
    // `SELECT` di dalamnya memakai syarat penerima yang sama, jadi tidak
    // mungkin menyentuh notifikasi milik orang lain.
    await env.sph_management_db
      .prepare(
        `INSERT OR IGNORE INTO app_notifikasi_baca (id_notif, user_id, dibaca_at)
         SELECT n.id, ?, ? FROM app_notifikasi n
         WHERE n.penerima LIKE ?
           AND NOT EXISTS (SELECT 1 FROM app_notifikasi_baca b
                           WHERE b.id_notif=n.id AND b.user_id=?)`,
      )
      .bind(userId, now, penerimaSaya(userId), userId).run();
    return json({ ok: true });
  }

  return new Response('Method Not Allowed', { status: 405 });
};
