/**
 * Uji penguraian dokumen SPK menjadi per-pasal.
 *
 * Bug yang dijaga di sini (dilaporkan Mas): di editor pasal 10 ada teks
 * "PIHAK PERTAMA", dan begitu teks itu dihapus, tanda tangan hilang.
 *
 * Penyebabnya BUKAN React: `teksAsliDariDokumen()` memakai
 * `/<div class="pasal-blk">([\s\S]*?)<\/div>/` yang berhenti di `</div>`
 * PERTAMA. Badan pasal 10 memuat `<div class="sign">` bersarang, jadi yang
 * terbaca hanya sampai `</div>` milik `.sigbox` — separuh tanda tangan
 * (PIHAK KEDUA, cap, ttd) tidak pernah sampai ke editor. Saat pasal disimpan,
 * yang tersimpan adalah versi terpotong itu.
 */
import { describe, it, expect } from 'vitest';
import { uraiPasal, akhirDiv, CSS_PASAL } from '@/lib/spk-susun';

const SIGN = '<div class="sign">' +
  '<div>PIHAK PERTAMA<div class="sigbox"></div>' +
  '<div class="sig-nm">Rudy</div><div>Pemilik Bangunan</div></div>' +
  '<div>PIHAK KEDUA<br><strong>PT BELIFT AMANAH INDONESIA</strong>' +
  '<div class="sigbox"><img class="cap" src="/cap.png" alt=""><img class="ttd" src="/ttd.png" alt=""></div>' +
  '<div class="sig-nm">Direktur</div></div>' +
  '</div>';

const DOK = '<div class="page spk-body">' +
  '<div class="pasal-blk"><p class="pasal-no">PASAL&nbsp;&nbsp;1</p>' +
  '<p class="pasal-judul">DEFINISI</p><p>Definisi istilah.</p></div>' +
  '<div class="pasal-blk"><p class="pasal-no">PASAL&nbsp;&nbsp;10</p>' +
  '<p class="pasal-judul">PENUTUP</p>' +
  '<p>Hal-hal yang belum tercantum akan dibicarakan kemudian.</p>' +
  '<p>Demikian, Surat Perjanjian Kerja ini ditanda tangani.</p>' +
  SIGN + '</div>' +
  '</div>';

describe('akhirDiv — pencocokan <div> berkedalaman', () => {
  it('melewati </div> bersarang dan berhenti di penutup terluar', () => {
    const mulai = DOK.indexOf('<div class="sign">');
    const akhir = akhirDiv(DOK, mulai);
    const blok = DOK.slice(mulai, akhir);
    expect(blok).toBe(SIGN);
    expect(blok).toContain('img class="ttd"'); // bagian paling akhir, dulu terpotong
  });
});

describe('uraiPasal', () => {
  const hasil = uraiPasal(DOK);

  it('membaca semua pasal', () => {
    expect(Object.keys(hasil).sort()).toEqual(['1', '10']);
  });

  it('membaca nomor & judul dengan benar', () => {
    expect(hasil[1].judul).toBe('DEFINISI');
    expect(hasil[10].judul).toBe('PENUTUP');
  });

  it('badan pasal 10 memuat SELURUH blok tanda tangan', () => {
    const b = hasil[10].badan;
    expect(b).toContain('<div class="sign">');
    expect(b).toContain('PIHAK PERTAMA');
    expect(b).toContain('PIHAK KEDUA');       // dulu hilang
    expect(b).toContain('img class="ttd"');   // dulu hilang
    expect(b).toContain('img class="cap"');   // dulu hilang
    expect(b).toContain('sig-nm');
    expect(b.trimEnd().endsWith('</div>')).toBe(true);
  });

  it('badan pasal 10 tidak menyertakan nomor & judul pasal', () => {
    const b = hasil[10].badan;
    expect(b).not.toContain('pasal-no');
    expect(b).not.toContain('pasal-judul');
    expect(b).not.toContain('PENUTUP');
  });

  it('badan pasal 10 diawali paragraf, bukan potongan div', () => {
    expect(hasil[10].badan.startsWith('<p>Hal-hal')).toBe(true);
  });

  it('dokumen kosong aman', () => {
    expect(uraiPasal('')).toEqual({});
    expect(uraiPasal('<div class="page"></div>')).toEqual({});
  });
});

describe('CSS_PASAL — judul pasal tebal & rata tengah, paragraf berjarak', () => {
  it('memuat aturan untuk pasal-no dan pasal-judul', () => {
    expect(CSS_PASAL).toContain('.pasal-blk .pasal-no');
    expect(CSS_PASAL).toContain('.pasal-blk .pasal-judul');
  });

  it('judul pasal tebal dan rata tengah', () => {
    const no = /\.pasal-blk \.pasal-no\{([^}]*)\}/.exec(CSS_PASAL)![1];
    const judul = /\.pasal-blk \.pasal-judul\{([^}]*)\}/.exec(CSS_PASAL)![1];
    for (const r of [no, judul]) {
      expect(r).toContain('font-weight:700');
      expect(r).toContain('text-align:center');
    }
  });

  it('paragraf isi pasal punya jarak bawah', () => {
    const p = /\.pasal-blk>p\{([^}]*)\}/.exec(CSS_PASAL)![1];
    expect(p).toContain('margin:0 0 3mm');
  });
});
