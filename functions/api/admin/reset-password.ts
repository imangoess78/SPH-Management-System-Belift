// ============================================================
//  BUAT KODE RESET PASSWORD  —  POST /api/admin/reset-password
//
//  Dipakai Admin dari halaman Manajemen Akun saat ada pengguna yang
//  lupa password-nya. Aplikasi ini tidak punya layanan email, jadi
//  tautan "reset lewat surel" tidak mungkin. Gantinya Admin membuat
//  kode sekali pakai, lalu menyampaikannya sendiri ke pemilik akun
//  (WhatsApp / lisan).
//
//  Aturan yang dijaga di sini:
//   * Hanya pemegang izin `akun` yang boleh memanggil (403 kalau bukan).
//   * Kode mentah HANYA muncul di jawaban ini — yang masuk database
//     cuma hash-nya. Jadi kode yang hilang tidak bisa diambil lagi
//     dari database; Admin harus membuat yang baru.
//   * Satu akun = satu kode hidup. Membuat kode baru otomatis
//     membatalkan kode sebelumnya, supaya tidak ada dua kode beredar
//     yang bisa dipakai orang berbeda.
//   * Akun nonaktif ditolak, karena kodenya akan jadi jalan buntu:
//     pemiliknya tetap tidak bisa login.
// ============================================================

import type { PagesFunction } from '@cloudflare/workers-types';
import type { D1Database } from '@cloudflare/workers-types';
import { json, wajibHalaman } from '../../lib/akses';
import { KODE_BERLAKU_MENIT, catatKeamanan, hashSandi, kodeBaru } from '../../lib/keamanan';

interface Env { sph_management_db: D1Database }

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const cek = await wajibHalaman(request, env, 'akun');
  if ('tolak' in cek) return cek.tolak;
  const akses = cek.akses;

  let body: { id?: string };
  try { body = await request.json(); } catch { return json({ error: 'Request tidak valid' }, 400); }
  const id = String(body.id || '').trim();
  if (!id) return json({ error: 'Akun yang akan direset wajib dipilih' }, 400);

  const target = await env.sph_management_db
    .prepare('SELECT id, email, full_name, status FROM app_users WHERE id=?')
    .bind(id).first<{ id: string; email: string; full_name: string | null; status: string }>();
  if (!target) return json({ error: 'Akun tidak ditemukan' }, 404);

  if (target.status !== 'approved') {
    return json({
      error: `Akun ini berstatus "${target.status}" sehingga belum bisa login. `
        + 'Aktifkan akunnya lebih dulu, baru buat kode reset.',
    }, 400);
  }

  const sekarang = new Date().toISOString();

  // Batalkan kode lama sebelum membuat yang baru. Kalau tidak, dua kode
  // hidup bersamaan dan kode yang sudah terlanjur dikirim ke WhatsApp
  // pemilik akun masih bisa dipakai.
  await env.sph_management_db.prepare(
    `UPDATE app_reset_kode SET dibatalkan_at=?
     WHERE user_id=? AND dipakai_at IS NULL AND dibatalkan_at IS NULL`
  ).bind(sekarang, id).run();

  const kode = kodeBaru();
  const expires = new Date(Date.now() + KODE_BERLAKU_MENIT * 60000).toISOString();
  await env.sph_management_db.prepare(
    `INSERT INTO app_reset_kode
     (id,user_id,kode_hash,dibuat_oleh,dibuat_nama,created_at,expires_at)
     VALUES (?,?,?,?,?,?,?)`
  ).bind(
    crypto.randomUUID(), id, await hashSandi(kode),
    akses.userId, akses.nama, sekarang, expires,
  ).run();

  await catatKeamanan(env, {
    userId: id, email: target.email, jenis: 'kode_reset_dibuat',
    olehUserId: akses.userId, olehNama: akses.nama,
    catatan: `Kode reset dibuat, berlaku ${KODE_BERLAKU_MENIT} menit`,
  });

  // Kode mentah dikirim SEKALI di sini. Setelah jawaban ini, kode itu
  // tidak bisa diambil lagi dari mana pun — hanya hash-nya yang tersimpan.
  return json({
    kode,
    untuk: target.email,
    nama: target.full_name || target.email,
    kedaluwarsa: expires,
    berlakuMenit: KODE_BERLAKU_MENIT,
  });
};
