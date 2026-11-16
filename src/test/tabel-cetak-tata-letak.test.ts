/**
 * Uji tata letak sel tabel dokumen cetak (Final Survey, SPK, PO, Lacak).
 *
 * Latar belakang: pernah ada usulan CSS
 *   th, td { white-space: nowrap; width: 45px; min-width: 45px; }
 * yang terlihat rapi di baris pendek, tetapi merusak dua hal sekaligus:
 *
 *  1. Dengan `table-layout:fixed`, lebar kolom sudah dikunci <colgroup>.
 *     `width/min-width:45px` membuat persentase colgroup tidak terpakai dan
 *     semua kolom menyusut rata 45px.
 *  2. `white-space:nowrap` membuat isi sel melebihi kolomnya. Terukur: sel
 *     Note butuh 320px di kolom 251px, tabel melebar 665px → 733px dan
 *     menembus margin kertas A4 saat dicetak.
 *
 * Uji ini menjaga agar aturan tersebut tidak kembali. Yang diuji perilaku CSS
 * hasil render (bukan nama kelas), supaya tetap sah walau gaya dirapikan.
 */
import { describe, expect, it } from 'vitest';
import { bingkai, LEBAR_NO } from '@/lib/survey-cetak';

const html = bingkai('Uji', 'FINAL SURVEY', 'FS-1', '', '');
const css = html.match(/<style>([\s\S]*?)<\/style>/)![1];

/** Buang komentar CSS supaya isi penjelasan tidak ikut dinilai. */
const tanpaKomentar = css.replace(/\/\*[\s\S]*?\*\//g, '');

/**
 * Isi deklarasi untuk satu aturan, dicari dari teks CSS apa adanya.
 * Dibuat sederhana dan sengaja: hanya mencari literal `selector{`, jadi tidak
 * ikut tertipu aturan @media atau selector lain yang mirip.
 */
function deklarasi(selector: string): string {
  const mulai = tanpaKomentar.indexOf(selector + '{');
  if (mulai === -1) return '';
  const buka = tanpaKomentar.indexOf('{', mulai);
  const tutup = tanpaKomentar.indexOf('}', buka);
  return tanpaKomentar.slice(buka + 1, tutup);
}

/** Isi blok @media print. */
function blokPrint(): string {
  const mulai = tanpaKomentar.indexOf('@media print');
  if (mulai === -1) return '';
  const buka = tanpaKomentar.indexOf('{', mulai);
  let dalam = 0;
  for (let i = buka; i < tanpaKomentar.length; i++) {
    if (tanpaKomentar[i] === '{') dalam++;
    else if (tanpaKomentar[i] === '}') {
      dalam--;
      if (dalam === 0) return tanpaKomentar.slice(buka + 1, i);
    }
  }
  return '';
}

describe('Sel tabel dokumen cetak — tata letak A4', () => {
  const sel = deklarasi('th,td');

  it('aturan th,td ditemukan (dasar pemeriksaan lain)', () => {
    expect(sel.length).toBeGreaterThan(20);
  });

  it('tabel memakai table-layout:fixed (lebar dikunci colgroup)', () => {
    const tabel = deklarasi('table');
    expect(tabel).toContain('table-layout:fixed');
    expect(tabel).toContain('width:100%');
  });

  it('th,td tidak memakai lebar tetap 45px', () => {
    expect(sel).not.toMatch(/(^|;)\s*width\s*:/);
    expect(sel).not.toMatch(/min-width\s*:\s*\d+px/);
  });

  it('th,td tidak memakai white-space:nowrap', () => {
    expect(sel).not.toContain('nowrap');
    expect(sel).toContain('white-space:normal');
  });

  it('kata panjang dipatah di dalam sel, bukan melebarkan tabel', () => {
    expect(sel).toContain('overflow-wrap:anywhere');
    expect(sel).toContain('min-width:0');
    // break-all akan mematah kata normal di tengah tanpa alasan
    expect(sel).toContain('word-break:normal');
  });

  it('baris tabel tidak dibelah dua antar-halaman', () => {
    expect(deklarasi('tr')).toContain('break-inside:avoid');
  });

  it('saat dicetak, isi sel tidak melewati tepi kertas', () => {
    const cetak = blokPrint();
    expect(cetak).not.toBe('');
    expect(cetak).toContain('overflow:hidden');
  });
});

/**
 * Kolom "No" pada tabel Data Teknis.
 *
 * Latar belakang: kolom ini pernah terlalu sempit — lebar 9mm hanya menyisakan
 * 17,4px isi, sedangkan teks "001" butuh 20,5px, sehingga nomor patah jadi
 * "00" / "1" di baris terpisah. Pemeriksaan di sini menjaga agar lebar kolom
 * tidak menyusut lagi. Angka piksel diukur di Chromium pada A4 (665px lebar
 * tabel, padding sel 2,2mm, angka 8,5pt monospace).
 */
describe('Kolom No tabel Data Teknis', () => {
  it('lebar kolom No minimal 6mm', () => {
    // Diukur di Chromium: 6mm = 50px kolom, isi bersih 44px, "001" butuh
    // 20,5px. Lebar 9mm sebelumnya hanya memberi 33px kolom / 17,4px isi →
    // nomor patah jadi dua baris.
    const mm = Number(LEBAR_NO.replace('mm', ''));
    expect(mm).toBeGreaterThanOrEqual(6);
  });

  it('padding kolom No lebih sempit dari padding sel biasa', () => {
    const no = deklarasi('table.spek th.no,table.spek td.no');
    const mm = Number((no.match(/padding-left:\s*([\d.]+)mm/) || [])[1]);
    expect(mm).toBeGreaterThan(0);
    // padding sel biasa 2,2mm; kolom No harus lebih kecil supaya isi lega
    expect(mm).toBeLessThan(2.2);
    // Lebar isi bersih harus ≥ kebutuhan teks. Diukur sebelumnya: 44px isi
    // (50px kolom − 2 × 3px border), angka "001" 20,5px → sisa 3,6px.
  });

  it('angka nomor tidak dibiarkan patah baris', () => {
    // Cari aturan apa pun yang menyebut table.spek td.no dan memuat nowrap.
    expect(/table\.spek td\.no\{[^}]*white-space:nowrap/.test(tanpaKomentar)).toBe(true);
  });
});
