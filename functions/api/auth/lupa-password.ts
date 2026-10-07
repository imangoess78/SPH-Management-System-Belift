// ============================================================
//  LUPA PASSWORD  —  POST /api/auth/lupa-password   (TANPA LOGIN)
//
//  Dipakai pengguna yang tidak bisa masuk karena lupa password-nya.
//  Aplikasi ini tidak punya layanan email, jadi tidak ada tautan reset
//  lewat surel. Alurnya:
//
//    1. Pengguna minta kode ke Admin (WhatsApp / lisan).
//    2. Admin membuat kode di Manajemen Akun → kode disampaikan.
//    3. Pengguna memasukkan email + kode + password baru DI SINI.
//
//  Yang membuat alur ini tetap aman meski tanpa email:
//   * Kode hanya tersimpan sebagai hash — bocornya database tidak
//     memberi kode yang bisa dipakai.
//   * Kode berlaku terbatas dan hanya bisa dipakai SEKALI.
//   * Ada pembatas percobaan per IP dan per akun+IP. Dibatasi per
//     akun+IP (bukan per akun saja) supaya orang luar tidak bisa
//     mengunci akun orang lain hanya dengan menebak-nebak.
//   * Pesan galat SELALU sama untuk "email tidak ada", "kode salah",
//     dan "kode kedaluwarsa". Kalau dibedakan, penyerang bisa memakai
//     halaman ini untuk memastikan email mana yang terdaftar.
//   * Begitu password berganti, SEMUA sesi akun itu diputus. Kalau
//     akunnya sedang dipakai orang lain, orang itu langsung terlempar.
// ============================================================

import type { PagesFunction } from '@cloudflare/workers-types';
import type { D1Database } from '@cloudflare/workers-types';
import { json } from '../../lib/akses';
import {
  catatKeamanan, cocokSandi, catatPercobaan, hashSandi, ipPemanggil,
  kodeHidup, lupakanPercobaan, periksaSandiBaru,
} from '../../lib/keamanan';

interface Env { sph_management_db: D1Database }

/** Batas percobaan. Per IP lebih longgar karena satu kantor bisa berbagi IP. */
const BATAS_PER_IP = 10;
const BATAS_PER_AKUN_IP = 5;
const JENDELA_MENIT = 15;

/**
 * Satu pesan untuk semua kegagalan.
 *
 * Sengaja tidak dibedakan antara "email tidak terdaftar" dan "kode
 * salah": membedakannya mengubah halaman ini jadi alat untuk mendata
 * email mana yang punya akun.
 */
const GAGAL = {
  error: 'Email, kode, atau masa berlaku tidak cocok. '
    + 'Periksa kembali, atau minta kode baru ke Admin.',
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { email?: string; kode?: string; passwordBaru?: string };
  try { body = await request.json(); } catch { return json({ error: 'Request tidak valid' }, 400); }

  const email = String(body.email || '').trim().toLowerCase();
  const kode = String(body.kode || '').replace(/\D/g, '');
  const passwordBaru = String(body.passwordBaru || '');

  if (!email || !kode || !passwordBaru) {
    return json({ error: 'Email, kode, dan password baru wajib diisi' }, 400);
  }

  const salahSandi = periksaSandiBaru(passwordBaru, email);
  if (salahSandi) return json({ error: salahSandi }, 400);

  const ip = ipPemanggil(request);

  // Pembatas percobaan diperiksa SEBELUM menyentuh database akun, supaya
  // penebakan tidak membebani apa pun.
  const perIp = await catatPercobaan(env, `lupa:ip:${ip}`, BATAS_PER_IP, JENDELA_MENIT);
  if (!perIp.boleh) {
    return json({
      error: `Terlalu banyak percobaan dari jaringan ini. Coba lagi dalam ${Math.ceil(perIp.tungguDetik / 60)} menit.`,
    }, 429);
  }

  const kunciAkun = `lupa:akun:${email}:${ip}`;
  const perAkun = await catatPercobaan(env, kunciAkun, BATAS_PER_AKUN_IP, JENDELA_MENIT);
  if (!perAkun.boleh) {
    return json({
      error: `Terlalu banyak percobaan untuk akun ini. Coba lagi dalam ${Math.ceil(perAkun.tungguDetik / 60)} menit, atau minta kode baru ke Admin.`,
    }, 429);
  }

  const user = await env.sph_management_db
    .prepare('SELECT id, email, status FROM app_users WHERE email=? COLLATE NOCASE')
    .bind(email)
    .first<{ id: string; email: string; status: string }>();
  if (!user || user.status !== 'approved') return json(GAGAL, 400);

  const baris = await kodeHidup(env, user.id);
  if (!baris) return json(GAGAL, 400);

  // Bandingkan hash kode dengan waktu-tetap — lihat `samaAman` di lib.
  if (!await cocokSandi(kode, baris.kode_hash)) return json(GAGAL, 400);

  const sekarang = new Date().toISOString();
  const hash = await hashSandi(passwordBaru);

  await env.sph_management_db
    .prepare('UPDATE app_users SET password_hash=?, updated_at=? WHERE id=?')
    .bind(hash, sekarang, user.id).run();

  // Kode ini habis. Sisa kode lain (kalau ada) juga dimatikan supaya tidak
  // ada kode hidup yang tertinggal setelah password berganti.
  await env.sph_management_db
    .prepare('UPDATE app_reset_kode SET dipakai_at=? WHERE id=?')
    .bind(sekarang, baris.id).run();
  await env.sph_management_db
    .prepare(`UPDATE app_reset_kode SET dibatalkan_at=?
              WHERE user_id=? AND dipakai_at IS NULL AND dibatalkan_at IS NULL`)
    .bind(sekarang, user.id).run();

  // Putus SEMUA sesi akun ini. Ini bagian yang paling sering dilupakan:
  // tanpa ini, orang yang sudah masuk dengan sesi lama tetap bisa masuk
  // meski password-nya sudah diganti.
  const putus = await env.sph_management_db
    .prepare('DELETE FROM app_sessions WHERE user_id=?').bind(user.id).run();
  const sesiDiputus = Number((putus as { meta?: { changes?: number } }).meta?.changes) || 0;

  // Berhasil → penghitung percobaan dihapus, supaya kesalahan ketik
  // sebelumnya tidak menghukum pemakaian yang sah berikutnya.
  await lupakanPercobaan(env, kunciAkun);

  await catatKeamanan(env, {
    userId: user.id, email: user.email, jenis: 'password_direset',
    olehNama: 'Pemilik akun (dengan kode dari Admin)',
    catatan: `Password direset lewat kode sekali pakai. ${sesiDiputus} sesi diputus.`,
  });

  return json({
    ok: true,
    sesiDiputus,
    pesan: 'Password berhasil diganti. Silakan masuk dengan password baru Anda.',
  });
};
