/**
 * Uji editor pasal WYSIWYG.
 *
 * Yang dijaga di sini bukan "komponen tidak crash", tapi janji-janji yang
 * sebelumnya dilanggar:
 *   1. Isi pasal TIDAK ditampilkan sebagai HTML mentah (`<p><strong>…`).
 *   2. Tabel termin pada pasal 7 TIDAK hilang saat pasal disunting.
 *   3. Blok tanda tangan pada pasal 10 TIDAK hilang saat teks pasal disunting
 *      — ini bug yang dilaporkan: menghapus teks "PIHAK PERTAMA" membuat
 *      tanda tangan & cap lenyap.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PasalEditor, { pisahSegmen } from '@/components/PasalEditor';

const BADAN = '<p>Nilai pekerjaan adalah <strong>Rp. 250.000.000</strong> ,-</p>' +
  '<ul class="ul"><li>Termin I</li><li>Termin II</li></ul>';

const TABEL = '<table class="doc termin-tbl"><thead><tr><th>No</th><th>Termin</th></tr></thead>' +
  '<tbody><tr><td>1</td><td>DP</td></tr></tbody></table>';

/** Persis bentuk yang dihasilkan `bahanPasal()` untuk pasal 10 (PENUTUP). */
const TANDA = '<div class="sign">' +
  '<div>PIHAK PERTAMA<div class="sigbox"></div>' +
  '<div class="sig-nm">Rudy</div>' +
  '<div>Pemilik Bangunan</div></div>' +
  '<div>PIHAK KEDUA<br><strong>PT BELIFT AMANAH INDONESIA</strong>' +
  '<div class="sigbox"><img class="cap" src="/cap.png" alt=""><img class="ttd" src="/ttd.png" alt=""></div>' +
  '<div class="sig-nm">Direktur</div></div>' +
  '</div>';

const PASAL10 = '<p>Hal-hal yang belum tercantum akan dibicarakan kemudian.</p>' +
  '<p>Demikian, Surat Perjanjian Kerja ini ditanda tangani oleh kedua belah pihak.</p>' +
  TANDA;

describe('pisahSegmen — badan pasal dipecah di sekitar blok terkunci', () => {
  it('tanpa blok terkunci: satu segmen teks utuh', () => {
    const s = pisahSegmen(BADAN);
    expect(s).toHaveLength(1);
    expect(s[0].jenis).toBe('teks');
    expect(s[0].html).toBe(BADAN);
  });

  it('dengan tabel: teks–tabel–teks, digabung lagi persis sama', () => {
    const html = '<p>Pembayaran akan dilakukan dengan cara :</p>' + TABEL + '<p>Rekening: BCA</p>';
    const s = pisahSegmen(html);
    expect(s.map(x => x.jenis)).toEqual(['teks', 'tabel', 'teks']);
    expect(s[1].html).toBe(TABEL);
    expect(s.map(x => x.html).join('')).toBe(html);
  });

  it('tabel di awal / akhir tetap terdeteksi', () => {
    expect(pisahSegmen(TABEL + '<p>x</p>').map(x => x.jenis)).toEqual(['tabel', 'teks']);
    expect(pisahSegmen('<p>x</p>' + TABEL).map(x => x.jenis)).toEqual(['teks', 'tabel']);
  });

  it('blok tanda tangan diambil UTUH, tidak terpotong di </div> pertama', () => {
    const s = pisahSegmen(PASAL10);
    expect(s.map(x => x.jenis)).toEqual(['teks', 'tanda']);
    // Inilah inti bug: pemotongan naif akan berhenti di `</div>` milik sigbox
    // dan menyisakan separuh tanda tangan sebagai "teks" yang lalu dilucuti.
    expect(s[1].html).toBe(TANDA);
    expect(s[1].html).toContain('PIHAK KEDUA');
    expect(s[1].html).toContain('sigbox');
    expect(s[1].html).toContain('img class="ttd"');
    // Round-trip harus identik.
    expect(s.map(x => x.html).join('')).toBe(PASAL10);
  });

  it('tabel DAN tanda tangan dalam satu pasal sama-sama aman', () => {
    const html = '<p>a</p>' + TABEL + '<p>b</p>' + TANDA;
    const s = pisahSegmen(html);
    expect(s.map(x => x.jenis)).toEqual(['teks', 'tabel', 'teks', 'tanda']);
    expect(s.map(x => x.html).join('')).toBe(html);
  });
});

