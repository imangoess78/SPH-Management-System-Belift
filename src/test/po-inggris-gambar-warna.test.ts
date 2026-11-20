import { describe, it, expect } from 'vitest';
import { htmlPo, warnaPunyaGambar } from '@/lib/survey-cetak';
import type { DataTeknis } from '@/lib/survey-types';

/**
 * PO Pabrik — permintaan klien 20 Nov 2026:
 *   1. Judul kop "Purchase Order", ukuran 24pt (bukan "PO" 52pt).
 *   2. Subjudul "Pesanan ke Pabrik — <nama>" DIHAPUS.
 *   3. Seluruh dokumen berbahasa Inggris.
 *   4. Baris warna menampilkan gambarnya (dari Master Data), beserta nama
 *      warna di keterangan gambar — bukan URL mentah di kolom Value.
 */

const dt = (tambahan: Record<string, unknown> = {}): DataTeknis => ({
  liftType: 'Home Lift',
  model: 'Premium',
  kapasitas: '400',
  warnaCabin: 'Rose Gold',
  'imgdesain:warnaCabin': 'https://cdn.example/rose-gold.png',
  ...tambahan,
} as unknown as DataTeknis);

const po = {
  no_po: '003/PO/LIFT/BAI/XI/2026',
  tgl_po: '2026-11-16',
  kode_proyek: 'BLF-2026-002',
  nama_prospek: 'Sinar Cerah Cerah Sempurna',
  pabrik: 'BLF-2026-002',
  pic: 'Pak Andi',
  rev_terakhir: 2,
  catatan: null,
} as unknown as Parameters<typeof htmlPo>[0];

const revisi = [{
  rev: 2,
  tgl_revisi: '2026-11-16',
  oleh: 'Admin',
  alasan: 'Perbaikan warna',
  jml_perubahan: 1,
  dt: dt(),
}] as unknown as Parameters<typeof htmlPo>[1];

describe('PO Pabrik — kop & bahasa', () => {
  const h = htmlPo(po, revisi);

  it('judul kop "Purchase Order" berukuran 24pt', () => {
    expect(h).toContain('<div class="doctype" style="font-size:24pt">Purchase Order</div>');
    // Gaya bawaan 52pt masih dipakai dokumen lain; PO harus menimpanya.
    expect(h).not.toContain('<div class="doctype">PO</div>');
  });

  it('subjudul "Pesanan ke Pabrik — ..." dihapus', () => {
    expect(h).not.toContain('Pesanan ke Pabrik');
    // Nama proyek TETAP ada, tapi di baris Data Pesanan.
    expect(h).toContain('Project / Customer Name');
    expect(h).toContain('Sinar Cerah Cerah Sempurna');
  });

  it('tidak ada label Indonesia yang tersisa', () => {
    const terlarang = [
      'Data Pesanan', 'Nomor PO', 'Tanggal PO', 'Kode Proyek', 'Pabrik Tujuan',
      'PIC Pabrik', 'Revisi Ke', 'Data Teknis Acuan', 'Tabel Lantai', 'Catatan Revisi',
      'Pengesahan', 'Dibuat —', 'Diperiksa —', 'Disetujui —', 'Dokumen ini dicetak',
      'Lantai', 'Tinggi (mm)', 'Bukaan Pintu', 'Dipesan', 'Sudah Ada', 'Kode', 'Foto',
    ];
    for (const t of terlarang) expect(h, `masih ada "${t}"`).not.toContain(t);
  });

  it('memakai label Inggris & tanggal Inggris', () => {
    expect(h).toContain('Order Details');
    expect(h).toContain('Factory Technical Reference');
    expect(h).toContain('Authorisation');
    expect(h).toContain('Prepared — Operations');
    expect(h).toContain('This document is printed from the Belift system');
    expect(h).toContain('<html lang="en">');
    expect(h).toContain('16 November 2026');
  });

  it('Catatan Revisi hanya muncul saat ada lebih dari satu revisi', () => {
    // Perilaku lama dipertahankan: PO baru (satu revisi) tidak perlu riwayat.
    const satu = htmlPo(po, [{ ...revisi[0], rev: 1 }] as unknown as Parameters<typeof htmlPo>[1]);
    expect(satu).not.toContain('Revision History');
    const dua = htmlPo(po, [
      { ...revisi[0], rev: 2 },
      { ...revisi[0], rev: 1, alasan: 'Revisi awal' },
    ] as unknown as Parameters<typeof htmlPo>[1]);
    expect(dua).toContain('Revision History');
    expect(dua).toContain('<td><strong>Reason / Changes</strong></td>');
    expect(dua).toContain('1 changes');
  });

  it('tidak mencetak lagi "Halaman 1" versi Indonesia', () => {
    expect(h).toContain('Page 1');
    expect(h).not.toContain('Halaman 1');
  });
});

