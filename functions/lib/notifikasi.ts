// ============================================================
//  NOTIFIKASI — pencatat pemberitahuan alur proyek
//
//  Dipanggil dari titik-titik pemicu (lead, survey, SPH, SPK, PO,
//  dokumen). Semua pemberitahuan hidup di dalam aplikasi; tidak ada
//  email di sistem ini.
//
//  ⚠️ ATURAN UTAMA: fungsi di berkas ini TIDAK PERNAH melempar galat.
//
//  Notifikasi adalah efek samping, bukan tujuan. Kalau pencatatannya
//  gagal (tabel belum dimigrasi, DB sibuk), menyimpan lead tetap harus
//  berhasil. Kalau `kirim()` melempar, seluruh aksi utama ikut batal dan
//  pengguna melihat "gagal menyimpan" padahal datanya baik-baik saja.
//  Karena itu setiap jalur dibungkus try/catch dan galatnya ditelan.
//
//  ⚠️ Penerima TIDAK ditentukan lewat izin `lihat_semua`.
//
//  Peran `staff` juga memegang `lihat_semua`, jadi memakai izin itu
//  sebagai penentu membuat staff menerima seluruh pemberitahuan
//  manajemen. Penerima ditentukan dari PERAN secara eksplisit di
//  `PENERIMA` di bawah, supaya jawabannya bisa dibaca sekali lihat.
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';

export interface Env { sph_management_db: D1Database }

export type Tingkat = 'info' | 'sukses' | 'peringatan';

/** Peran yang mengawasi jalannya proyek dari atas. */
const PENGAWAS = ['admin', 'manager', 'direktur'];

/**
 * Peran admin kantor — termasuk `staff` yang memang memproses dokumen.
 * Dipakai untuk kejadian yang menuntut tindakan di Meja Dokumen.
 */
const ADMIN_KANTOR = ['admin', 'manager', 'direktur', 'staff'];

/**
 * Penerima bawaan per jenis kejadian.
 *
 * Kalau `jenis` tidak terdaftar di sini, dipakai `PENGAWAS` — lebih baik
 * terlalu banyak tahu daripada kejadian penting lewat tanpa ada yang
 * melihat. Tapi jenis yang tidak dikenal juga berarti ada salah ketik di
 * titik pemicu, jadi `jenisDikenal()` disediakan untuk pengecekan.
 */
export const PENERIMA: Record<string, string[]> = {
  // ── CRM / Lead ──
  lead_baru: PENGAWAS,
  lead_pindah: PENGAWAS,

  // ── Survey ──
  survey_selesai: PENGAWAS,
  survey_final_selesai: PENGAWAS,
  survey_dikunci: PENGAWAS,

  // ── Dokumen penawaran & kontrak ──
  sph_baru: PENGAWAS,
  sph_final: PENGAWAS,
  spk_final: PENGAWAS,
  // ── Pesanan pabrik ──
  po_terbit: PENGAWAS,
  po_revisi: PENGAWAS,

  // ── Meja Dokumen ──
  dokumen_baru: ADMIN_KANTOR,
};
export function jenisDikenal(jenis: string): boolean {
  return Object.prototype.hasOwnProperty.call(PENERIMA, jenis);
}

/** Cari user_id semua akun aktif yang perannya termasuk dalam `peran`. */
async function idPemakaiPeran(env: Env, peran: string[]): Promise<string[]> {
  if (!peran.length) return [];
  const tanda = peran.map(() => '?').join(',');
  const hasil = await env.sph_management_db
    .prepare(`SELECT id FROM app_users WHERE status='approved' AND lower(trim(role)) IN (${tanda})`)
    .bind(...peran.map(p => p.toLowerCase()))
    .all<{ id: string }>();
  return (hasil.results || []).map(r => r.id).filter(Boolean);
}

/** Buang id kosong dan kembar, tanpa mengubah urutan kemunculan. */
function unik(daftar: (string | null | undefined)[]): string[] {
  const terlihat = new Set<string>();
  const out: string[] = [];
  for (const x of daftar) {
    const v = String(x || '').trim();
    if (!v || terlihat.has(v)) continue;
    terlihat.add(v);
    out.push(v);
  }
  return out;
}

