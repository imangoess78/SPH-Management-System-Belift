/**
 * Uji editor pasal WYSIWYG.
 *
 * Yang dijaga di sini bukan "komponen tidak crash", tapi dua janji yang
 * sebelumnya dilanggar:
 *   1. Isi pasal TIDAK ditampilkan sebagai HTML mentah (`<p><strong>…`) —
 *      harus dirender jadi teks berformat.
 *   2. Tabel termin pada pasal 7 TIDAK hilang saat pasal disunting.
 */
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import PasalEditor, { pisahSegmen } from '@/components/PasalEditor';

const BADAN = '<p>Nilai pekerjaan adalah <strong>Rp. 250.000.000</strong> ,-</p>' +
  '<ul class="ul"><li>Termin I</li><li>Termin II</li></ul>';

const TABEL = '<table class="doc termin-tbl"><thead><tr><th>No</th><th>Termin</th></tr></thead>' +
  '<tbody><tr><td>1</td><td>DP</td></tr></tbody></table>';

describe('pisahSegmen — badan pasal dipecah di sekitar tabel', () => {
  it('tanpa tabel: satu segmen teks utuh', () => {
    const s = pisahSegmen(BADAN);
    expect(s).toHaveLength(1);
    expect(s[0].jenis).toBe('teks');
    expect(s[0].html).toBe(BADAN);
  });

  it('dengan tabel: teks–tabel–teks, dan digabung lagi persis sama', () => {
    const html = '<p>Pembayaran akan dilakukan dengan cara :</p>' + TABEL + '<p>Rekening: BCA</p>';
    const s = pisahSegmen(html);
    expect(s.map(x => x.jenis)).toEqual(['teks', 'tabel', 'teks']);
    expect(s[1].html).toBe(TABEL);
    // Round-trip: menyusun ulang segmen harus menghasilkan string yang identik.
    expect(s.map(x => x.html).join('')).toBe(html);
  });

  it('tabel di awal / akhir tetap terdeteksi', () => {
    expect(pisahSegmen(TABEL + '<p>x</p>').map(x => x.jenis)).toEqual(['tabel', 'teks']);
    expect(pisahSegmen('<p>x</p>' + TABEL).map(x => x.jenis)).toEqual(['teks', 'tabel']);
  });
});

describe('PasalEditor — tampilan', () => {
  it('merender teks berformat, bukan tag HTML mentah', () => {
    const { container } = render(<PasalEditor html={BADAN} onSimpan={() => {}} />);
    const teks = container.textContent || '';

    expect(teks).not.toContain('<strong>');
    expect(teks).not.toContain('<p>');
    expect(teks).toContain('Rp. 250.000.000');

    // Tebal benar-benar jadi elemen <strong> di dalam editor.
    const isi = container.querySelector('.ProseMirror');
    expect(isi).not.toBeNull();
    expect(isi!.querySelector('strong')?.textContent).toBe('Rp. 250.000.000');
    // Daftar jadi <ul>, bukan teks "• Termin I" atau tag mentah.
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
    // Tanpa ini, tombol hanya menyimpan "mark" pada kursor kosong dan teksnya
    // tidak berubah, sehingga terlihat seolah tombolnya mati.
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

    expect(pm.querySelectorAll('strong').length).toBeGreaterThan(1); // 1 sudah ada di data awal
    expect(simpan.length).toBeGreaterThan(0);
    expect(simpan[simpan.length - 1]).toContain('<strong>');
    expect(tebal.getAttribute('aria-pressed')).toBe('true');
  });

  it('tabel ditampilkan sebagai blok terkunci, bukan disunting', () => {
    const html = '<p>Pembayaran:</p>' + TABEL;
    const { container } = render(<PasalEditor html={html} onSimpan={() => {}} />);

    const blok = container.querySelector('.edspk-tabel');
    expect(blok).not.toBeNull();
    expect(blok!.querySelectorAll('th')).toHaveLength(2);
    // Tabel TIDAK berada di dalam area sunting ProseMirror.
    expect(blok!.querySelector('.ProseMirror')).toBeNull();
    // Ada keterangan bahwa tabel berasal dari form.
    expect(container.textContent).toContain('tidak disunting di sini');
  });
});
