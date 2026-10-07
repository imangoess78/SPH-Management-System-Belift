// ============================================================
//  KEAMANAN KATA SANDI — satu tempat untuk seluruh aplikasi
//
//  Sebelum ini, hashing PBKDF2 ditulis ulang di login.ts, signup.ts,
//  dan password.ts dengan salinan yang hampir sama. Salinan yang
//  bercabang berbahaya: perbaikan di satu tempat tidak ikut ke tempat
//  lain. Jadi semuanya dikumpulkan di sini.
//
//  Kode reset password memakai mesin yang SAMA PERSIS dengan password
//  (pbkdf2 + garam acak + 100.000 putaran). Jadi kode 6 angka pun tidak
//  bisa dibalik dari isi database kalau DB-nya bocor.
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';

interface Env { sph_management_db: D1Database }

const enc = new TextEncoder();

/** base64 dari ArrayBuffer — dipakai sebagai badan hash. */
export function b64(bytes: ArrayBuffer): string {
  let out = '';
  for (const byte of new Uint8Array(bytes)) out += String.fromCharCode(byte);
  return btoa(out);
}

/** Garam acak 16 byte dalam base64. Setiap hash dapat garam sendiri. */
export function garamBaru(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
}

/**
 * PBKDF2-SHA256, 100.000 putaran, 256 bit.
 *
 * Sengaja memakai Web Crypto (crypto.subtle) supaya jalan di Cloudflare
 * Workers tanpa pustaka luar. Putaran 100.000 membuat tebak-tebakan
 * paksa (brute force) di luar layanan jadi tidak sepadan.
 */
export async function derive(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256,
  );
  return b64(bits);
}

/** Bungkus password menjadi '<garam>$<hash>'. */
export async function hashSandi(password: string, garam = garamBaru()): Promise<string> {
  return `${garam}$${await derive(password, garam)}`;
}

/** Bandingkan hash tersimpan '<garam>$<hash>' dengan password yang dicoba. */
export async function cocokSandi(password: string, tersimpan: string): Promise<boolean> {
  const [garam, harap] = String(tersimpan || '').split('$');
  if (!garam || !harap) return false;
  const dapat = await derive(password, garam);
  return samaAman(dapat, harap);
}

/**
 * Perbandingan waktu-tetap (constant time) untuk teks sepanjang apa pun.
 *
 * Perbandingan `a === b` biasa berhenti di huruf pertama yang berbeda.
 * Selisih waktunya bisa diukur untuk menebak isi rahasia — jadi untuk
 * rahasia (kode reset, master password) selalu pakai ini.
 */
export function samaAman(a: string, b: string): boolean {
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  // Panjang ikut dihitung, jangan keluar lebih awal.
  let beda = x.length ^ y.length;
  const n = Math.max(x.length, y.length);
  for (let i = 0; i < n; i++) beda |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return beda === 0;
}

// ── Kata sandi: aturan & pemeriksaan ────────────────────────

/** Panjang minimum. Sebelumnya ganti-password hanya menuntut 6 — terlalu pendek. */
export const MIN_PANJANG = 8;
export const MAKS_PANJANG = 200;

const DILARANG = [
  'password', 'password123', '12345678', '123456789', 'qwerty123',
  'belift123', 'admin123', 'sph12345', 'iloveyou',
];

/**
 * Periksa kekuatan kata sandi baru.
 * @returns pesan kesalahan, atau null kalau lolos.
 */
export function periksaSandiBaru(sandi: string, email = ''): string | null {
  if (!sandi) return 'Password baru wajib diisi';
  if (sandi.length < MIN_PANJANG) return `Password minimal ${MIN_PANJANG} karakter`;
  if (sandi.length > MAKS_PANJANG) return `Password maksimal ${MAKS_PANJANG} karakter`;
  if (sandi !== sandi.trim()) return 'Password tidak boleh diawali atau diakhiri spasi';
  if (DILARANG.includes(sandi.toLowerCase())) return 'Password terlalu mudah ditebak — pakai yang lain';

  const lokal = String(email).split('@')[0]?.toLowerCase();
  if (lokal && lokal.length >= 3 && sandi.toLowerCase().includes(lokal)) {
    return 'Password tidak boleh memuat alamat email Anda';
  }

  // Susunan beruntun panjang, mis. '123456789' atau 'abcdefgh'.
  if (/^(.)\1+$/.test(sandi)) return 'Password tidak boleh satu karakter berulang';
  if (beruntun(sandi)) return 'Password tidak boleh berurutan (mis. 123456789)';
  return null;
}

/** Benar bila seluruh isi teks adalah deret naik/turun yang mulus. */
function beruntun(s: string): boolean {
  if (s.length < MIN_PANJANG) return false;
  const kode = [...s].map(c => c.charCodeAt(0));
  const naik = kode.every((k, i) => i === 0 || k === kode[i - 1] + 1);
  const turun = kode.every((k, i) => i === 0 || k === kode[i - 1] - 1);
  return naik || turun;
}

// ── Kode reset: pembuatan & pemeriksaan ─────────────────────

/**
 * Acak seragam dari 0..batas-1 memakai crypto.
 *
 * `Math.random()` TIDAK dipakai: hasilnya bisa ditebak dan kode reset
 * yang bisa ditebak sama saja tidak ada kuncinya. Penolakan (rejection
 * sampling) dipakai supaya sisa bagi tidak membuat angka tertentu
 * lebih sering muncul.
 */
function acak(batas: number): number {
  const batasAman = Math.floor(0x100000000 / batas) * batas;
  const buf = new Uint32Array(1);
  let v = 0;
  do { crypto.getRandomValues(buf); v = buf[0]; } while (v >= batasAman);
  return v % batas;
}

