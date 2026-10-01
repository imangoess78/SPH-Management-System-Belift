import { describe, it, expect } from 'vitest';
import { pageSPH } from '@/lib/sph-generator';
import { makeDefaultItems, TERMIN_AWAL, DESAIN, type DesainPilihan } from '@/lib/sph-types';

/**
 * Sapaan "PT" dan "CV" adalah bentuk badan usaha, bukan panggilan orang.
 * Regresi yang dijaga di sini: jangan sampai muncul "PT PT Sumber Jaya",
 * dan nama perusahaan tidak boleh kalah oleh nama orang saat sapaannya
 * badan usaha.
 */
const dasar: any = {
  noUrut: '9999', tanggal: '2026-10-01', kota: 'Depok',
  alamatKantor: 'Central Duta Graha, Jl. Raya Pd. Duta No.6A, Tugu, Cimanggis, Kota Depok',
  formatNoSPK: 'lama',
  nikCustomer: '00000000000',
  alamatCustomer: 'Jl. Contoh No. 1', kotaProyek: 'Bandung',
  jenisLift: 'Passenger Lift', tipeKabin: 'Standard', kapasitas: '450 Kg', penumpang: '6 Orang',
  kecepatan: '1 mps', mpm: '1 mps', sfd: '4/4/4',
  tipeMesin: 'Traction', traksi: '2:1', dayaMesin: '3,7 kW', power: '3 Phase', pintu: 'Center Opening',
  bukaanPintu: '800 mm', tinggiKabin: '2200 mm', shaftSize: '1500 x 1500', cabinSize: '1100 x 1300',
  pitDepth: '1400 mm', namaLantai: 'G, 1, 2, 3', baseFloor: 'G',
  ppn: 'include', masaBerlaku: '3 Minggu', freeMtn: '6 Bulan', garSpare: '2 tahun', garMesin: '5 tahun',
  waktuPengadaan: '2 Bulan', waktuInstalasi: '1,5 Bulan',
  tampilTtd: false, tampilDesain: false,
  diskon: 0, diskonPct: 0, biayaSipil: 0, addOn: [],
};

const items = makeDefaultItems().map(it => ({ ...it, on: true }));
const pilih: DesainPilihan = {} as DesainPilihan;

/** Ambil teks pada blok "Kepada Yth" dari dokumen SPH yang dihasilkan. */
function kepada(fields: Record<string, unknown>): string {
  const html = pageSPH({ ...dasar, ...fields } as any, items, TERMIN_AWAL, 'satuan', pilih, DESAIN);
  const m = html.match(/class="to">Kepada Yth:<br><strong>([^<]*)<\/strong>/);
  if (!m) throw new Error('blok "Kepada Yth" tidak ditemukan di dokumen');
  return m[1].replace(/&amp;/g, '&').trim();
}

describe('sapaan PT / CV pada dokumen SPH', () => {
  it('memakai nama perusahaan untuk sapaan PT, tanpa menggandakan "PT"', () => {
    expect(kepada({ sapaan: 'PT', namaCustomer: 'Budi', namaPerusahaan: 'Sumber Jaya' }))
      .toBe('PT Sumber Jaya');
  });

  it('tidak menggandakan bila nama perusahaan sudah memuat PT', () => {
    expect(kepada({ sapaan: 'PT', namaCustomer: 'Budi', namaPerusahaan: 'PT Sumber Jaya' }))
      .toBe('PT Sumber Jaya');
  });

  it('memakai nama perusahaan untuk sapaan CV', () => {
    expect(kepada({ sapaan: 'CV', namaCustomer: 'Siti', namaPerusahaan: 'Karya Mandiri' }))
      .toBe('CV Karya Mandiri');
  });

  it('jatuh ke nama customer bila perusahaan kosong', () => {
    expect(kepada({ sapaan: 'PT', namaCustomer: 'Yayasan Harapan', namaPerusahaan: '' }))
      .toBe('PT Yayasan Harapan');
  });

  it('sapaan orang tetap seperti semula: nama customer lebih diutamakan', () => {
    expect(kepada({ sapaan: 'Bapak', namaCustomer: 'Andi', namaPerusahaan: 'PT Sumber Jaya' }))
      .toBe('Bapak Andi');
  });

  it('sapaan orang jatuh ke perusahaan bila nama customer kosong', () => {
    expect(kepada({ sapaan: 'Ibu', namaCustomer: '', namaPerusahaan: 'PT Sumber Jaya' }))
      .toBe('Ibu PT Sumber Jaya');
  });

  it('sapaan "—" diperlakukan sebagai Bapak (perilaku lama dipertahankan)', () => {
    expect(kepada({ sapaan: '—', namaCustomer: 'Andi', namaPerusahaan: '' }))
      .toBe('Bapak Andi');
  });
});
