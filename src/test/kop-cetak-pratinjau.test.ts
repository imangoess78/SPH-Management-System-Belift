/**
 * Uji: kotak judul (kiri atas) di jendela CETAK harus sama dengan PRATINJAU.
 *
 * Keluhan Mas: halaman `/preview` memakai `corner-shape-bg.png` di sudut kiri
 * atas, tapi hasil "Cetak / Simpan PDF" dari halaman `/edit` terlihat berbeda.
 *
 * Yang dijaga di sini bukan "gambarnya ada", tapi URUTAN dan BENTUK akhir HTML
 * yang dikirim ke jendela cetak, karena di situlah bedanya muncul:
 *   1. `gantiAsetLokal()` mengganti alamat gambar relatif jadi blob.
 *   2. `jagaKopJudul()` menyisipkan aturan penimpa SETELAHNYA — jadi aturan itu
 *      harus memakai alamat yang masih bisa diganti (bukan blob), dan penggantian
 *      harus benar-benar sampai ke aturan itu.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gantiAsetLokal, jagaKopJudul, type PengambilMedia } from '@/lib/cetak';
import { CSS_KOP } from '@/lib/spk-susun';

/**
 * jsdom tidak menyediakan `URL.createObjectURL`. Tanpa ini, `gantiAsetLokal()`
 * menelan galatnya di `catch` dan uji akan lulus dengan kesan "tidak ada blob"
 * padahal produksi baik-baik saja — jenis uji yang menguji kesalahannya sendiri.
 */
