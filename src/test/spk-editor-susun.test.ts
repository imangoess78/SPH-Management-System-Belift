import { describe, it, expect } from 'vitest';
import {
  susunPasal, renderPasal, normalCetak, cssCetak, tglId, CETAK_AWAL,
  type Pasal, type ManualSpk,
} from '@/lib/spk-susun';
import { pageSPK, sisipCssCetak, cssCetakUntuk } from '@/lib/sph-generator';

/**
 * Editor SPK (opsi A) — yang diuji di sini adalah HAL YANG BISA MERUSAK DOKUMEN
 * HUKUM: teks hilang, isian manual menimpa data form, dan pengaturan cetak
 * yang tidak masuk. Bukan detail tampilan.
 */

const pasalContoh: Pasal[] = [
  { no: 1, judul: 'DEFINISI', blok: [{ t: 'p', html: '<p>Isi satu.</p>' }] },
  { no: 2, judul: 'LINGKUP', blok: [{ t: 'p', html: '<p>Isi dua.</p>' }] },
];

describe('susunPasal — isian manual TIDAK boleh menimpa data form', () => {
  it('tanpa isian manual, pasal kembali apa adanya', () => {
    expect(susunPasal(pasalContoh)).toEqual(pasalContoh);
  });

  it('judul manual menggantikan judul form, isi form tetap utuh', () => {
    const m: ManualSpk = { '1': { judul: 'DEFINISI BARU' } };
    const h = susunPasal(pasalContoh, m);
    expect(h[0].judul).toBe('DEFINISI BARU');
    // Isi dari form harus tetap ada — ini inti keamanan dokumen.
    expect(h[0].blok).toEqual(pasalContoh[0].blok);
    expect(h[1].judul).toBe('LINGKUP');
  });

  it('paragraf tambahan DITAMBAHKAN di akhir, bukan menggantikan isi', () => {
    const m: ManualSpk = { '2': { tambahan: ['<p>Catatan tambahan.</p>'] } };
    const h = susunPasal(pasalContoh, m);
    expect(h[1].blok).toHaveLength(2);
    expect(h[1].blok[0]).toEqual(pasalContoh[1].blok[0]); // isi form di depan
    expect(renderPasal(h[1])).toContain('Catatan tambahan.');
    expect(renderPasal(h[1])).toContain('Isi dua.');
  });

  it('paragraf tambahan kosong / spasi saja diabaikan', () => {
    const m: ManualSpk = { '1': { tambahan: ['', '   ', '\n'] } };
    const h = susunPasal(pasalContoh, m);
    expect(h[0].blok).toHaveLength(1);
  });

  it('pasal yang disembunyikan hilang dari hasil, nomor pasal lain TIDAK bergeser', () => {
    const h = susunPasal(pasalContoh, { '1': { sembunyi: true } });
    expect(h.map(p => p.no)).toEqual([2]); // bukan [1]
  });

  it('isian manual untuk pasal yang tidak ada tidak menambah pasal baru', () => {
    const h = susunPasal(pasalContoh, { '99': { judul: 'Hantu' } });
    expect(h).toHaveLength(2);
  });
});

