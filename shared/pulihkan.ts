/**
 * Pemulihan (restore) database D1 dari berkas backup.
 *
 * KENAPA DIPISAH DARI shared/backup.ts: modul itu dipakai oleh worker terjadwal
 * yang hanya perlu MEMBUAT backup. Pemulihan hanya dipakai saat keadaan darurat
 * atau saat uji — jadi jangan sampai ikut terbawa ke jalur yang berjalan tiap
 * hari. Lebih sedikit kode yang berjalan, lebih sedikit yang bisa salah.
 *
 * ATURAN KESELAMATAN yang dipegang berkas ini:
 *   1. Pemulihan HANYA boleh jalan di database PERCOBAAN. Ada penjaga eksplisit
 *      (lihat `pastikanBukanProduksi`) — salah sasaran berarti menimpa data
 *      sungguhan, dan itu tidak bisa dibatalkan.
 *   2. Database tujuan harus KOSONG. Kalau sudah ada tabel, pemulihan berhenti
 *      sebelum mengubah apa pun. Menimpa database yang sudah terisi tanpa
 *      sengaja adalah cara paling cepat kehilangan data.
 *   3. Setiap tabel diverifikasi sesudah dipulihkan: jumlah baris DAN sidik
 *      jari (sha256) harus sama dengan catatan di manifest. Backup yang "sudah
 *      dipulihkan" tapi isinya berbeda adalah kegagalan yang lebih berbahaya
 *      daripada pemulihan yang gagal terang-terangan.
 */
import type { D1Database } from '@cloudflare/workers-types';

/** Nama yang menandakan database produksi. Dipakai penjaga di bawah. */
const NAMA_PRODUKSI = ['sph-management-db'];

export interface LaporanPemulihan {
  tabel_dipulihkan: Record<string, { baris: number; cocok: boolean }>;
  jumlah_baris: number;
  jumlah_tabel: number;
  skema_dibuat: number;
  cocok_semua: boolean;
  selisih: string[];
}

/**
 * Penjaga: tolak pemulihan ke database produksi.
 *
 * Sengaja memeriksa NAMA, bukan sekadar mengandalkan disiplin pemanggil. Salah
 * satu kesalahan di sini menimpa data sungguhan.
 *
 * Perbandingan memakai nama PERSIS (atau berawalan nama produksi + pemisah),
 * bukan "mengandung". Kalau memakai "mengandung", database uji yang justru
 * diberi nama jelas seperti `sph-management-db-uji` akan ikut ditolak — dan
 * penjaga yang terlalu galak sama merepotkannya dengan tidak ada penjaga,
 * karena orang akan mencarinya jalan pintas.
 */
export function pastikanBukanProduksi(namaDatabase: string): void {
  const bersih = (namaDatabase || '').trim().toLowerCase();
  if (!bersih) {
    throw new Error('Nama database tujuan kosong — pemulihan dibatalkan.');
  }

  // Nama yang jelas-jelas untuk uji selalu diizinkan, walau memuat nama
  // produksi (mis. `sph-management-db-uji`). Kalau tidak, orang akan mencari
  // jalan pintas dan penjaganya malah dilewati.
  const jelasUji = /(^|[-_])(uji|test|percobaan|staging|copy|salinan)($|[-_])/.test(bersih);
  if (jelasUji) return;

  for (const p of NAMA_PRODUKSI) {
    const namaPersis = bersih === p;
    // Nama turunan tanpa penanda uji (`sph-management-db-baru`) ikut ditolak:
    // terlalu mudah keliru dianggap aman.
    const namaTurunan = bersih.startsWith(p + '-') || bersih.startsWith(p + '_');
    if (namaPersis || namaTurunan) {
      throw new Error(
        `DITOLAK: "${namaDatabase}" adalah database produksi. ` +
        `Pemulihan hanya boleh ke database percobaan.`);
    }
  }
}

/**
 * Penjaga: tujuan harus benar-benar kosong.
 *
 * Tabel internal (sqlite_*, _cf_*, d1_migrations) TIDAK dihitung: Cloudflare
 * membuatnya sendiri, dan bukan data milik pengguna.
 */
export async function pastikanKosong(db: D1Database): Promise<void> {
  const r = await db.prepare(
    `SELECT COUNT(*) AS n FROM sqlite_master
     WHERE type='table'
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE '\\_cf\\_%' ESCAPE '\\'
       AND lower(name) <> 'd1_migrations'`
  ).first<{ n: number }>();
  const n = r?.n ?? 0;
  if (n > 0) {
    throw new Error(
      `DITOLAK: database tujuan sudah berisi ${n} tabel. ` +
      `Pemulihan hanya boleh ke database kosong, supaya tidak menimpa data yang ada.`);
  }
}