describe('PasalEditor — tampilan', () => {
  it('merender teks berformat, bukan tag HTML mentah', () => {
    const { container } = render(<PasalEditor html={BADAN} onSimpan={() => {}} />);
    const teks = container.textContent || '';

    expect(teks).not.toContain('<strong>');
    expect(teks).not.toContain('<p>');
    expect(teks).toContain('Rp. 250.000.000');

    const isi = container.querySelector('.ProseMirror');
    expect(isi).not.toBeNull();
    expect(isi!.querySelector('strong')?.textContent).toBe('Rp. 250.000.000');
    expect(isi!.querySelectorAll('li')).toHaveLength(2);
  });

  it('menyediakan bilah alat format', () => {
    const { container } = render(<PasalEditor html={BADAN} onSimpan={() => {}} />);
    const tb = container.querySelector('[role="toolbar"]');
    expect(tb).not.toBeNull();
    const label = [...tb!.querySelectorAll('button')].map(b => b.getAttribute('aria-label'));
    expect(label).toEqual(expect.arrayContaining(['Tebal', 'Miring', 'Garis bawah', 'Daftar butir', 'Daftar bernomor']));
  });

  it('tombol Tebal benar-benar menebalkan teks yang dipilih', async () => {
    // Jebakan yang pernah membuat saya salah lapor di browser: mengubah seleksi
    // DOM saja TIDAK cukup — ProseMirror baru tahu setelah event `selectionchange`.
    const simpan: string[] = [];
    const { container } = render(<PasalEditor html={BADAN} onSimpan={h => simpan.push(h)} />);
    const pm = container.querySelector('.ProseMirror') as HTMLElement;
    pm.focus();
    const sel = window.getSelection()!;
    const r = document.createRange();
    r.selectNodeContents(pm);
    sel.removeAllRanges();
    sel.addRange(r);
    document.dispatchEvent(new Event('selectionchange'));
    await new Promise(res => setTimeout(res, 60));

    const tebal = [...container.querySelectorAll('[role="toolbar"] button')]
      .find(b => b.getAttribute('aria-label') === 'Tebal')!;
    fireEvent.click(tebal);
    await new Promise(res => setTimeout(res, 60));

    expect(pm.querySelectorAll('strong').length).toBeGreaterThan(1);
    expect(simpan.length).toBeGreaterThan(0);
    expect(simpan[simpan.length - 1]).toContain('<strong>');
    expect(tebal.getAttribute('aria-pressed')).toBe('true');
  });

  it('tabel ditampilkan sebagai blok terkunci, bukan disunting', () => {
    const html = '<p>Pembayaran:</p>' + TABEL;
    const { container } = render(<PasalEditor html={html} onSimpan={() => {}} />);

    const blok = container.querySelector('.edspk-blok-tabel');
    expect(blok).not.toBeNull();
    expect(blok!.querySelectorAll('th')).toHaveLength(2);
    expect(blok!.querySelector('.ProseMirror')).toBeNull();
    expect(container.textContent).toContain('tidak disunting di sini');
  });

  it('blok tanda tangan tampil utuh di luar area sunting', () => {
    const { container } = render(<PasalEditor html={PASAL10} onSimpan={() => {}} />);

    const blok = container.querySelector('.edspk-blok-tanda');
    expect(blok).not.toBeNull();
    // Gambar tanda tangan & cap harus ada di DOM.
    expect(blok!.querySelectorAll('img.ttd')).toHaveLength(1);
    expect(blok!.querySelectorAll('img.cap')).toHaveLength(1);
    expect(blok!.querySelectorAll('.sigbox')).toHaveLength(2);
    expect(blok!.textContent).toContain('PIHAK PERTAMA');
    expect(blok!.textContent).toContain('PIHAK KEDUA');
    // Dan TIDAK berada di dalam ProseMirror (kalau masuk, class-nya dilucuti).
    expect(blok!.querySelector('.ProseMirror')).toBeNull();
    expect(container.querySelector('.ProseMirror')!.textContent).not.toContain('PIHAK PERTAMA');
  });

  it('menghapus seluruh teks pasal 10 TIDAK menghilangkan tanda tangan', async () => {
    // Skenario persis yang dilaporkan Mas: teks pasal dihapus → tanda tangan hilang.
    let terakhir = '';
    const { container } = render(<PasalEditor html={PASAL10} onSimpan={h => { terakhir = h; }} />);
    const pm = container.querySelector('.ProseMirror') as HTMLElement;

    // Kosongkan seluruh isi area sunting (setara Ctrl+A lalu Delete).
    pm.focus();
    const sel = window.getSelection()!;
    const r = document.createRange();
    r.selectNodeContents(pm);
    sel.removeAllRanges();
    sel.addRange(r);
    document.dispatchEvent(new Event('selectionchange'));
    await new Promise(res => setTimeout(res, 60));
    fireEvent.keyDown(pm, { key: 'Delete' });
    await new Promise(res => setTimeout(res, 60));

    // Apa pun yang terjadi pada teks, blok tanda tangan wajib utuh di hasil simpan.
    expect(terakhir).toContain('<div class="sign">');
    expect(terakhir).toContain('img class="ttd"');
    expect(terakhir).toContain('img class="cap"');
    expect(terakhir).toContain('sig-nm');
    // Dan urutannya tetap: tanda tangan di akhir, bukan berpindah ke awal.
    expect(terakhir.trimEnd().endsWith('</div>')).toBe(true);
    expect(terakhir.indexOf('<div class="sign">')).toBeGreaterThan(terakhir.indexOf('</p>'));
  });
});
