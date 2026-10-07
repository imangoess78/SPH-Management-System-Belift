// ============================================================
//  GANTI PASSWORD SENDIRI  —  POST /api/auth/password
//
//  Dipakai dari halaman Pengaturan oleh pengguna yang SUDAH masuk.
//  Karena sudah masuk, tidak ada email yang dibutuhkan: buktinya
//  adalah password lama.
//
//  Yang diperbaiki dibanding versi sebelumnya:
//   * Panjang minimum dinaikkan 6 → 8, dan diperiksa di SERVER.
//     Sebelumnya pemeriksaan panjang hanya ada di tampilan, jadi
//     permintaan langsung ke API bisa menembusnya.
//   * Ada pembatas percobaan. Tanpa ini, orang yang mencuri sesi bisa
//     menebak password lama tanpa batas sampai akunnya diambil alih
//     secara permanen.
//   * Sesudah password berganti, sesi LAIN diputus (sesi yang sedang
//     dipakai tetap hidup supaya pengguna tidak terlempar sendiri).
//     Tanpa ini, pencuri sesi tetap bisa masuk meski password sudah
//     diganti.
//   * Setiap perubahan dicatat ke `app_keamanan_riwayat`.
// ============================================================

import type { PagesFunction } from '@cloudflare/workers-types';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../lib/akses';
import {
  catatKeamanan, catatPercobaan, cocokSandi, hashSandi, ipPemanggil,
  lupakanPercobaan, periksaSandiBaru,
} from '../../lib/keamanan';

interface Env { sph_management_db: D1Database }

const BATAS = 5;
const JENDELA_MENIT = 15;

/** Ambil sesi yang sedang dipakai, beserta data akunnya. */
async function sesiSekarang(request: Request, env: Env) {
  const sid = (request.headers.get('cookie') || '').match(/(?:^|; )sph_session=([^;]+)/)?.[1];
  if (!sid) return null;
  const u = await env.sph_management_db.prepare(
    `SELECT u.id, u.email, u.password_hash FROM app_sessions s
     JOIN app_users u ON u.id = s.user_id
     WHERE s.id=? AND s.expires_at>?`
  ).bind(sid, new Date().toISOString())
    .first<{ id: string; email: string; password_hash: string }>();
  return u ? { ...u, sid } : null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const u = await sesiSekarang(request, env);
  if (!u) return json({ error: 'Unauthorized' }, 401);

  let body: { currentPassword?: string; newPassword?: string };
  try { body = await request.json(); } catch { return json({ error: 'Request tidak valid' }, 400); }

  const lama = String(body.currentPassword || '');
  const baru = String(body.newPassword || '');
  if (!lama || !baru) return json({ error: 'Password saat ini dan password baru wajib diisi' }, 400);

  const salah = periksaSandiBaru(baru, u.email);
  if (salah) return json({ error: salah }, 400);

  // Pembatas dikunci ke akun (bukan IP): yang dicegah di sini adalah
  // penebakan password lama, dan penebak bisa berganti-ganti IP.
  const kunci = `sandi:${u.id}`;
  const batas = await catatPercobaan(env, kunci, BATAS, JENDELA_MENIT);
  if (!batas.boleh) {
    return json({
      error: `Terlalu banyak percobaan ganti password. Coba lagi dalam ${Math.ceil(batas.tungguDetik / 60)} menit.`,
    }, 429);
  }

  if (!await cocokSandi(lama, u.password_hash)) {
    return json({ error: 'Password saat ini salah' }, 400);
  }

  if (lama === baru) {
    return json({ error: 'Password baru sama dengan password saat ini' }, 400);
  }

  const sekarang = new Date().toISOString();
  await env.sph_management_db
    .prepare('UPDATE app_users SET password_hash=?, updated_at=? WHERE id=?')
    .bind(await hashSandi(baru), sekarang, u.id).run();

  // Sesi lain diputus, sesi yang sedang dipakai dibiarkan hidup.
  const putus = await env.sph_management_db
    .prepare('DELETE FROM app_sessions WHERE user_id=? AND id!=?')
    .bind(u.id, u.sid).run();
  const sesiLainDiputus = Number((putus as { meta?: { changes?: number } }).meta?.changes) || 0;

  await lupakanPercobaan(env, kunci);

  await catatKeamanan(env, {
    userId: u.id, email: u.email, jenis: 'password_diubah',
    olehUserId: u.id, olehNama: u.email,
    catatan: `Password diubah sendiri dari halaman Pengaturan. ${sesiLainDiputus} sesi lain diputus.`,
  });

  return json({ ok: true, sesiLainDiputus });
};