export interface OpsiNotifikasi {
  /** Jenis kejadian — harus salah satu kunci `PENERIMA`. */
  jenis: string;
  /**
   * Kunci kejadian, mis. `'lead:abc-123'` atau `'po:abc-123:rev2'`.
   * Kejadian dengan kunci yang sudah pernah dicatat TIDAK dicatat lagi,
   * supaya layar yang menyimpan dua kali tidak menghasilkan dua lonceng.
   */
  kunciEvent: string;
  judul: string;
  pesan?: string;
  /** Tautan di dalam aplikasi, mis. `/crm/kanban`. */
  tautan?: string;
  olehNama?: string;
  tingkat?: Tingkat;
  /**
   * Penerima tambahan di luar bawaan jenis — mis. sales pemilik lead
   * yang baru dipindahkan ke tangannya.
   */
  penerimaTambahan?: string[];
  /**
   * Kalau diisi, bawaan jenis DIABAIKAN dan pemberitahuan hanya dikirim
   * ke id-id ini. Dipakai untuk pesan pribadi ("lead ini kini milik Anda").
   */
  penerimaKhusus?: string[];
}

/**
 * Catat satu pemberitahuan. Tidak pernah melempar.
 *
 * Mengembalikan jumlah baris yang benar-benar tercatat (0 bila tidak ada
 * penerima, sudah pernah dicatat, atau gagal) — berguna untuk pengujian.
 */
export async function kirim(env: Env, opsi: OpsiNotifikasi): Promise<number> {
  try {
    const jenis = String(opsi.jenis || '').trim();
    const kunciEvent = String(opsi.kunciEvent || '').trim();
    if (!jenis || !kunciEvent) return 0;

    // 1. Tentukan penerima
    let penerima: string[];
    if (opsi.penerimaKhusus && opsi.penerimaKhusus.length) {
      penerima = unik(opsi.penerimaKhusus);
    } else {
      const peran = PENERIMA[jenis] || PENGAWAS;
      penerima = unik([...(await idPemakaiPeran(env, peran)), ...(opsi.penerimaTambahan || [])]);
    }
    if (!penerima.length) return 0;

    // 2. Cegah kembar: satu kunci kejadian = satu baris.
    //
    // Dipakai `INSERT ... SELECT ... WHERE NOT EXISTS` alih-alih
    // memeriksa lebih dulu lalu menyisipkan: dua permintaan yang tiba
    // hampir bersamaan bisa sama-sama lolos pemeriksaan, lalu keduanya
    // menyisipkan. Bentuk ini menutup celah itu dalam satu perintah.
    const hasil = await env.sph_management_db
      .prepare(
        `INSERT INTO app_notifikasi
           (id, jenis, kunci_event, judul, pesan, penerima, tautan, oleh_nama, tingkat, created_at)
         SELECT ?,?,?,?,?,?,?,?,?,?
         WHERE NOT EXISTS (SELECT 1 FROM app_notifikasi WHERE kunci_event=?)`,
      )
      .bind(
        crypto.randomUUID(), jenis, kunciEvent,
        String(opsi.judul || '').slice(0, 300),
        String(opsi.pesan || '').slice(0, 600),
        penerima.join(','),
        String(opsi.tautan || '').slice(0, 200),
        String(opsi.olehNama || '').slice(0, 120),
        opsi.tingkat || 'info',
        new Date().toISOString(),
        kunciEvent,
      )
      .run();

    return hasil.meta?.changes || 0;
  } catch {
    // Sengaja ditelan — lihat catatan di kepala berkas.
    return 0;
  }
}

/**
 * Ambil id satu pengguna dari alamat email.
 * Dipakai untuk mengarahkan pesan pribadi, mis. ke sales pemilik lead.
 * Tidak pernah melempar.
 */
export async function idPemakaiEmail(env: Env, email: string | null | undefined): Promise<string | null> {
  const alamat = String(email || '').trim();
  if (!alamat) return null;
  try {
    const u = await env.sph_management_db
      .prepare('SELECT id FROM app_users WHERE lower(email)=lower(?) LIMIT 1')
      .bind(alamat).first<{ id: string }>();
    return u?.id || null;
  } catch {
    return null;
  }
}

/** Cari id pengguna dari nama sales (lewat `crm_ref_sales` lalu `app_users`). */
export async function idPemakaiNamaSales(env: Env, nama: string | null | undefined): Promise<string | null> {
  const n = String(nama || '').trim();
  if (!n) return null;
  try {
    const ref = await env.sph_management_db
      .prepare('SELECT email FROM crm_ref_sales WHERE lower(trim(nama))=lower(trim(?)) LIMIT 1')
      .bind(n).first<{ email: string }>();
    if (ref?.email) {
      const id = await idPemakaiEmail(env, ref.email);
      if (id) return id;
    }
    // Cadangan: cocokkan langsung ke nama tampilan akun.
    const u = await env.sph_management_db
      .prepare('SELECT id FROM app_users WHERE lower(trim(full_name))=lower(trim(?)) LIMIT 1')
      .bind(n).first<{ id: string }>();
    return u?.id || null;
  } catch {
    return null;
  }
}
