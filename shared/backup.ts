/**
 * Backup database D1 — dipakai bersama oleh endpoint aplikasi
 * (functions/api/backup.ts) dan worker terjadwal (workers/backup-cron).
 *
 * KENAPA DI shared/: kalau logikanya ditulis dua kali, cepat atau lambat
 * keduanya berbeda — dan yang berbeda itu justru baru ketahuan saat backup
 * sedang dibutuhkan. Satu sumber, dua pemanggil.
 *
 * PENTING soal app_sessions: sengaja TIDAK ikut dibackup. Isinya sesi login
 * yang sedang aktif. Kalau ikut dipulihkan, sesi lama yang mestinya sudah mati
 * bisa hidup lagi — masalah keamanan, bukan penyelamatan data. Pengguna cukup
 * login ulang.
 *
 * PENTING soal berkas di R2 (foto survey, tanda tangan, gambar desain):
 * backup ini HANYA database. Berkas R2 punya siklus hidup sendiri dan jumlahnya
 * bisa besar. Pemulihan R2 dibahas terpisah — jangan sampai ada yang mengira
 * "sudah ada backup" lalu aman padahal berkasnya belum.
 */

// Tipe Cloudflare diimpor eksplisit: berkas ini di luar tsconfig functions/,
// jadi tanpa impor ini `D1Database`/`R2Bucket` tidak dikenal.
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

/** Tabel yang tidak ikut dibackup. */
const DILEWATI = new Set([
  'app_sessions',      // sesi login aktif — lihat catatan di atas
  'sqlite_sequence',   // internal SQLite
  'd1_migrations',     // catatan migrasi Cloudflare
]);

/** Cocokkan tabel internal yang selalu berubah nama/versi. */
const POLA_INTERNAL = /^(sqlite_|_cf_|_d1_)/i;

/**
 * Tabel internal yang DIBUANG dari skema backup.
 *
 * `d1_migrations` tidak ditangkap POLA_INTERNAL (namanya diawali `d1_`, bukan
 * `_d1_`), jadi harus disebut terpisah. Ia dibiarkan ada di database tujuan
 * karena Cloudflare sendiri yang mengurusnya — memasukkannya ke backup malah
 * bisa bentrok.
 */
const SKEMA_DILEWATI = new Set(['d1_migrations', 'sqlite_sequence']);

/**
 * Urutan pemulihan: INDUK dulu, ANAK belakangan.
 *
 * Dipakai saat memulihkan. Urutan terbalik dipakai saat menghapus (anak dulu)
 * supaya tidak ada baris yang menggantung.
 */
export const URUTAN_PEMULIHAN = [
  // acuan paling dasar
  'profiles', 'user_roles', 'app_users', 'app_users_izin_riwayat',
  'crm_ref_sales', 'crm_ref_kanal', 'crm_ref_status', 'crm_ref_diskon',
  'sales', 'design_items',
  // transaksi
  'crm_leads', 'crm_lead_riwayat', 'crm_biaya_iklan', 'crm_dokumen',
  'survey_teknis', 'survey_riwayat',
  'sph', 'po_pabrik', 'po_revisi', 'proyek',
];

export interface RingkasanTabel {
  baris: number;
  sha256: string;
}

/** Satu perintah SQL pembentuk skema (CREATE TABLE / INDEX / TRIGGER / VIEW). */
export interface PerintahSkema {
  jenis: string;
  nama: string;
  tabel: string;
  sql: string;
}

export interface HasilBackup {
  manifest: {
    jenis: string;
    dibuat_pada: string;
    sumber: string;
    jumlah_tabel: number;
    jumlah_baris: number;
    ukuran_byte: number;
    tabel: Record<string, RingkasanTabel>;
    tabel_dilewati: string[];
    catatan: string;
    pemicu: string;
  };
  /**
   * Skema database: definisi CREATE TABLE/INDEX/TRIGGER/VIEW.
   *
   * WAJIB ada. Tanpa ini, backup hanya berisi baris-baris data tanpa tabelnya —
   * kalau database hilang total, berkasnya tidak bisa membangun ulang apa pun.
   * Sempat begitu, dan itu ketahuan justru saat uji pemulihan.
   */
  skema: PerintahSkema[];
  kunci: string;
  data: Record<string, unknown[]>;
}