const URL_ASLI = (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
let nomorBlob = 0;
beforeAll(() => {
  (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL =
    () => 'blob:https://sph.belift.co.id/' + (++nomorBlob);
});
afterAll(() => {
  (URL as unknown as { createObjectURL?: unknown }).createObjectURL = URL_ASLI;
});

const CSS_PAGE = ".page{width:210mm;background:#fff url('/corner-shape-bg.png') no-repeat left top;" +
  'background-size:33.8mm auto;padding:18mm}' +
  '.page::before{content:"";position:absolute;left:0;top:0;width:34mm;height:24mm;' +
  'background:#D95103;border-bottom-right-radius:9mm}' +
  '.page::after{content:"";position:absolute;left:6mm;top:0;width:26mm;height:20mm;' +
  'border:.7pt solid #fff;border-bottom-right-radius:8mm}';

const DOK = '<html><head><style>' + CSS_PAGE + '</style></head>' +
  '<body><div class="page"><img src="/hexagon-outline-bg.png"></div></body></html>';

/** Pengambil palsu: mencatat alamat yang diminta, membalas blob unik per alamat. */
function ambilPalsu(catatan: string[]): PengambilMedia {
  let n = 0;
  return async (alamat) => {
    catatan.push(alamat);
    n += 1;
    return {
      ok: true,
      blob: async () => new Blob([new Uint8Array([0x89, 0x50, n])], { type: 'image/png' }),
    };
  };
}

/** Tulis urutan yang sama dengan `cetakHtml()`. */
async function siapkanCetak(html: string, catatan: string[]) {
  // Persis seperti `cetakHtml()`: sisipkan aturan kop DULU, baru ganti semua
  // alamat relatif jadi blob — termasuk yang ada di dalam aturan kop itu.
  const b = jagaKopJudul(html);
  const a = await gantiAsetLokal(b, ambilPalsu(catatan));
  return { html: a.html, blobUrls: a.blobUrls };
}

describe('gantiAsetLokal — mengubah alamat gambar relatif menjadi blob', () => {
  it('mengganti keempat alamat sekaligus (latar, img, dan aturan CSS_KOP)', async () => {
    const catatan: string[] = [];
    // Dokumen seperti yang dihasilkan printDocument(): gaya .page bersarang
    // ditambah aturan CSS_KOP yang disisipkan jagaKopJudul().
    const dok = DOK.replace('</style>', CSS_KOP + '</style>');
    const { html, blobUrls } = await gantiAsetLokal(dok, ambilPalsu(catatan));
    expect(catatan.length).toBeGreaterThan(0);
    expect(blobUrls.length).toBeGreaterThan(0);
    expect(html).not.toContain("'/corner-shape-bg.png'");
    expect(html).not.toContain('"/hexagon-outline-bg.png"');
    expect(html).not.toContain("url('')");
  });

  it('mengganti aturan CSS_KOP juga — alamat kosong ikut ditangani', async () => {
    // Inilah celah yang dulu membuat kop cetak berbeda dari pratinjau: pola
    // lama hanya mengenali alamat berakhiran .png, sehingga url('') lolos.
    const catatan: string[] = [];
    const dok = DOK.replace('</style>', CSS_KOP + '</style>');
    const { html } = await gantiAsetLokal(dok, ambilPalsu(catatan));
    expect(html).not.toContain("url('')");
    expect(catatan).toContain('/corner-shape-bg.png');
  });

  it('alamat yang gagal diambil dibiarkan apa adanya', async () => {
    const gagal: PengambilMedia = async () => ({ ok: false, blob: async () => new Blob() });
    const { html, blobUrls } = await gantiAsetLokal(DOK, gagal);
    expect(blobUrls).toEqual([]);
    expect(html).toContain("'/corner-shape-bg.png'");
  });
});

describe('jagaKopJudul — mengunci kotak judul sama dengan pratinjau', () => {
  it('menyisipkan aturan penimpa tepat sebelum </head>', () => {
    const hasil = jagaKopJudul(DOK);
    expect(hasil).toContain('<style id="kop-judul">');
    expect(hasil.indexOf('kop-judul')).toBeLessThan(hasil.indexOf('</head>'));
  });

  it('penimpa ditaruh SETELAH gaya asli supaya menang urutan', () => {
    const hasil = jagaKopJudul(DOK);
    expect(hasil.indexOf('kop-judul')).toBeGreaterThan(hasil.indexOf('background-size:33.8mm auto'));
  });

  it('pakai !important dan mencakup halaman lanjutan', () => {
    const aturan = /<style id="kop-judul">([\s\S]*?)<\/style>/.exec(jagaKopJudul(DOK))![1];
    expect(aturan).toContain('background:#fff');
    expect(aturan).toContain('!important');
    expect(aturan).toContain('background-size:33.8mm auto!important');
    expect(aturan).toContain('.page.spk-body');
    expect(aturan).toContain('.page.cont');
  });

  it('dokumen tanpa .page dibiarkan apa adanya', () => {
    const lain = '<html><head><style>.foo{color:red}</style></head><body>x</body></html>';
    expect(jagaKopJudul(lain)).toBe(lain);
  });
});

describe('urutan lengkap seperti cetakHtml() — hasil akhir untuk jendela cetak', () => {
  it('aturan kop ikut jadi blob, bukan alamat relatif/kosong', async () => {
    const catatan: string[] = [];
    const { html, blobUrls } = await siapkanCetak(DOK, catatan);

    const aturan = /<style id="kop-judul">([\s\S]*?)<\/style>/.exec(html)![1];
    // Blob terpasang di aturan penimpa...
    expect(aturan).toMatch(/url\('blob:[^']+'\)/);
    // ...dan tidak ada lagi alamat kosong atau relatif yang lolos.
    expect(aturan).not.toContain("url('')");
    expect(html).not.toMatch(/url\('\/[^']*'\)/);
    // Blob yang dipakai aturan penimpa memang blob yang sudah dibuat & tercatat,
    // supaya tidak ada permintaan baru ke jendela utama saat mencetak.
    const dipakai = aturan.match(/blob:[^')]+/)![0];
    expect(blobUrls).toContain(dipakai);
  });

  it('gambar latar tetap corner-shape-bg.png, bukan hexagon', async () => {
    const catatan: string[] = [];
    const { html } = await siapkanCetak(DOK, catatan);
    // Yang diminta sebagai latar kop adalah corner-shape-bg.png.
    expect(catatan).toContain('/corner-shape-bg.png');
    // Hexagon hanya boleh muncul sebagai <img> dekorasi, tidak sebagai latar.
    const aturan = /<style id="kop-judul">([\s\S]*?)<\/style>/.exec(html)![1];
    expect(aturan).not.toContain('hexagon');
  });

  it('kotak penutup ::before/::after DIMATIKAN di dokumen cetak', () => {
    // Mas: tampilan yang benar = "hanya corner-shape-bg.png tanpa kotak
    // penutup". Gambar latar sudah menggambar sudut oranye lengkap; kotak
    // oranye (::before) dan kotak garis putih (::after) yang dulu ditambahkan
    // justru membuat kop PDF beda dari /preview.
    const aturan = /<style id="kop-judul">([\s\S]*?)<\/style>/.exec(jagaKopJudul(DOK))![1];
    expect(aturan).toContain('.page::before');
    expect(aturan).toContain('.page::after');
    expect(aturan).toContain('content:none!important');
    expect(aturan).toContain('display:none!important');
  });

  it('dokumen cetak sendiri tidak lagi membawa kotak penutup', () => {
    // Sumbernya di SPHForm.printDocument(); CSS_KOP hanya jaring pengaman.
    const src = readFileSync(resolve(process.cwd(), 'src/pages/SPHForm.tsx'), 'utf8');
    expect(src).not.toContain('.page::before');
    expect(src).not.toContain('.page::after');
    expect(src).not.toContain('border-bottom-right-radius:9mm');
  });
});

describe('CSS_KOP — satu sumber untuk pratinjau, cetak, dan generator', () => {
  it('CSS_KOP yang disisipkan jagaKopJudul hanya beda alamat gambar', () => {
    const aturan = /<style id="kop-judul">([\s\S]*?)<\/style>/.exec(jagaKopJudul(DOK))![1];
    // Bentuknya harus identik dengan pratinjau; satu-satunya beda adalah
    // penanda kosong yang sudah diganti alamat berkas nyata.
    expect(aturan).toBe(CSS_KOP.replace("url('')", "url('/corner-shape-bg.png')"));
  });

  it('menyebut ukuran latar yang sama dengan pratinjau', () => {
    expect(CSS_KOP).toContain('background-size:33.8mm auto');
  });
});
