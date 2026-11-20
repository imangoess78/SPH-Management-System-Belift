import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pageSPK } from '@/lib/sph-generator';

/**
 * Dua keluhan nyata dari pemakaian SPK:
 *  1. Di pratinjau PDF, kolom "Termin" kepanjangan (isinya cuma kata urutan
 *     "Pertama … Kesembilan") sehingga kolom "Syarat" — yang isinya kalimat
 *     panjang — terhimpit.
 *  2. Kolom Tanggal di form termin pembayaran diisi tapi tidak ada efek apa pun
 *     di dokumen.
 *
 * Cakupan sengaja SPK saja. SPH (penawaran) TIDAK diubah.
 */

const s = {
  noUrut: '001', tanggal: '2026-11-20', kota: 'Jakarta', alamatKantor: 'Jl. A',
  formatNoSPK: 'standar', sapaan: 'Bapak', namaCustomer: 'A', namaPerusahaan: 'PT A',
  nikCustomer: '1', alamatCustomer: 'Jl. B', kotaProyek: 'Bekasi',
  jenisLift: 'Passenger Lift', tipeKabin: 'Premium', kapasitas: '800', penumpang: '10',
  kecepatan: '1', mpm: '60', sfd: '6/6/6', tipeMesin: 'Gearless', traksi: 'T',
  dayaMesin: '5', power: '3P', pintu: 'CO', bukaanPintu: '900', tinggiKabin: '2200',
  shaftSize: '1800', cabinSize: '1400', pitDepth: '1500', namaLantai: 'Lantai',
  baseFloor: '1', ppn: 'include', masaBerlaku: '2 Minggu', freeMtn: '12 bln',
  garSpare: '12 bln', garMesin: '24 bln', waktuPengadaan: '3 bulan',
  waktuInstalasi: '2 bulan', tampilTtd: false, tampilDesain: false,
  finishingStruktur: 'Duco', sales: 'R', jabatanTtd: 'SM', direktur: 'B',
  rekening: 'BCA 123', manualSpk: {}, catatanDesain: {},
};

const items = [
  { id: 'P1a', kel: 'PENGADAAN', nama: 'Unit', sat: 'Unit', on: true, inc: false, hp: 100000000, hi: 0, qty: 1 },
] as never[];

const termin = {
  PENGADAAN: [
    { p: 20, s: 'Setelah penandatanganan kontrak dan pembayaran uang muka' },
    { p: 80, s: 'Setelah serah terima pertama' },
  ],
} as never;

const pilih = { cabin: '', floor: '', ceiling: '', door: '', cop: '', lop: '', struktur: '', addon: '' } as never;

describe('Tabel termin SPK — lebar kolom', () => {
  const h = pageSPK(s as never, items, termin, 'satuan', pilih);

  it('kolom Termin dipatok sempit (22mm), bukan dibiarkan melar', () => {
    expect(h).toContain('<th style="width:22mm">Termin</th>');
    // Regresi lama: Termin tanpa lebar → mengambil porsi terbesar tabel.
    expect(h).not.toContain('<th>Termin</th>');
  });

  it('kolom Syarat tanpa lebar tetap → mengambil seluruh sisa ruang', () => {
    expect(h).toContain('<th>Syarat</th>');
    expect(h).not.toContain('width:26mm">Syarat</th>');
  });

  it('kolom pendukung tetap ada dan tidak melebar', () => {
    expect(h).toContain('width:8mm">No</th>');
    expect(h).toContain('width:16mm">%</th>');
    expect(h).toContain('width:34mm">Nominal</th>');
  });
});

describe('Tanggal termin SPK benar-benar tercetak', () => {
  it('kolom Tanggal muncul dan berisi tanggal yang diisi', () => {
    const h = pageSPK({ ...s, tanggalTermin: { PENGADAAN: ['2026-12-05', '2027-01-10'] } } as never,
      items, termin, 'satuan', pilih);
    expect(h).toContain('>Tanggal</th>');
    expect(h).toContain('5 Desember 2026');
    expect(h).toContain('10 Januari 2027');
  });

  it('tanggal menempel pada termin yang benar (indeks sejajar)', () => {
    const h = pageSPK({ ...s, tanggalTermin: { PENGADAAN: ['2026-12-05', '2027-01-10'] } } as never,
      items, termin, 'satuan', pilih);
    const baris = [...h.matchAll(/<tr><td style="text-align:center">(\d)<\/td>([\s\S]*?)<\/tr>/g)]
      .map(m => m[2]);
    expect(baris[0]).toContain('5 Desember 2026');
    expect(baris[1]).toContain('10 Januari 2027');
    expect(baris[0]).not.toContain('10 Januari 2027');
  });

  it('tanpa tanggal, kolom Tanggal tidak dicetak (SPK lama tak berubah)', () => {
    const h = pageSPK(s as never, items, termin, 'satuan', pilih);
    expect(h).not.toContain('>Tanggal</th>');
  });

  it('tanggal kosong di tengah tetap tampil sebagai strip, bukan menggeser baris', () => {
    const h = pageSPK({ ...s, tanggalTermin: { PENGADAAN: ['', '2027-01-10'] } } as never,
      items, termin, 'satuan', pilih);
    expect(h).toContain('>Tanggal</th>');
    expect(h).toContain('10 Januari 2027');
  });
});

describe('Hapus termin tidak boleh menggeser tanggal termin lain', () => {
  const SRC = readFileSync('src/pages/SPHForm.tsx', 'utf8');
  const badan = SRC.slice(SRC.indexOf('function delT('), SRC.indexOf('function setTanggalTermin'));

  it('delT juga menyunting array tanggalTermin pada indeks yang sama', () => {
    expect(badan, 'delT harus memanggil setS').toContain('setS(');
    expect(badan, 'delT harus splice tanggalTermin').toContain('tanggalTermin');
    expect(badan).toContain('splice(i, 1)');
  });
});

describe('Form termin — input tanggal punya baris sendiri', () => {
  const SRC = readFileSync('src/pages/SPHForm.tsx', 'utf8');
  const css = readFileSync('src/index.css', 'utf8');
  // Ambil badan TerminPanel saja: dari deklarasinya sampai `function ` berikutnya.
  // (Jangan pakai indexOf('function Grp') — Grp dideklarasikan SEBELUM TerminPanel,
  // sehingga slice-nya jadi string kosong.)
  const mulai = SRC.indexOf('function TerminPanel');
  const panel = SRC.slice(mulai, SRC.indexOf('\nfunction ', mulai + 10));

  it('input date tidak lagi sebaris dengan grid 4 kolom', () => {
    // Dulu: <input type="date"> berada langsung di dalam .trow (4 kolom) → 26px.
    const trow = panel.slice(panel.indexOf('className="trow"'), panel.indexOf('trow-tgl'));
    expect(trow).not.toContain('type="date"');
    expect(panel).toContain('className="trow-tgl"');
  });

  it('CSS memberi baris tanggal label + input selebar sisa ruang', () => {
    expect(css).toContain('.trow-tgl');
    expect(css).toMatch(/\.trow-tgl\s*\{[^}]*grid-template-columns/);
  });
});