describe('renderPasal — struktur & termin', () => {
  it('mencetak nomor pasal dan judul dengan kelas yang dijaga CSS', () => {
    const h = renderPasal(pasalContoh[0]);
    expect(h).toContain('class="pasal-no"');   // dipakai aturan anti-menggantung
    expect(h).toContain('class="pasal-judul"');
    expect(h).toContain('PASAL&nbsp;&nbsp;1');
  });

  it('9 termin tampil semua, berurutan, dengan total benar', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      urutan: 'Termin ' + (i + 1), persen: 10, nominal: 1000000, syarat: 'Tahap ' + (i + 1),
    }));
    const h = renderPasal({ no: 7, judul: 'CARA PEMBAYARAN', blok: [{ t: 'tabel_termin', items }] });
    for (let i = 1; i <= 9; i++) expect(h).toContain('Tahap ' + i);
    expect(h).toContain('<td style="text-align:center"><strong>90%</strong></td>');
    expect(h).toContain('<strong>Rp. 9.000.000</strong>');
  });

  it('kolom Tanggal hanya muncul bila ada termin bertanggal', () => {
    const tanpa = renderPasal({ no: 7, judul: 'X', blok: [{ t: 'tabel_termin', items: [
      { urutan: 'Pertama', persen: 50, nominal: 1, syarat: 'A' }] }] });
    expect(tanpa).not.toContain('<th style="width:26mm">Tanggal</th>');

    const dengan = renderPasal({ no: 7, judul: 'X', blok: [{ t: 'tabel_termin', items: [
      { urutan: 'Pertama', persen: 50, nominal: 1, syarat: 'A', tanggal: '2026-12-05' }] }] });
    expect(dengan).toContain('<th style="width:26mm">Tanggal</th>');
    expect(dengan).toContain('5 Desember 2026');
  });

  it('tabel termin punya thead (kepala tabel diulang tiap halaman cetak)', () => {
    const h = renderPasal({ no: 7, judul: 'X', blok: [{ t: 'tabel_termin', items: [
      { urutan: 'Pertama', persen: 100, nominal: 5, syarat: 'A' }] }] });
    expect(h).toContain('<thead>');
    expect(h).toContain('<tfoot>');
  });

  it('isi butir HTML dari form dipertahankan (dibuat internal, bukan input mentah)', () => {
    // Butir seperti "Free Maintenance <strong>12 bulan</strong>" memang HTML.
    // Data ini berasal dari generator sendiri, bukan ketikan pengguna mentah —
    // isian manual pengguna diperlakukan terpisah di ManualSpk (diuji di bawah).
    const h = renderPasal({ no: 1, judul: 'X', blok: [{ t: 'ul', items: ['Garansi <strong>12 bulan</strong>'] }] });
    expect(h).toContain('<strong>12 bulan</strong>');
  });
});

describe('tglId', () => {
  it('format Indonesia', () => {
    expect(tglId('2026-01-09')).toBe('9 Januari 2026');
    expect(tglId('2026-12-31')).toBe('31 Desember 2026');
  });
  it('bukan tanggal valid dikembalikan apa adanya', () => {
    expect(tglId('besok')).toBe('besok');
    expect(tglId('2026-13-01')).toBe('2026-13-01');
  });
});

describe('normalCetak — margin tidak boleh merusak halaman', () => {
  it('kosong → default A4 margin asli SPK', () => {
    expect(normalCetak()).toEqual(CETAK_AWAL);
    expect(normalCetak(null)).toEqual(CETAK_AWAL);
  });
  it('nilai di luar batas dijepit, bukan diterima mentah', () => {
    const c = normalCetak({ marginKiri: -50, marginKanan: 999 });
    expect(c.marginKiri).toBe(5);
    expect(c.marginKanan).toBe(60);
  });
  it('margin bukan angka → pakai default', () => {
    const c = normalCetak({ marginAtas: 'abc' as unknown as number });
    expect(c.marginAtas).toBe(CETAK_AWAL.marginAtas);
  });
  it('kertas tak dikenal → A4', () => {
    expect(normalCetak({ kertas: 'F4' as never }).kertas).toBe('A4');
  });
});

describe('cssCetak', () => {
  it('A5 menghasilkan @page size A5 dan lebar halaman A5', () => {
    const css = cssCetak(normalCetak({ kertas: 'A5' }));
    expect(css).toContain('@page{size:A5;');
    expect(css).toContain('.page{width:148mm;min-height:210mm');
  });
  it('margin pengguna masuk ke @page dan padding .page', () => {
    const css = cssCetak(normalCetak({ kertas: 'Legal', marginAtas: 25, marginBawah: 20, marginKiri: 30, marginKanan: 10 }));
    expect(css).toContain('size:Legal');
    expect(css).toContain('margin:25mm 10mm 20mm 30mm');
    expect(css).toContain('padding:25mm 10mm 20mm 30mm');
    expect(css).toContain('width:215.9mm'); // lebar Legal
  });
});

