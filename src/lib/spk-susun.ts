/**
 * Penyusun SPK — memecah dokumen menjadi pasal yang bisa diedit.
 *
 * LATAR BELAKANG
 * Sebelum ini seluruh isi SPK (10 pasal, ~200 baris HTML) ditulis langsung di
 * dalam `pageSPK()`. Akibatnya tidak ada satu pun bagian yang bisa diubah sales
 * tanpa developer, padahal isi SPK berbeda-beda antar proyek (termin 3 s/d 9,
 * klausul tambahan, catatan khusus).
 *
 * MODEL PENYIMPANAN (hibrida)
 * - `SusunanSpk` = data terstruktur: daftar pasal, tiap pasal berisi daftar
 *   paragraf. Paragraf bertipe, bukan HTML bebas, supaya bisa digabung ulang
 *   dengan data form kapan saja.
 * - Isian manual pengguna disimpan di `GenState.manualSpk` sebagai
 *   `Record<pasal, { judul?: string; tambahan?: string[] }>`.
 *     · `judul`    → mengganti judul pasal
 *     · `tambahan` → paragraf HTML bebas DITAMBAHKAN di akhir pasal
 *   Data dari form TIDAK PERNAH ditimpa isian manual, dan isian manual tidak
 *   pernah ditimpa data form. Keduanya bertemu di `susunPasal()`.
 *
 * KENAPA TIDAK SEMUA JADI HTML BEBAS
 * Kalau seluruh dokumen disimpan sebagai HTML, mengedit ulang form (ganti harga,
 * desain, termin) tidak akan memperbarui dokumen — dua sumber kebenaran saling
 * bertabrakan. Dengan pemisahan ini, bagian yang berasal dari form selalu segar,
 * dan bagian yang diketik manusia selalu utuh.
 */

/** Satu paragraf pada badan pasal. */
export type BlokPasal =
  | { t: 'p'; html: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'tabel_termin'; items: TerminCetak[] }
  | { t: 'tabel_nilai'; items: { label: string; nominal: number }[] };

export interface TerminCetak {
  urutan: string;
  persen: number;
  nominal: number;
  syarat: string;
  /** Tanggal termin (opsional) — format YYYY-MM-DD. */
  tanggal?: string;
}

export interface Pasal {
  no: number;
  judul: string;
  blok: BlokPasal[];
}

export interface SusunanSpk {
  /** Paragraf pembuka di halaman 1 (sebelum pasal 1). */
  pembuka: BlokPasal[];
  pasal: Pasal[];
}

/** Isian manual pengguna, disimpan per nomor pasal. */
export interface ManualPasal {
  judul?: string;
  /**
   * ISI PENGGANTI pasal — HTML penuh hasil suntingan pengguna di editor.
   *
   * Menggantikan seluruh blok pasal, BUKAN ditambahkan di akhir. Ini penting:
   * pengguna mengedit teks yang ia lihat (teks default dari form), jadi hasil
   * suntingannya harus menjadi isi pasal itu apa adanya. Data form tetap utuh
   * dan kembali dipakai begitu isian ini dikosongkan.
   */
  ganti?: string;
  /**
   * Paragraf HTML tambahan di akhir pasal. Dipertahankan demi kompatibilitas
   * dokumen SPK lama yang sudah tersimpan dengan bentuk ini.
   */
  tambahan?: string[];
  /** Menyembunyikan pasal dari dokumen jadi. */
  sembunyi?: boolean;
}

export type ManualSpk = Record<string, ManualPasal>;

const bersih = (s: unknown) => String(s ?? '').trim();

/**
 * Gabungkan pasal dari form dengan isian manual.
 *
 * Urutan hasil: blok dari form → paragraf tambahan manual. Judul manual
 * menggantikan judul form. Pasal yang ditandai `sembunyi` dibuang.
 * Nomor pasal TIDAK diubah walau ada yang disembunyikan — nomor pasal adalah
 * rujukan hukum, jadi harus tetap seperti yang tertera di dokumen lama.
 */
export function susunPasal(pasal: Pasal[], manual?: ManualSpk): Pasal[] {
  if (!manual) return pasal;
  return pasal
    .filter(p => !manual[String(p.no)]?.sembunyi)
    .map(p => {
      const m = manual[String(p.no)];
      if (!m) return p;
      const judul = bersih(m.judul) || p.judul;
      // Isi pengganti menang: pasal memakai teks suntingan pengguna apa adanya.
      const ganti = bersih(m.ganti);
      if (ganti) {
        return { ...p, judul, blok: [{ t: 'p' as const, html: ganti }] };
      }
      const tambahan = (m.tambahan || []).map(bersih).filter(Boolean);
      if (!tambahan.length) return { ...p, judul };
      return {
        ...p,
        judul,
        blok: [...p.blok, ...tambahan.map(html => ({ t: 'p' as const, html }))],
      };
    });
}

