/**
 * Fitur baru (6 Nov 2026) — permintaan klien untuk SPH & SPK:
 *   1. Catatan manual pada bagian "Unit lift & spesifikasi".
 *   2. Floor to Floor yang bisa diisi manual pada bagian yang sama.
 *
 * Dua-duanya opsional: dokumen lama (tanpa isian) harus tetap tercetak sama
 * seperti sebelumnya, yaitu "Floor to Floor: After Survey" dan tanpa kotak
 * catatan. Uji ini menjaga dua hal itu sekaligus — termasuk bahwa catatan
 * ditulis apa adanya (di-escape) dan baris barunya dipertahankan.
 */
import { describe, expect, it } from 'vitest';
import { pageSPH, pageSPK } from '@/lib/sph-generator';
import { makeDefaultItems, TERMIN_AWAL, normalLantaiUnit, totalFloorToFloor, type DesainPilihan } from '@/lib/sph-types';

const desain: DesainPilihan = {
  cabin: '', floor: '', ceiling: '', door: '', cop: '', lop: '', struktur: '', addon: '',
};

const dasar = {
  noUrut: '001', tanggal: '2026-11-06', kota: 'Depok', alamatKantor: 'Jl. Contoh 1, Depok',
  formatNoSPK: 'standar' as const,
  sapaan: 'Bapak', namaCustomer: 'Budi', namaPerusahaan: 'PT Budi Jaya', nikCustomer: '',
  alamatCustomer: 'Jl. Mawar 2', kotaProyek: 'Bandung',
  jenisLift: 'Home Lift', tipeKabin: 'Full Panoramic', kapasitas: '400 Kg', penumpang: '3-4 orang',
  kecepatan: '0,4 m/s', mpm: '24 mpm', sfd: '4/4/4', tipeMesin: 'MRL Lift', traksi: '2:1',
  dayaMesin: '1,2 kw', power: '380V 50HZ (3 phase)', pintu: 'Center Opening', bukaanPintu: '750 mm',
  tinggiKabin: '2200 mm', shaftSize: '2000 * 2000', cabinSize: '1200*1300 (Custom)',
  pitDepth: '(Custom)', namaLantai: '1.2.3.4', baseFloor: '1',
  ppn: 'exclude' as const, masaBerlaku: '3 Minggu', freeMtn: '1 Tahun', garSpare: '1 Tahun',
  garMesin: '1 Tahun', waktuPengadaan: '2 Bulan', waktuInstalasi: '1,5 Bulan',
  tampilTtd: false, tampilDesain: false, finishingStruktur: '', catatanDesain: {},
  sales: 'Imam Solikhin', jabatanTtd: 'Sales', direktur: 'Adhie Kurnia', rekening: 'BCA 123',
};

const buat = (tambahan: Record<string, unknown> = {}, mode: 'SPH' | 'SPK' = 'SPH') => {
  const state = { ...dasar, ...tambahan } as Parameters<typeof pageSPH>[0];
  const items = makeDefaultItems();
  const termin = JSON.parse(JSON.stringify(TERMIN_AWAL));
  return mode === 'SPH'
    ? pageSPH(state, items, termin, 'satuan', desain, {})
    : pageSPK(state, items, termin, 'satuan', desain, {});
};

/** Ambil isi satu baris tabel spesifikasi berdasarkan labelnya. */
function nilaiBaris(html: string, label: string): string | null {
  const re = new RegExp('<td>' + label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '</td><td[^>]*>([^<]*)</td>');
  const m = html.match(re);
  return m ? m[1] : null;
}

const lantai6 = [
  { no: 1, lantai: '1', tinggi: '4300' },
  { no: 2, lantai: '2', tinggi: '3300' },
  { no: 3, lantai: '3', tinggi: '3100' },
  { no: 4, lantai: '4', tinggi: '3000' },
  { no: 5, lantai: '5', tinggi: '3000' },
  { no: 6, lantai: '6', tinggi: '3000' },
];