/**
 * Baca skema database dari sqlite_master.
 *
 * Termasuk tabel yang DILEWATI isinya (mis. app_sessions): strukturnya tetap
 * dicatat supaya saat pemulihan database terbentuk lengkap — yang tidak dibawa
 * hanya isinya, bukan tabelnya.
 *
 * Tabel INTERNAL (sqlite_*, _cf_*, _d1_*) sengaja DIBUANG. Sempat ikut terbawa
 * dan D1 menolak membuatnya dengan galat `not authorized: SQLITE_AUTH` —
 * ketahuan justru saat uji pemulihan sungguhan, bukan di uji lokal.
 */
export async function bacaSkema(db: D1Database): Promise<PerintahSkema[]> {
  const r = await db.prepare(
    `SELECT type, name, tbl_name, sql FROM sqlite_master
     WHERE sql IS NOT NULL
     ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1
                        WHEN 'trigger' THEN 2 ELSE 3 END, name`).all<{
    type: string; name: string; tbl_name: string; sql: string;
  }>();
  return (r.results || [])
    .filter(x => !POLA_INTERNAL.test(x.name) && !POLA_INTERNAL.test(x.tbl_name))
    .filter(x => !SKEMA_DILEWATI.has(x.name.toLowerCase()))
    .map(x => ({
      jenis: x.type, nama: x.name, tabel: x.tbl_name, sql: x.sql,
    }));
}

/**
 * Susun perintah untuk membangun ulang database yang KOSONG.
 *
 * Urutan penting: tabel dulu (induk sebelum anak), baru index & trigger —
 * karena keduanya merujuk tabel yang harus sudah ada.
 */
export function perintahPemulihan(skema: PerintahSkema[]): string[] {
  const pangkat: Record<string, number> = { table: 0, view: 1, index: 2, trigger: 3 };
  const diurut = [...skema].sort((a, b) => (pangkat[a.jenis] ?? 9) - (pangkat[b.jenis] ?? 9));
  return diurut.map(x => x.sql);
}

async function sha256(teks: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
}

/** Daftar tabel yang ikut dibackup, diambil dari database itu sendiri. */
export async function daftarTabel(db: D1Database): Promise<string[]> {
  const r = await db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all<{ name: string }>();
  const nama = (r.results || []).map(x => x.name)
    .filter(n => !DILEWATI.has(n) && !POLA_INTERNAL.test(n));
  // Urutan pemulihan dulu; tabel yang belum terdaftar (baru dibuat) menyusul
  // di belakang supaya tidak pernah terlewat hanya karena lupa didaftarkan.
  const dikenal = URUTAN_PEMULIHAN.filter(n => nama.includes(n));
  const baru = nama.filter(n => !URUTAN_PEMULIHAN.includes(n)).sort();
  return [...dikenal, ...baru];
}

/**
 * Baca seluruh isi satu tabel.
 *
 * Dibaca bertahap (bukan satu SELECT besar) supaya tabel yang tumbuh besar
 * tidak memakan memori sekaligus. Catatan jujur: ini BUKAN potret sesaat yang
 * konsisten — kalau ada yang menyimpan data di tengah proses, tabel yang sudah
 * lewat tidak ikut berubah. Untuk database sekecil ini bedanya tidak terasa,
 * dan menandainya di manifest lebih baik daripada berpura-pura konsisten.
 */
export async function bacaTabel(db: D1Database, tabel: string, maks = 1000): Promise<unknown[]> {
  const semua: unknown[] = [];
  for (let offset = 0; ; offset += maks) {
    const r = await db.prepare(`SELECT * FROM "${tabel}" LIMIT ? OFFSET ?`)
      .bind(maks, offset).all();
    const baris = r.results || [];
    semua.push(...baris);
    if (baris.length < maks) break;
  }
  return semua;
}