/**
 * Kode reset untuk disampaikan lewat WhatsApp/lisan.
 *
 * 8 angka — dinaikkan dari 6. Alasannya: kode 6 angka hanya punya
 * 1.000.000 kemungkinan, dan kode ini berlaku 30 menit. Dengan pembatas
 * percobaan pun, 8 angka memberi ruang jauh lebih lega.
 * Tanpa huruf yang mudah tertukar (0/O, 1/I) supaya tidak salah ketik.
 */
export function kodeBaru(): string {
  return Array.from({ length: 8 }, () => acak(10)).join('');
}

/**
 * Ambil kode hidup milik satu akun.
 *
 * Hanya satu kode hidup per akun. `dipakai_at` dan `dibatalkan_at` harus
 * NULL, dan belum kedaluwarsa.
 */
export async function kodeHidup(env: Env, userId: string) {
  return env.sph_management_db.prepare(
    `SELECT id, kode_hash, expires_at FROM app_reset_kode
     WHERE user_id=? AND dipakai_at IS NULL AND dibatalkan_at IS NULL AND expires_at>?
     ORDER BY created_at DESC LIMIT 1`
  ).bind(userId, new Date().toISOString()).first<{ id: string; kode_hash: string; expires_at: string }>();
}

/** Berapa detik lagi kode hidup akun ini kedaluwarsa. 0 = tidak ada kode. */
export async function sisaDetikKode(env: Env, userId: string): Promise<number> {
  const k = await kodeHidup(env, userId);
  if (!k) return 0;
  return Math.max(0, Math.floor((new Date(k.expires_at).getTime() - Date.now()) / 1000));
}

/** Masa berlaku kode reset, dalam menit. */
export const KODE_BERLAKU_MENIT = 30;

// ── Pembatas percobaan (rate limit) ─────────────────────────

/**
 * Catat satu percobaan dan laporkan apakah masih boleh lanjut.
 *
 * Penghitung disimpan di D1, bukan di memori Worker. Worker punya banyak
 * isolate dan dijalankan ulang kapan saja — penghitung di memori akan
 * bocor dan pembatasnya jadi tidak berarti.
 *
 * @param batas  jumlah percobaan yang diizinkan dalam satu jendela
 * @param jendelaMenit panjang jendela waktu
 */
export async function catatPercobaan(
  env: Env, kunci: string, batas: number, jendelaMenit: number,
): Promise<{ boleh: boolean; sisa: number; tungguDetik: number }> {
  const now = Date.now();
  const db = env.sph_management_db;
  const baris = await db.prepare('SELECT kunci, jumlah, reset_at FROM app_percobaan WHERE kunci=?')
    .bind(kunci).first<{ kunci: string; jumlah: number; reset_at: string }>();

  // Belum ada, atau jendelanya sudah lewat → mulai jendela baru.
  if (!baris || new Date(baris.reset_at).getTime() <= now) {
    const reset = new Date(now + jendelaMenit * 60000).toISOString();
    await db.prepare(
      `INSERT INTO app_percobaan (kunci, jumlah, reset_at) VALUES (?,1,?)
       ON CONFLICT(kunci) DO UPDATE SET jumlah=1, reset_at=excluded.reset_at`
    ).bind(kunci, reset).run();
    return { boleh: true, sisa: batas - 1, tungguDetik: 0 };
  }

  const tungguDetik = Math.max(0, Math.ceil((new Date(baris.reset_at).getTime() - now) / 1000));
  if (baris.jumlah >= batas) return { boleh: false, sisa: 0, tungguDetik };

  await db.prepare('UPDATE app_percobaan SET jumlah=jumlah+1 WHERE kunci=?').bind(kunci).run();
  return { boleh: true, sisa: batas - baris.jumlah - 1, tungguDetik };
}

/**
 * Hapus penghitung setelah berhasil.
 *
 * Wajib dipanggil saat percobaan BERHASIL. Tanpa ini, orang yang salah
 * ketik 4 kali lalu berhasil akan tetap tertahan di percobaan ke-5 —
 * dan lebih buruk lagi, penyerang yang tahu password benar bisa
 * "memanaskan" penghitung korban.
 */
export async function lupakanPercobaan(env: Env, ...kunci: string[]): Promise<void> {
  for (const k of kunci) {
    await env.sph_management_db.prepare('DELETE FROM app_percobaan WHERE kunci=?').bind(k).run();
  }
}

/** Ambil alamat IP pemanggil dari header Cloudflare. */
export function ipPemanggil(request: Request): string {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'tak-diketahui';
}

// ── Riwayat keamanan ────────────────────────────────────────

/**
 * Catat peristiwa keamanan akun.
 *
 * Sengaja tidak pernah menggagalkan permintaan kalau penulisan gagal:
 * mencatat riwayat tidak boleh lebih penting daripada aksi yang dicatat.
 * Tapi kegagalannya ditandai di konsol supaya tidak hilang diam-diam.
 */
export async function catatKeamanan(
  env: Env,
  data: {
    userId: string; email: string;
    jenis: 'kode_reset_dibuat' | 'password_direset' | 'password_diubah';
    olehUserId?: string; olehNama?: string; catatan?: string;
  },
): Promise<void> {
  try {
    await env.sph_management_db.prepare(
      `INSERT INTO app_keamanan_riwayat
       (id,user_id,email,jenis,oleh_user_id,oleh_nama,catatan,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    ).bind(
      crypto.randomUUID(), data.userId, data.email, data.jenis,
      data.olehUserId || '', data.olehNama || '', data.catatan || '',
      new Date().toISOString(),
    ).run();
  } catch (e) {
    console.error('gagal mencatat riwayat keamanan', data.jenis, e);
  }
}