/**
 * Ubah susunan menjadi HTML. Tabel termin/nilai mendapat kelas khusus supaya
 * CSS dokumen bisa mengatur tampilannya.
 */
export function renderPasal(p: Pasal): string {
  return '<div class="pasal-blk">' +
    '<p class="pasal-no">PASAL&nbsp;&nbsp;' + p.no + '</p>' +
    '<p class="pasal-judul">' + p.judul + '</p>' +
    p.blok.map(renderBlok).join('') +
    '</div>';
}

function renderBlok(b: BlokPasal): string {
  switch (b.t) {
    case 'p':
      return b.html;
    case 'ul':
      return '<ul class="ul">' + b.items.map(i => '<li>' + i + '</li>').join('') + '</ul>';
    case 'ol':
      return '<ol class="ol">' + b.items.map(i => '<li>' + i + '</li>').join('') + '</ol>';
    case 'tabel_termin':
      return tabelTermin(b.items);
    case 'tabel_nilai':
      return '<ul class="ul">' + b.items
        .map(i => '<li>' + i.label + ' sebesar <strong>Rp. ' + ribuan(i.nominal) + '</strong></li>')
        .join('') + '</ul>';
  }
}

/**
 * Tabel termin pembayaran. Jumlah baris tidak dibatasi — 3 termin maupun 9
 * termin sama-sama tampil rapi. Kolom tanggal hanya dicetak bila ADA satu saja
 * termin yang bertanggal, supaya SPK lama tidak tiba-tiba punya kolom kosong.
 */
function tabelTermin(items: TerminCetak[]): string {
  const adaLangkah = items.some(t => bersih(t.tanggal));
  const rp = (n: number) => 'Rp. ' + ribuan(n);
  const th = '<thead><tr><th style="width:8mm">No</th><th>Termin</th>' +
    '<th style="width:26mm">Syarat</th>' +
    (adaLangkah ? '<th style="width:26mm">Tanggal</th>' : '') +
    '<th style="width:16mm">%</th><th style="width:34mm">Nominal</th></tr></thead>';
  const tb = items.map((t, i) =>
    '<tr><td style="text-align:center">' + (i + 1) + '</td>' +
    '<td><strong>' + t.urutan + '</strong></td>' +
    '<td>' + t.syarat + '</td>' +
    (adaLangkah ? '<td>' + (bersih(t.tanggal) ? tglId(t.tanggal!) : '—') + '</td>' : '') +
    '<td style="text-align:center">' + t.persen + '%</td>' +
    '<td style="text-align:right">' + rp(t.nominal) + '</td></tr>'
  ).join('');
  const total = items.reduce((a, t) => a + t.nominal, 0);
  const totalPct = items.reduce((a, t) => a + t.persen, 0);
  const tf = '<tr><td colspan="' + (adaLangkah ? 4 : 3) + '" style="text-align:right"><strong>Total</strong></td>' +
    '<td style="text-align:center"><strong>' + totalPct + '%</strong></td>' +
    '<td style="text-align:right"><strong>' + rp(total) + '</strong></td></tr>';
  return '<table class="doc termin-tbl">' + th + '<tbody>' + tb + '</tbody><tfoot>' + tf + '</tfoot></table>';
}