/** Jalankan backup lengkap dan kembalikan isinya (belum disimpan). */
export async function buatBackup(db: D1Database, pemicu = 'manual'): Promise<HasilBackup> {
  const tabel = await daftarTabel(db);
  const data: Record<string, unknown[]> = {};
  const ringkas: Record<string, RingkasanTabel> = {};
  for (const t of tabel) {
    const baris = await bacaTabel(db, t);
    data[t] = baris;
    ringkas[t] = { baris: baris.length, sha256: await sha256(JSON.stringify(baris)) };
  }
  const skema = await bacaSkema(db);
  const isi = JSON.stringify({ manifest_ringkas: ringkas, data });
  const stempel = new Date().toISOString();
  return {
    manifest: {
      jenis: 'backup-database-d1-belift',
      dibuat_pada: stempel,
      sumber: 'cloudflare-d1',
      jumlah_tabel: tabel.length,
      jumlah_baris: Object.values(ringkas).reduce((a, r) => a + r.baris, 0),
      ukuran_byte: new TextEncoder().encode(isi).length,
      tabel: ringkas,
      tabel_dilewati: Array.from(DILEWATI),
      catatan: 'Hanya database. Berkas R2 (foto survey, tanda tangan, gambar desain) TIDAK termasuk.',
      pemicu,
    },
    skema,
    kunci: kunciBackup(stempel),
    data,
  };
}

/** Nama berkas backup: terurut secara alfabet = terurut secara waktu. */
export function kunciBackup(stempel: string): string {
  const t = stempel.replace(/[:.]/g, '-').replace('Z', 'Z');
  return `backups/d1/${t.slice(0, 10)}/${t}.json`;
}

/** Simpan backup ke R2. */
export async function simpanBackup(bucket: R2Bucket, hasil: HasilBackup): Promise<number> {
  // `skema` WAJIB ikut ditulis. Tanpa ini berkasnya hanya berisi baris data
  // tanpa definisi tabelnya — dan itu baru ketahuan saat pemulihan dicoba,
  // yaitu saat database sudah hilang. Sempat terjadi; lihat uji pemulihan.
  const isi = JSON.stringify({
    manifest: hasil.manifest,
    skema: hasil.skema,
    data: hasil.data,
  });
  await bucket.put(hasil.kunci, isi, {
    httpMetadata: { contentType: 'application/json;charset=utf-8' },
  });
  return new TextEncoder().encode(isi).length;
}

/**
 * Buang backup lama, sisakan `simpan` yang terbaru.
 *
 * Dijalankan sesudah backup baru tersimpan, bukan sebelumnya — supaya kalau
 * penghapusan gagal, yang terbaru sudah aman lebih dulu.
 */
export async function bersihkanLama(bucket: R2Bucket, simpan = 30): Promise<string[]> {
  const daftar: string[] = [];
  let kursor: string | undefined;
  do {
    const r = await bucket.list({ prefix: 'backups/d1/', cursor: kursor, limit: 1000 });
    daftar.push(...r.objects.map(o => o.key));
    kursor = r.truncated ? r.cursor : undefined;
  } while (kursor);

  // Nama berkas memuat stempel ISO, jadi urutan alfabet menurun = terbaru dulu.
  daftar.sort().reverse();
  const dibuang = daftar.slice(simpan);
  if (dibuang.length) await bucket.delete(dibuang);
  return dibuang;
}

/** Daftar backup yang tersimpan di R2, terbaru lebih dulu. */
export async function daftarBackup(bucket: R2Bucket, batas = 100) {
  const r = await bucket.list({ prefix: 'backups/d1/', limit: Math.min(batas, 1000) });
  return r.objects
    .map(o => ({ kunci: o.key, ukuran: o.size, dibuat_pada: o.uploaded?.toISOString() || null }))
    .sort((a, b) => b.kunci.localeCompare(a.kunci));
}

/** Jalankan backup lalu simpan + bersihkan yang lama. Dipakai cron & tombol UI. */
export async function jalankanBackup(
  db: D1Database, bucket: R2Bucket, opsi: { simpan?: number; pemicu?: string } = {},
) {
  const hasil = await buatBackup(db, opsi.pemicu || 'manual');
  const ukuran = await simpanBackup(bucket, hasil);
  const dibuang = await bersihkanLama(bucket, opsi.simpan ?? 30);
  return { ...hasil.manifest, ukuran_byte: ukuran, kunci: hasil.kunci, dibuang };
}