describe('tabel lantai — bentuk data', () => {
  it('dokumen lama tanpa kolom lantai → 6 baris kosong bernomor', () => {
    const l = normalLantaiUnit(undefined);
    expect(l).toHaveLength(6);
    expect(l.map(x => x.no)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(l.every(x => x.tinggi === '')).toBe(true);
  });

  it('bentuk rusak (bukan array) tidak membuat form kosong', () => {
    expect(normalLantaiUnit('abc')).toHaveLength(6);
    expect(normalLantaiUnit(null)).toHaveLength(6);
    expect(normalLantaiUnit([])).toHaveLength(6);
  });

  it('nomor urut dirapikan dan nilai non-teks dijadikan teks', () => {
    const l = normalLantaiUnit([{ lantai: 'Basement', tinggi: 3000 }, { no: 9, lantai: 'Lantai 1', tinggi: null }]);
    expect(l[0]).toEqual({ no: 1, lantai: 'Basement', tinggi: '3000' });
    expect(l[1]).toEqual({ no: 2, lantai: 'Lantai 1', tinggi: '' });
  });

  it('total mengabaikan baris kosong dan menerima satuan', () => {
    expect(totalFloorToFloor([{ no: 1, lantai: '1', tinggi: '4.300 mm' },
      { no: 2, lantai: '2', tinggi: '' },
      { no: 3, lantai: '3', tinggi: '3,3' }])).toBe(4303);
  });
});

describe.each(['SPH', 'SPK'] as const)('%s — Floor to Floor (Tabel Lantai manual)', (mode) => {
  it('total = jumlah tinggi seluruh lantai yang diisi', () => {
    // 4300+3300+3100+3000+3000+3000 = 19.700
    expect(nilaiBaris(buat({ lantai: lantai6 }, mode), 'Floor to Floor'))
      .toBe('19.700 mm (6 lantai)');
  });

  it('mencetak "After Survey" bila belum ada tinggi terisi (perilaku lama)', () => {
    const kosong = lantai6.map(l => ({ ...l, tinggi: '' }));
    expect(nilaiBaris(buat({ lantai: kosong }, mode), 'Floor to Floor')).toBe('After Survey');
    expect(nilaiBaris(buat({}, mode), 'Floor to Floor')).toBe('After Survey');
  });

  it('baris yang belum diisi tidak ikut dijumlahkan', () => {
    const sebagian = lantai6.map((l, i) => ({ ...l, tinggi: i < 3 ? l.tinggi : '' }));
    expect(nilaiBaris(buat({ lantai: sebagian }, mode), 'Floor to Floor')).toBe('10.700 mm (3 lantai)');
  });

  it('menerima satuan yang diketik bebas ("3.300 mm")', () => {
    const bebas = lantai6.map(l => ({ ...l, tinggi: l.tinggi + ' mm' }));
    expect(nilaiBaris(buat({ lantai: bebas }, mode), 'Floor to Floor')).toBe('19.700 mm (6 lantai)');
  });

  it('Tabel Lantai tercetak lengkap dengan total', () => {
    const h = buat({ lantai: lantai6 }, mode);
    expect(h).toContain('Tabel Lantai (Floor to Floor)');
    expect(h).toContain('Tinggi (mm)');
    expect(h).toContain('Total Floor to Floor');
    // Kolom "No" sudah dihapus — 6 baris lantai, tiap baris 2 sel.
    expect((h.match(/<tr><td>\d<\/td><td>(4300|3300|3100|3000)<\/td><\/tr>/g) || []).length).toBe(6);
    expect(h).not.toContain('<strong>No</strong>');
  });

  it('tabel lantai tidak tercetak bila semua baris kosong', () => {
    const kosong = lantai6.map(l => ({ ...l, tinggi: '' }));
    expect(buat({ lantai: kosong }, mode)).not.toContain('Tabel Lantai (Floor to Floor)');
  });

  it('baris "Floor height" lama tidak lagi muncul', () => {
    const h = buat({ lantai: lantai6 }, mode);
    expect(h).not.toContain('<td>Floor height</td>');
    expect((h.match(/Floor to Floor/g) || []).length).toBeGreaterThan(1);
  });

  it('dokumen lama dengan satu angka floorToFloor tetap terbaca', () => {
    expect(nilaiBaris(buat({ floorToFloor: '3200 mm' }, mode), 'Floor to Floor')).toBe('3200 mm');
  });
});

describe.each(['SPH', 'SPK'] as const)('%s — catatan unit manual', (mode) => {
  it('tidak mencetak kotak catatan bila kosong', () => {
    expect(buat({}, mode)).not.toContain('cat-unit');
    expect(buat({ catatanUnit: '   \n  ' }, mode)).not.toContain('cat-unit');
  });

  it('mencetak catatan beserta labelnya bila diisi', () => {
    const h = buat({ catatanUnit: 'Mesin di sisi kanan shaft.' }, mode);
    expect(h).toContain('cat-unit');
    expect(h).toContain('Catatan Unit &amp; Spesifikasi:');
    expect(h).toContain('Mesin di sisi kanan shaft.');
  });

  it('baris baru dipertahankan sebagai <br>, baris kosong dibuang', () => {
    const h = buat({ catatanUnit: 'Poin satu\n\n  Poin dua  \n' }, mode);
    expect(h).toContain('Poin satu<br>Poin dua');
  });

  it('isi catatan di-escape (tidak bisa menyuntik HTML)', () => {
    const h = buat({ catatanUnit: '<script>alert(1)</script>' }, mode);
    expect(h).not.toContain('<script>alert(1)</script>');
    expect(h).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('catatan muncul SETELAH tabel spesifikasi, bukan di halaman lain', () => {
    const h = buat({ catatanUnit: 'Catatan uji.' }, mode);
    const tabel = h.indexOf('With Traction Description');
    const catatan = h.indexOf('cat-unit');
    expect(tabel).toBeGreaterThan(-1);
    expect(catatan).toBeGreaterThan(tabel);
  });
});