/** Buat seluruh tabel/index/trigger dari skema yang tersimpan di backup. */
export async function buatSkema(db: D1Database, skema: { sql: string }[]): Promise<number> {
  let n = 0;
  for (const s of skema) {
    if (!s?.sql) continue;
    await db.prepare(s.sql).run();
    n++;
  }
  return n;
}

/**
 * Masukkan baris ke satu tabel.
 *
 * Nama kolom diambil dari data itu sendiri, jadi backup lama yang kolomnya
 * berbeda tetap bisa dipulihkan selama kolomnya ada di skema.
 */
export async function isiTabel(
  db: D1Database, tabel: string, baris: Record<string, unknown>[],
): Promise<number> {
  if (!baris?.length) return 0;
  let n = 0;
  for (const b of baris) {
    const kolom = Object.keys(b);
    if (!kolom.length) continue;
    const tanda = kolom.map(() => '?').join(',');
    const nama = kolom.map(k => `"${k}"`).join(',');
    await db.prepare(`INSERT INTO "${tabel}" (${nama}) VALUES (${tanda})`)
      .bind(...kolom.map(k => b[k]))
      .run();
    n++;
  }
  return n;
}

/** Sidik jari sha256, sama seperti yang dipakai saat membuat backup. */
export async function sha256(teks: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(teks));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Pulihkan backup ke database KOSONG, lalu verifikasi hasilnya.
 *
 * `namaDatabase` dipakai untuk penjaga; `urutan` menentukan induk-sebelum-anak
 * supaya foreign key tidak dilanggar.
 */
export async function pulihkanBackup(
  db: D1Database,
  backup: {
    skema?: { sql: string }[];
    data?: Record<string, unknown[]>;
    manifest?: { tabel?: Record<string, { baris: number; sha256: string }> };
  },
  opsi: { namaDatabase: string; urutan: string[]; saatMasuk?: (t: string, n: number) => void },
): Promise<LaporanPemulihan> {
  // Penjaga dijalankan PALING AWAL — sebelum satu perintah pun menyentuh database.
  pastikanBukanProduksi(opsi.namaDatabase);
  await pastikanKosong(db);

  const skema = backup.skema || [];
  if (!skema.length) {
    throw new Error(
      'Backup ini tidak memuat skema (berkas lama sebelum perbaikan). ' +
      'Tidak bisa membangun ulang database — buat backup baru lebih dulu.');
  }
  const skemaDibuat = await buatSkema(db, skema);

  const data = backup.data || {};
  const catatan = backup.manifest?.tabel || {};

  // Urutkan sesuai daftar pemulihan; tabel yang tak terdaftar ditaruh di akhir.
  const semua = Object.keys(data);
  const dikenal = opsi.urutan.filter(t => semua.includes(t));
  const lain = semua.filter(t => !opsi.urutan.includes(t)).sort();
  const urut = [...dikenal, ...lain];

  const hasil: Record<string, { baris: number; cocok: boolean }> = {};
  const selisih: string[] = [];
  let total = 0;

  for (const t of urut) {
    const baris = data[t] || [];
    const n = await isiTabel(db, t, baris as Record<string, unknown>[]);
    total += n;
    opsi.saatMasuk?.(t, n);

    // Verifikasi: jumlah baris harus sama, dan isinya harus identik.
    const harap = catatan[t]?.baris;
    const nyata = await db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).first<{ n: number }>();
    const nNyata = nyata?.n ?? 0;
    let cocok = nNyata === baris.length && (harap === undefined || nNyata === harap);
    if (cocok && catatan[t]?.sha256) {
      const sesudah = await db.prepare(`SELECT * FROM "${t}"`).all<Record<string, unknown>>();
      const cap = await sha256(JSON.stringify(sesudah.results || []));
      if (cap !== catatan[t].sha256) {
        cocok = false;
        selisih.push(`${t}: sidik jari berbeda (isi tidak identik)`);
      }
    }
    if (!cocok && !selisih.some(s => s.startsWith(t + ':'))) {
      selisih.push(`${t}: diharapkan ${harap ?? baris.length} baris, terbaca ${nNyata}`);
    }
    hasil[t] = { baris: nNyata, cocok };
  }

  return {
    tabel_dipulihkan: hasil,
    jumlah_baris: total,
    jumlah_tabel: urut.length,
    skema_dibuat: skemaDibuat,
    cocok_semua: selisih.length === 0,
    selisih,
  };
}
