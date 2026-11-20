/**
 * Mesin cetak bersama untuk dokumen PDF.
 *
 * KENAPA ADA: semua dokumen (SPH, Survey, Lacak, PO) dicetak lewat JENDELA
 * BARU (`window.open`). Kalau HTML-nya masih memuat
 * `<img src="/api/media?key=…">`, jendela barulah yang meminta gambarnya
 * sendiri — dan cookie sesinya belum tentu ikut, karena jendela pop-up sering
 * dianggap konteks pihak ketiga oleh browser. Kalau cookie tidak ikut,
 * /api/media membalas 401 dan gambar di hasil cetak/PDF bolong tanpa pesan apa
 * pun. Jenis kerusakan yang muncul di komputer orang lain, tidak di komputer
 * kita.
 *
 * Jalan keluarnya: ambil gambarnya dari jendela UTAMA — di situ sesi sudah
 * pasti ada — lalu ubah jadi alamat blob yang dipakai jendela baru tanpa
 * meminta apa pun lagi ke server.
 *
 * Modul ini sengaja tidak bergantung pada React atau dokumen tertentu, supaya
 * semua jenis dokumen bisa memakai jalur yang sama.
 */

import { CSS_KOP } from './spk-susun';

/** Alamat media di dalam HTML dokumen (foto survey, desain, tanda tangan). */
const POLA_MEDIA = /\/api\/media\?key=[^"'\s\\]+/g;

/**
 * Berkas gambar kotak judul. Dipakai untuk mengganti penanda KOSONG `url('')`
 * — lihat `CSS_KOP` di `spk-susun.ts`.
 */
const ALAMAT_KOP = '/corner-shape-bg.png';

/**
 * Berkas gambar yang masih memakai alamat relatif ke aplikasi.
 *
 * Polanya sengaja TIDAK menebak akhiran berkas. Sebelumnya hanya `\.png` dsb
 * yang dikenali, sehingga `url('')` — bentuk yang dipakai `CSS_KOP` di
 * `spk-susun.ts` (lihat alasan di sana) — lolos tanpa diganti. Di jendela
 * `about:blank` alamat kosong TIDAK bisa diselesaikan, jadi latar kotak judul
 * hilang di PDF padahal terlihat benar di pratinjau.
 *
 * Aturan: penanda pembuka/penutup yang cocok (`'…'`, `"…"`, `(…)`) dengan isi
 * kosong ATAU diawali satu `/` tapi bukan `//` atau `/api/`. Penanda pembuka dan
 * penutup WAJIB sama jenisnya — backreference `\1` — supaya `url('')` tidak
 * tertukar dengan pasangan tanda kutip lain di deklarasi yang sama.
 */
const POLA_ASET_LOKAL = /(['"()])(\/(?!\/|api\/)[^'"()\s]*)?\1/g;

/** Pengambil berkas. Dipisah begini supaya bisa diganti di uji. */
export type PengambilMedia = (alamat: string) => Promise<{ ok: boolean; blob: () => Promise<Blob> }>;

const ambilBawaan: PengambilMedia = (a) => fetch(a, { credentials: 'same-origin' });

/**
 * Ganti setiap alamat /api/media di dalam HTML dengan alamat blob lokal.
 *
 * Alamat yang gagal diambil DIBIARKAN apa adanya — lebih baik satu gambar
 * gagal tampil daripada seluruh dokumen tidak bisa dicetak sama sekali.
 */
export async function gantiAlamatMedia(
  html: string,
  ambil: PengambilMedia = ambilBawaan,
): Promise<{ html: string; blobUrls: string[] }> {
  const alamat = Array.from(new Set(html.match(POLA_MEDIA) || []));
  const blobUrls: string[] = [];
  let hasil = html;
  for (const a of alamat) {
    try {
      const r = await ambil(a);
      if (!r.ok) continue;
      const url = URL.createObjectURL(await r.blob());
      blobUrls.push(url);
      hasil = hasil.split(a).join(url);
    } catch {
      // Jaringan gagal / fetch tidak tersedia — pakai alamat aslinya.
    }
  }
  return { html: hasil, blobUrls };
}

/**
 * Ganti aset gambar bawaan aplikasi (latar halaman, logo) dengan alamat blob.
 *
 * Ini WAJIB, bukan pemanis. Jendela cetak hasil `window.open('')` adalah
 * halaman `about:blank`, dan alamat relatif seperti `/hexagon-outline-bg.png`
 * di sana tidak bisa diselesaikan — gambarnya hilang. Waktu dokumen masih
 * dipratinjau di dalam aplikasi hal ini tidak terlihat, karena alamat
 * relatifnya kebetulan benar. Jadi cetak lewat pratinjau selalu kehilangan
 * latar, dan itu terjadi bahkan sebelum sesi diwajibkan.
 *
 * Yang gagal diambil dibiarkan apa adanya.
 */
export async function gantiAsetLokal(
  html: string,
  ambil: PengambilMedia = ambilBawaan,
): Promise<{ html: string; blobUrls: string[] }> {
  // Alamat kosong (`url('')`) berarti "latar yang sudah ditentukan CSS_KOP",
  // jadi yang diambil adalah berkas kotak judulnya.
  const alamat = Array.from(new Set(
    Array.from(html.matchAll(POLA_ASET_LOKAL)).map(m => m[2] || ALAMAT_KOP),
  ));
  const blobUrls: string[] = [];
  let hasil = html;
  for (const a of alamat) {
    try {
      const r = await ambil(a);
      if (!r.ok) continue;
      const url = URL.createObjectURL(await r.blob());
      blobUrls.push(url);
      hasil = hasil.split(`"${a}"`).join(`"${url}"`)
                  .split(`'${a}'`).join(`'${url}'`)
                  .split(`(${a})`).join(`(${url})`);
      if (a === ALAMAT_KOP) {
        // Penanda kosong tidak punya isi untuk dicari, jadi diganti apa adanya.
        hasil = hasil.split(`''`).join(`'${url}'`).split('()').join(`(${url})`);
      }
    } catch {
      // biarkan alamat aslinya
    }
  }
  return { html: hasil, blobUrls };
}

/**
 * Pastikan kotak judul (kiri atas) memakai gambar yang BENAR.
 *
 * Kenapa perlu, padahal `gantiAsetLokal()` sudah mengganti alamatnya?
 *
 * CSS dokumen cetak menyusun kotak judul dari `.page`:
 *   `.page` punya `background:#fff url('…') no-repeat left top` — inilah
 *   `corner-shape-bg.png` (sudut oranye) yang dipakai pratinjau, dan gambar itu
 *   sudah lengkap bentuknya. TIDAK ada kotak penutup di atasnya.
 *
 * Dokumen cetak lama masih membawa `.page::before` (kotak oranye) dan
 * `.page::after` (kotak bergaris putih). Dua lapisan itu membuat kop PDF
 * berbeda dari pratinjau, jadi `CSS_KOP` mematikannya.
 *
 * `gantiAsetLokal()` MENULIS ULANG seluruh deklarasi `background` (bukan hanya
 * alamatnya). Begitu bentuknya berbeda sedikit — urutan, ada tidaknya
 * `background-size`, blob vs alamat biasa — hasil di jendela cetak tidak lagi
 * sama dengan yang dilihat pengguna di pratinjau. Inilah sebab kop kiri atas
 * PDF terlihat berbeda dari `/preview`.
 *
 * Fungsi ini menyisipkan aturan PENIMPA di akhir `<head>` supaya kotak judul
 * selalu identik dengan pratinjau, apa pun yang dilakukan penggantian gambar
 * sebelumnya. Diagonal jendela melewati `.page` yang sama, jadi latarnya sama.
 *
 * ATURAN: `CSS_KOP` sengaja memakai penanda kosong `url('')`. Di sini penanda
 * itu diganti alamat berkas yang sebenarnya. Dengan begitu bentuk deklarasinya
 * persis sama dengan pratinjau, dan saat dicetak, `gantiAsetLokal()` (yang
 * jalan SESUDAH ini) mengubahnya jadi blob.
 */
const INLINE_KOP = CSS_KOP.replace("url('')", "url('" + ALAMAT_KOP + "')");

export function jagaKopJudul(html: string): string {
  // Cukup untuk dokumen ber-.page (SPK/SPH/Survey). Dokumen lain dibiarkan.
  if (!html.includes('.page{')) return html;
  // Pakai alamat asli, bukan blob: aturan ini disisipkan SETELAH blob dipasang,
  // jadi kalau blob diminta di sini jendela cetak akan memintanya lagi ke
  // jendela utama — dan permintaan itu balapan dengan pelepasan blob.
  //
  // `gantiAsetLokal()` tidak lagi melihat aturan ini (disisipkan setelahnya),
  // jadi penanda kosong di `CSS_KOP` diganti DI SINI. Hasil akhirnya sama:
  // satu blob untuk corner-shape-bg.png, dipakai aturan penimpa.
  const aturan = '<style id="kop-judul">' + INLINE_KOP + '</style>';
  const akhirKepala = html.lastIndexOf('</head>');
  if (akhirKepala >= 0) return html.slice(0, akhirKepala) + aturan + html.slice(akhirKepala);
  // Tidak ada <head>: taruh sebelum <body> supaya tetap menang urutan.
  const badan = html.indexOf('<body');
  if (badan >= 0) return html.slice(0, badan) + aturan + html.slice(badan);
  return aturan + html;
}

/** Tunggu gambar di jendela selesai dimuat (paling lama 4 detik) sebelum cetak. */
export function tungguGambar(win: Window): Promise<void> {
  return new Promise(selesai => {
    const mulai = Date.now();
    const cek = () => {
      const gambar = Array.from(win.document.images || []);
      if (!gambar.some(g => !g.complete) || Date.now() - mulai > 4000) return selesai();
      setTimeout(cek, 120);
    };
    cek();
  });
}

/** Lepaskan alamat blob supaya memorinya tidak menumpuk. */
export function lepasBlob(blobUrls: string[]) {
  for (const u of blobUrls) {
    try { URL.revokeObjectURL(u); } catch { /* sudah dilepas */ }
  }
}

/**
 * Buka jendela baru, siapkan gambarnya, lalu cetak.
 *
 * URUTANNYA DISENGAJA — jangan diubah tanpa alasan:
 *  1. `window.open` dipanggil SEBELUM `await` apa pun, supaya masih termasuk
 *     gestur klik pengguna. Kalau dipanggil setelah `await`, pemblokir pop-up
 *     menganggapnya bukan permintaan pengguna lalu memblokir jendelanya, dan
 *     pengguna hanya melihat peringatan "Pop-up diblokir".
 *  2. Baru setelah jendela terbuka, gambarnya diambil dari jendela utama ini.
 *  3. `document.write` kedua tidak menunggu apa pun, jadi klik yang cepat
 *     tidak bisa "menyusul" dan mencetak versi tanpa gambar.
 */
export async function cetakHtml(html: string, judul: string) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { window.alert('Pop-up diblokir. Izinkan pop-up untuk mencetak.'); return; }

  // Jendela sudah terbuka tapi gambarnya belum siap — beri tahu supaya
  // pengguna tidak melihat tab kosong tanpa penjelasan.
  try {
    win.document.write(
      '<p style="font:14px system-ui,sans-serif;padding:24px;color:#334">Menyiapkan dokumen…</p>');
    win.document.close();
  } catch { /* jendela sudah ditutup pengguna */ }

  let blobUrls: string[] = [];
  let siap = html;
  try {
    // Aset lokal dulu, lalu media — supaya keduanya sudah jadi blob sebelum
    // jendela baru menggambar apa pun.
    // Urutan ini DISENGAJA: sisipkan aturan kop DULU, baru ganti gambar.
    // Kalau dibalik, aturan kop dimasukkan setelah penggantian selesai — dan
    // latar kotak judul di dalamnya tidak pernah jadi blob, sehingga di jendela
    // `about:blank` latar itu gagal dimuat. Itulah sebabnya kop hasil PDF
    // berbeda dari pratinjau.
    const a = await gantiAsetLokal(jagaKopJudul(html));
    const b = await gantiAlamatMedia(a.html);
    siap = b.html;
    blobUrls = [...a.blobUrls, ...b.blobUrls];
  } catch {
    // Penyiapan gagal: tetap cetak dengan alamat aslinya.
  }

  try {
    win.document.open();
    win.document.write(siap);
    win.document.close();
  } catch { /* jendela sudah ditutup pengguna */ }

  // Bebaskan memori blob setelah selesai mencetak. `afterprint` tidak ada di
  // semua browser, jadi tetap ada batas waktu sebagai cadangan.
  const bersihkan = () => lepasBlob(blobUrls);
  try { win.addEventListener('afterprint', bersihkan); } catch { /* jendela uji */ }
  setTimeout(bersihkan, 300000);

  // `onload` jendela tidak selalu terpicu lagi setelah document.write, jadi
  // yang ditunggu adalah gambarnya sendiri.
  await tungguGambar(win);
  try { win.focus(); win.print(); } catch { /* jendela sudah ditutup pengguna */ }
}