describe('PO Pabrik — gambar warna', () => {
  it('gambar warna Master Data ikut tercetak dengan nama warnanya', () => {
    const h = htmlPo(po, revisi);
    expect(h).toContain('src="https://cdn.example/rose-gold.png"');
    expect(h).toContain('Cabin Colour — Rose Gold');
    // Baris Value ditandai agar pembaca tahu gambarnya ada.
    expect(h).toContain('Rose Gold <span class="lihatgbr">(see image)</span>');
  });

  it('nilai field warna berupa URL tidak dicetak sebagai teks sampah', () => {
    const h = htmlPo(po, [{
      ...revisi[0],
      dt: dt({ warnaCabin: 'https://cdn.example/x.png', 'imgdesain:warnaCabin': 'https://cdn.example/x.png' }),
    }] as unknown as Parameters<typeof htmlPo>[1]);
    // URL hanya boleh muncul di atribut src, tidak di kolom Value.
    expect(h).not.toContain('>https://cdn.example/x.png<');
    expect(h).toContain('src="https://cdn.example/x.png"');
  });

  it('warna tanpa gambar tetap tercetak namanya saja', () => {
    const h = htmlPo(po, [{
      ...revisi[0],
      dt: dt({ warnaCabin: 'Merah', 'imgdesain:warnaCabin': '' }),
    }] as unknown as Parameters<typeof htmlPo>[1]);
    expect(h).toContain('Merah');
    // Kelas .lihatgbr selalu ada di <style>; yang harus tidak ada adalah
    // penandanya di dalam baris tabel.
    expect(h).not.toContain('<span class="lihatgbr">');
    expect(h).not.toContain('(see image)');
  });

  it('warnaPunyaGambar() membaca kunci gambar field terkait', () => {
    expect(warnaPunyaGambar(dt(), 'warnaCabin')).toBe(true);
    expect(warnaPunyaGambar(dt({ 'imgdesain:warnaCabin': '' }), 'warnaCabin')).toBe(false);
  });

  it('dokumen lama tanpa kunci per-field tetap menemukan gambarnya', () => {
    // Sebelum ada field warna terpisah, hanya ada satu kunci imgdesain milik
    // warna struktur. Gambar itu harus tetap tercetak. Catatan: kunci yang
    // bernilai undefined harus dihapus dari objek — JSON dari database tidak
    // pernah menyimpan undefined, tapi objek uji bisa.
    const lama = dt();
    delete (lama as unknown as Record<string, unknown>)['imgdesain:warnaCabin'];
    (lama as unknown as Record<string, unknown>)['imgdesain:warnaStruktur'] = 'https://cdn.example/steel.png';
    expect(Object.keys(lama).filter(k => k.startsWith('imgdesain:'))).toEqual(['imgdesain:warnaStruktur']);
    expect(warnaPunyaGambar(lama, 'warnaCabin')).toBe(true);
  });

  it('beberapa warna sekaligus masing-masing dapat gambar sendiri', () => {
    const h = htmlPo(po, [{
      ...revisi[0],
      dt: dt({
        warnaCabin: 'Rose Gold', 'imgdesain:warnaCabin': 'https://cdn.example/rg.png',
        warnaStruktur: 'Steel', 'imgdesain:warnaStruktur': 'https://cdn.example/st.png',
      }),
    }] as unknown as Parameters<typeof htmlPo>[1]);
    expect(h).toContain('https://cdn.example/rg.png');
    expect(h).toContain('https://cdn.example/st.png');
    expect(h).toContain('Cabin Colour — Rose Gold');
    expect(h).toContain('Structure Colour — Steel');
  });
});
