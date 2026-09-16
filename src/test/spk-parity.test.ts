import { describe, it, expect } from 'vitest';
import { pageSPH, pageSPK } from '@/lib/sph-generator';
import { makeDefaultItems, TERMIN_AWAL, DESAIN, type DesainPilihan } from '@/lib/sph-types';

// State contoh yang menyalakan Struktur Steel + mengisi keterangan modifikasi,
// supaya seluruh klausul & baris hasil update SPH ikut teruji di jalur SPK.
const s: any = {
  noUrut: '7826', tanggal: '2026-08-12', kota: 'Depok',
  alamatKantor: 'Komplek Pelni, Jalan Gama Setia Raya No. B3/8, Bakti Jaya, Kec. Sukmajaya, Kota Depok',
  formatNoSPK: 'lama',
  sapaan: 'Bapak', namaCustomer: 'Yessitania', namaPerusahaan: '', nikCustomer: '00000000000',
  alamatCustomer: 'Santren, Banaran, Lamongan, Jawa Timur', kotaProyek: 'Lamongan',
  jenisLift: 'Home Lift', tipeKabin: 'Premium Pintu Kaca', kapasitas: '400 Kg', penumpang: '3 - 5 Orang',
  kecepatan: '0,4 mps', mpm: '0,4 mps', sfd: '4/4/4',
  tipeMesin: 'Traction', traksi: '2:1', dayaMesin: '3,7 kW', power: '1 Phase', pintu: 'Center Opening',
  bukaanPintu: '700 mm', tinggiKabin: '2200 mm', shaftSize: '1500 x 1500', cabinSize: '1000 x 1200',
  pitDepth: '400 mm', namaLantai: 'G, 1, 2, 3', baseFloor: 'G',
  ppn: 'exclude', masaBerlaku: '3 Minggu', freeMtn: '6 Bulan', garSpare: '2 tahun', garMesin: '5 tahun',
  waktuPengadaan: '2 Bulan', waktuInstalasi: '1,5 Bulan',
  tampilTtd: true, tampilDesain: true,
  finishingStruktur: 'Powder Coating Hitam',
  catatanDesain: { cabin: 'handle diganti silver', struktur: 'kaca extra clear' },
  sales: 'Imam Solikhin', jabatanTtd: 'Sales', direktur: 'Adhie Kurnia',
  rekening: 'BANK BCA : 1662996330 - KCP Cimanggis, Depok',
};

const items = makeDefaultItems().map(it =>
  (it.id === 'S1g' || it.id === 'S1') ? { ...it, on: true } : it
);
const termin = JSON.parse(JSON.stringify(TERMIN_AWAL));
const pilih: DesainPilihan = {
  cabin: DESAIN.cabin[0].kode, floor: '', ceiling: '', door: '', cop: '', lop: '',
  struktur: DESAIN.struktur[0].kode, addon: '',
};

describe('SPK memuat seluruh klausul dokumen referensi', () => {
  const spk = pageSPK(s, items, termin, 'satuan', pilih, DESAIN);

  it('Pasal 1 lengkap (MOS, BAST, Handover, Garansi, Progress)', () => {
    expect(spk).toContain('Material yang termasuk dalam kategori MOS');
    expect(spk).toContain('Menandakan pekerjaan telah selesai secara substansial');
    expect(spk).toContain('5. Handover');
    expect(spk).toContain('Handover dibuktikan dengan dokumen BAST');
    expect(spk).toContain('Masa garansi dimulai sejak tanggal BAST');
    expect(spk).toContain('7. Progress Pekerjaan');
    expect(spk).toContain('Progress harus dapat diverifikasi oleh kedua belah pihak');
  });

  it('Pasal 2 memuat sub-poin A-D lingkup PIHAK PERTAMA', () => {
    expect(spk).toContain('A. Pekerjaan sipil ;');
    expect(spk).toContain('B. Pengadaan Elektrikal/Kelistrikan');
    expect(spk).toContain('C. Pengadaan gudang peralatan Lift');
    expect(spk).toContain('D. Pembuatan pit');
    expect(spk).toContain('Merupakan pekerjaan utama pengadaan hingga pemasangan Elevator melingkupi');
  });

  it('Pasal 8 Force Majeure memuat klausul ahli waris', () => {
    expect(spk).toContain('ahli waris yang sah');
    expect(spk).toContain('para pihak atau ahli waris yang sah sepakat menyelesaikannya secara musyawarah');
  });

  it('Pasal 10 Penutup memuat klausul rangkap dua', () => {
    expect(spk).toContain('Perjanjian ini dibuat dalam rangkap dua');
  });

  it('mencetak halaman spesifikasi + catatan survey final', () => {
    expect(spk).toContain('NOTES: Spesifikasi FINAL SETELAH SURVEY FINAL');
    expect(spk).toContain('With Traction Description');
  });
});

describe('Update SPH kemarin (struktur + keterangan modifikasi) berlaku di SPK & SPH', () => {
  const spk = pageSPK(s, items, termin, 'satuan', pilih, DESAIN);
  const sph = pageSPH(s, items, termin, 'satuan', pilih, DESAIN);

  for (const [nama, doc] of [['SPK', spk], ['SPH', sph]] as const) {
    it(`${nama}: klausul Pemasangan Struktur Steel + finishing`, () => {
      expect(doc).toContain('Pemasangan');
      expect(doc).toContain('Struktur Steel');
      expect(doc).toContain('Powder Coating Hitam');
    });

    it(`${nama}: halaman Opsi Desain memuat "Modifikasi" dari catatanDesain`, () => {
      expect(doc).toContain('Opsi Desain');
      expect(doc).toContain('Modifikasi:');
      expect(doc).toContain('kaca extra clear');
    });

    it(`${nama}: baris spesifikasi struktur ikut tercetak`, () => {
      expect(doc).toContain('Struktur finishing');
    });
  }
});

describe('Tanda tangan sales dari DB (fitur yang tadinya hanya di salinan lokal)', () => {
  it('dipakai bila signatureUrl diberikan', () => {
    const doc = pageSPH(s, items, termin, 'satuan', pilih, DESAIN, '/media/ttd-imam.png');
    expect(doc).toContain('/media/ttd-imam.png');
  });
  it('fallback ke ASET bila signatureUrl kosong (tidak error)', () => {
    const doc = pageSPH(s, items, termin, 'satuan', pilih, DESAIN);
    expect(doc).toContain('sig-nm');
  });
});