/** "1.234.567" — dipisah supaya modul ini tidak bergantung pada sph-utils. */
function ribuan(n: number): string {
  if (!isFinite(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

const BULAN_ID = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** "2026-12-05" → "5 Desember 2026". */
export function tglId(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(bersih(s));
  if (!m) return s;
  const d = Number(m[3]), bl = Number(m[2]) - 1;
  if (bl < 0 || bl > 11) return s;
  return d + ' ' + BULAN_ID[bl] + ' ' + m[1];
}

/** Daftar ordinal untuk penomoran termin ("Pertama", "Kedua", …). */
export const ORDINAL = ['Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima',
  'Keenam', 'Ketujuh', 'Kedelapan', 'Kesembilan', 'Kesepuluh',
  'Kesebelas', 'Kedua belas'];

// ── Pengaturan cetak (kertas & margin) ───────────────────────

export type UkuranKertas = 'A4' | 'A5' | 'Letter' | 'Legal';

/** Dimensi mm, dipakai untuk menghitung lebar/tinggi halaman di layar & cetak. */
export const DIMENSI_KERTAS: Record<UkuranKertas, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A5: { w: 148, h: 210 },
  Letter: { w: 215.9, h: 279.4 },
  Legal: { w: 215.9, h: 355.6 },
};

export interface PengaturanCetak {
  kertas: UkuranKertas;
  marginAtas: number;
  marginBawah: number;
  marginKiri: number;
  marginKanan: number;
}

/** Margin 18/17/16/17 mm = nilai asli SPK sebelum bisa diatur. */
export const CETAK_AWAL: PengaturanCetak = {
  kertas: 'A4', marginAtas: 18, marginBawah: 16, marginKiri: 17, marginKanan: 17,
};

export const BATAS_MARGIN = { min: 5, max: 60 } as const;

/** Jaga nilai margin tetap masuk akal: angka, dalam batas, dibulatkan. */
export function normalCetak(c?: Partial<PengaturanCetak> | null): PengaturanCetak {
  const kertas: UkuranKertas = (['A4', 'A5', 'Letter', 'Legal'] as const)
    .includes(c?.kertas as UkuranKertas) ? (c!.kertas as UkuranKertas) : 'A4';
  const jaga = (v: unknown, cadangan: number) => {
    const n = Number(v);
    if (!isFinite(n)) return cadangan;
    return Math.min(BATAS_MARGIN.max, Math.max(BATAS_MARGIN.min, Math.round(n)));
  };
  return {
    kertas,
    marginAtas: jaga(c?.marginAtas, CETAK_AWAL.marginAtas),
    marginBawah: jaga(c?.marginBawah, CETAK_AWAL.marginBawah),
    marginKiri: jaga(c?.marginKiri, CETAK_AWAL.marginKiri),
    marginKanan: jaga(c?.marginKanan, CETAK_AWAL.marginKanan),
  };
}

/**
 * CSS pengaturan halaman. Disisipkan ke dokumen cetak supaya `@page` memakai
 * ukuran & margin pilihan pengguna, dan `.page` di layar ikut menyesuaikan.
 *
 * Catatan: `@page{size:…}` hanya dipakai saat mencetak. Lebar `.page` di layar
 * dihitung dari margin supaya pratinjau jujur — apa yang terlihat = apa yang tercetak.
 */
export function cssCetak(c: PengaturanCetak): string {
  const d = DIMENSI_KERTAS[c.kertas];
  const isiW = d.w - c.marginKiri - c.marginKanan;
  return '@page{size:' + c.kertas + ';margin:' + c.marginAtas + 'mm ' + c.marginKanan + 'mm ' +
    c.marginBawah + 'mm ' + c.marginKiri + 'mm}' +
    '.page{width:' + d.w + 'mm;min-height:' + d.h + 'mm;padding:' +
    c.marginAtas + 'mm ' + c.marginKanan + 'mm ' + c.marginBawah + 'mm ' + c.marginKiri + 'mm}' +
    '.page .isi-lebar{width:' + isiW + 'mm}';
}

/**
 * CSS pratinjau DI DALAM aplikasi (bukan dokumen cetak).
 *
 * Pratinjau memakai `.page` yang sama dengan dokumen cetak, jadi cukup menimpa
 * lebar/tinggi/padding. Dipakai HANYA untuk SPK — SPH tetap A4 seperti semula.
 * `!important` perlu karena CSS pratinjau global memakai `.page{width:210mm}`.
 */
export function cssPratinjau(c: PengaturanCetak): string {
  const d = DIMENSI_KERTAS[c.kertas];
  return '.preview-scaler .page{width:' + d.w + 'mm !important;min-height:' + d.h + 'mm !important;padding:' +
    c.marginAtas + 'mm ' + c.marginKanan + 'mm ' + c.marginBawah + 'mm ' + c.marginKiri + 'mm !important}';
}

/** Label ringkas untuk judul pratinjau, mis. "A5 · margin 18/16/17/17 mm". */
export function labelPratinjau(c: PengaturanCetak): string {
  return c.kertas + ' · margin ' + c.marginAtas + '/' + c.marginBawah + '/' + c.marginKiri + '/' + c.marginKanan + ' mm';
}

/**
 * Aturan tampilan pasal — dipakai TIGA tempat: pratinjau di aplikasi (index.css),
 * jendela cetak (SPHForm.printDocument), dan pratinjau generator (SPHPreview).
 *
 * Disimpan di sini supaya ketiganya tidak melenceng. Dulu `.pasal-no` dan
 * `.pasal-judul` tidak punya aturan sama sekali sehingga judul pasal tampil
 * seperti paragraf biasa (tidak tebal, tidak rata tengah), dan jarak antar
 * paragraf hilang karena Tailwind preflight menghapus margin bawaan <p>.
 */
export const CSS_PASAL = [
  '.pasal-blk>p{margin:0 0 3mm}',
  '.pasal-blk>p:last-child{margin-bottom:0}',
  '.pasal-blk .pasal-no{text-align:center;font-weight:700;letter-spacing:.06em;margin:0 0 1.5mm}',
  '.pasal-blk .pasal-judul{text-align:center;font-weight:700;margin:0 0 3.5mm}',
].join('');

/**
 * Kotak judul (kiri atas) setiap halaman — SATU sumber untuk pratinjau, jendela
 * cetak, dan pratinjau generator.
 *
 * `corner-shape-bg.png` = sudut oranye yang dipakai pratinjau. Gambar itu
 * SENDIRI sudah menggambar bentuk kop lengkap (sudut oranye dengan lengkungan
 * bawah-kanan). Tidak ada lapisan tambahan di atasnya — pratinjau `/preview`
 * dan panel pratinjau di `/edit` memang hanya memakai gambar ini.
 *
 * Dulu dokumen cetak menambahkan `.page::before` (kotak oranye 34×24mm) dan
 * `.page::after` (kotak bergaris putih) di atas gambar itu. Hasilnya kop PDF
 * punya kotak penutup yang tidak ada di pratinjau — Mas menyebutnya "hanya
 * corner-shape-bg.png tanpa kotak penutup" untuk tampilan yang BENAR. Karena
 * itu aturan di bawah bukan cuma memasang latar, tapi juga MEMATIKAN kedua
 * lapisan itu kalau masih tertinggal di dokumen mana pun.
 *
 * Alamatnya sengaja KOSONG (`url('')`), bukan `/corner-shape-bg.png`:
 * `gantiAsetLokal()` di `cetak.ts` hanya mengganti alamat yang masih relatif.
 * Dengan alamat kosong, aturan ini selalu ikut dijadikan blob saat dicetak —
 * jadi latar kop pasti ada di PDF, tidak bergantung pada apakah dokumen
 * aslinya masih memakai alamat relatif atau tidak.
 */
export const CSS_KOP =
  '.page,.page.spk-body,.page.cont{' +
  "background:#fff url('') no-repeat left top!important;" +
  'background-size:33.8mm auto!important}' +
  '.page::before,.page::after{content:none!important;display:none!important}';

// ── Membaca kembali dokumen menjadi per-pasal ────────────────────────────────
/** Isi satu pasal sebagaimana terbaca dari HTML dokumen. */
export interface IsiPasalDok { judul: string; badan: string }

/**
 * Posisi tepat SETELAH `</div>` yang menutup `<div>` pada indeks `mulai`.
 *
 * Wajib menghitung kedalaman: badan pasal bisa memuat `<div class="sign">`
 * yang bersarang (`sign > div > sigbox`). Pencocokan `[\s\S]*?<\/div>` berhenti
 * di `</div>` pertama dan MEMOTONG blok tanda tangan di tengah — akibatnya
 * pasal 10 tampil separuh di editor, dan begitu disimpan, separuh tanda tangan
 * (PIHAK KEDUA, cap, ttd) hilang dari dokumen.
 */
export function akhirDiv(html: string, mulai: number): number {
  const re = /<div\b[^>]*>|<\/div>/gi;
  re.lastIndex = mulai;
  let kedalaman = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    if (m[0].charAt(1) === '/') {
      kedalaman--;
      if (kedalaman === 0) return m.index + m[0].length;
    } else {
      kedalaman++;
    }
  }
  return html.length;
}

/**
 * Urai dokumen SPK menjadi `{ noPasal: { judul, badan } }`.
 *
 * Dipakai panel Editor SPK untuk menampilkan teks default. Sumbernya dokumen
 * yang SAMA dengan yang dicetak (`pageSPK`), jadi tidak ada salinan teks yang
 * bisa melenceng dari hasil cetak.
 */
export function uraiPasal(html: string): Record<number, IsiPasalDok> {
  const hasil: Record<number, IsiPasalDok> = {};
  if (!html) return hasil;
  const buka = '<div class="pasal-blk">';
  let cari = 0;
  for (;;) {
    const mulai = html.indexOf(buka, cari);
    if (mulai < 0) break;
    const akhir = akhirDiv(html, mulai);
    const blok = html.slice(mulai + buka.length, Math.max(mulai + buka.length, akhir - '</div>'.length));
    cari = akhir;

    const no = blok.match(/class="pasal-no"[^>]*>[\s\S]*?(\d+)/);
    if (!no) continue;
    const judul = (blok.match(/class="pasal-judul"[^>]*>([\s\S]*?)<\/p>/) || ['', ''])[1]
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
    const badan = blok
      .replace(/<p class="pasal-no"[\s\S]*?<\/p>/, '')
      .replace(/<p class="pasal-judul"[\s\S]*?<\/p>/, '')
      .trim();
    hasil[Number(no[1])] = { judul, badan };
  }
  return hasil;
}