describe('sisipCssCetak', () => {
  it('disisipkan sebelum </style> agar menimpa @page bawaan', () => {
    const asli = '<html><head><style>@page{size:A4;margin:0}</style></head><body></body></html>';
    const hasil = sisipCssCetak(asli, normalCetak({ kertas: 'A5' }));
    expect(hasil.indexOf('size:A5')).toBeGreaterThan(hasil.indexOf('size:A4'));
    expect(hasil.indexOf('size:A5')).toBeLessThan(hasil.indexOf('</style>'));
  });
});

describe('pageSPK — pengaturan cetak benar-benar terpakai', () => {
  const s: Record<string, unknown> = {
    noUrut: '001', tanggal: '2026-11-20', kota: 'Jakarta', alamatKantor: 'Jl. A',
    formatNoSPK: 'standar', sapaan: 'Bapak', namaCustomer: 'A', namaPerusahaan: 'PT A',
    nikCustomer: '1', alamatCustomer: 'Jl. B', kotaProyek: 'Bekasi',
    jenisLift: 'Passenger Lift', tipeKabin: 'Premium', kapasitas: '800', penumpang: '10',
    kecepatan: '1', mpm: '60', sfd: '6/6/6', tipeMesin: 'Gearless', traksi: 'T', dayaMesin: '5',
    power: '3P', pintu: 'CO', bukaanPintu: '900', tinggiKabin: '2200', shaftSize: '1800',
    cabinSize: '1400', pitDepth: '1500', namaLantai: 'Lantai', baseFloor: '1',
    ppn: 'include', masaBerlaku: '2 Minggu', freeMtn: '12 bln', garSpare: '12 bln',
    garMesin: '24 bln', waktuPengadaan: '3 bulan', waktuInstalasi: '2 bulan',
    tampilTtd: true, tampilDesain: false, finishingStruktur: 'Duco',
    sales: 'R', jabatanTtd: 'SM', direktur: 'B', rekening: 'BCA 123',
  };
  const items = [
    { id: 'P1a', kel: 'PENGADAAN', nama: 'Unit', sat: 'Unit', on: true, inc: false, hp: 100000000, hi: 0, qty: 1 },
  ] as never[];
  const termin = { PENGADAAN: [{ p: 100, s: 'Lunas' }] } as never;
  const pilih = { cabin: '', floor: '', ceiling: '', door: '', cop: '', lop: '', struktur: '', addon: '' } as never;

  it('default A4 bila pengaturan tidak diisi', () => {
    pageSPK(s as never, items, termin, 'satuan', pilih);
    // Dokumen tanpa pengaturan → cssCetakUntuk kosong, @page bawaan (A4) dipakai.
    expect(cssCetakUntuk('001')).toBe('');
  });

  it('pilihan A5 + margin pengguna terbaca saat mencetak', () => {
    pageSPK({ ...s, noUrut: 'A5-1', cetak: { kertas: 'A5', marginAtas: 20, marginBawah: 15, marginKiri: 12, marginKanan: 12 } } as never,
      items, termin, 'satuan', pilih);
    expect(cssCetakUntuk('A5-1')).toContain('@page{size:A5;margin:20mm 12mm 15mm 12mm}');
    // Dokumen lain tidak boleh ikut terbawa
    expect(cssCetakUntuk('001')).toBe('');
  });

  it('isian manual muncul di dokumen, data form tetap ada', () => {
    const h = pageSPK({ ...s, manualSpk: { '3': { tambahan: ['<p>Klausul khusus proyek ini.</p>'] } } } as never,
      items, termin, 'satuan', pilih);
    expect(h).toContain('Klausul khusus proyek ini.');
    expect(h).toContain('LOKASI PEKERJAAN');
    expect(h).toContain('Jl. B');
  });

  it('tanggal termin per kategori tercetak', () => {
    const h = pageSPK({ ...s, tanggalTermin: { PENGADAAN: ['2026-12-05'] } } as never,
      items, termin, 'satuan', pilih);
    expect(h).toContain('5 Desember 2026');
  });
});
