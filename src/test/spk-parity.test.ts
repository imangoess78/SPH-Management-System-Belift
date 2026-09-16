import { describe, it, expect } from 'vitest';
import { pageSPH, pageSPK } from '@/lib/sph-generator';
import { makeDefaultItems, normalizeStrukturItems, TERMIN_AWAL, DESAIN, type DesainPilihan } from '@/lib/sph-types';

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

describe('Struktur Steel/Aluminium tampil di blok Pekerjaan Sipil, bukan Instalasi', () => {
  // Susunan dokumen lama apa adanya: `I1c` (Struktur Steel, kel INSTALASI)
  // duduk di tengah blok Instalasi & Maintenance.
  const legacy = [
    { id:'I1',  kel:'INSTALASI', nama:'Instalasi', sat:'Unit', on:true,  inc:false },
    { id:'I1a', kel:'INSTALASI', nama:'Mekanikal', sat:'Ls',   on:true,  inc:true, par:'I1' },
    { id:'I1b', kel:'INSTALASI', nama:'Elektrikal', sat:'Ls',  on:true,  inc:true, par:'I1' },
    { id:'I1c', kel:'INSTALASI', nama:'Struktur Steel', sat:'Ls', on:true, inc:false },
    { id:'I2',  kel:'INSTALASI', nama:'Testing & Commissioning', sat:'Ls', on:true, inc:true },
    { id:'S1',  kel:'SIPIL', nama:'Pekerjaan Sipil', sat:'Ls', on:false, inc:false },
    { id:'S1a', kel:'SIPIL', nama:'Pembuatan Pit', sat:'Ls', on:false, inc:true, par:'S1' },
    { id:'S1f', kel:'SIPIL', nama:'Finishing Sill', sat:'Ls', on:false, inc:true, par:'S1' },
    { id:'S2',  kel:'SIPIL', nama:'Elektrikal / Kelistrikan', sat:'Ls', on:false, inc:false },
  ] as any;

  const out = normalizeStrukturItems(legacy);
  const ids = out.map((i: any) => i.id);

  it('I1c dimigrasi jadi S1g berkategori SIPIL', () => {
    expect(ids).not.toContain('I1c');
    const g = out.find((i: any) => i.id === 'S1g');
    expect(g).toBeTruthy();
    expect(g.kel).toBe('SIPIL');
    expect(g.par).toBe('S1');
    expect(g.nama).toBe('Struktur Steel');
  });

  it('S1h (Struktur Aluminium) ikut disisipkan di blok SIPIL', () => {
    const h = out.find((i: any) => i.id === 'S1h');
    expect(h).toBeTruthy();
    expect(h.kel).toBe('SIPIL');
    expect(h.par).toBe('S1');
  });

  it('S1g/S1h berada setelah S1f dan sebelum S2', () => {
    expect(ids.indexOf('S1g')).toBeGreaterThan(ids.indexOf('S1f'));
    expect(ids.indexOf('S1h')).toBeGreaterThan(ids.indexOf('S1g'));
    expect(ids.indexOf('S2')).toBeGreaterThan(ids.indexOf('S1h'));
  });

  it('tidak ada anak S1 yang tertinggal di blok Instalasi', () => {
    const batasInstalasi = ids.indexOf('I2');
    const nyasar = out.slice(0, batasInstalasi).filter((i: any) => i.par === 'S1');
    expect(nyasar).toHaveLength(0);
  });

  it('centang Struktur Steel dokumen lama tetap terjaga + induk S1 menyala', () => {
    expect(out.find((i: any) => i.id === 'S1g').on).toBe(true);
    expect(out.find((i: any) => i.id === 'S1').on).toBe(true);
  });

  it('item yang sudah punya S1g/S1h tidak digandakan', () => {
    const sudah = normalizeStrukturItems(out);
    expect(sudah.filter((i: any) => i.id === 'S1g')).toHaveLength(1);
    expect(sudah.filter((i: any) => i.id === 'S1h')).toHaveLength(1);
    expect(sudah.map((i: any) => i.id)).toEqual(ids);
  });

  it('katalog default sudah menaruh S1g/S1h di dalam blok SIPIL', () => {
    const d = makeDefaultItems();
    const dIds = d.map(i => i.id);
    expect(dIds.indexOf('S1g')).toBeGreaterThan(dIds.indexOf('S1f'));
    expect(dIds.indexOf('S1h')).toBeGreaterThan(dIds.indexOf('S1g'));
    expect(dIds.indexOf('S2')).toBeGreaterThan(dIds.indexOf('S1h'));
    expect(dIds.indexOf('S1g')).toBeLessThan(dIds.indexOf('S2'));
  });

  it('SPK mencetak klausul "Pemasangan Struktur Steel" setelah baris sipil', () => {
    // Catatan: SPK tidak memuat tabel harga (itu domain SPH) — yang dikunci di
    // sini adalah klausul lingkup PIHAK KEDUA, tempat label struktur dicetak
    // dari urutan item. Posisi baris di tabel harga diuji lewat urutan `ids`.
    const doc = pageSPK(s, out, termin, 'satuan', pilih, DESAIN);
    const iLingkup = doc.indexOf('Produksi dan pengadaan elevator');
    const iStruktur = doc.indexOf('Pemasangan Struktur Steel');
    expect(iLingkup).toBeGreaterThan(-1);
    expect(iStruktur).toBeGreaterThan(iLingkup);
    expect(doc).toContain('Powder Coating Hitam');
  });
});
