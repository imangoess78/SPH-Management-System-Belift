// ============================================================
//  BATAS DOKUMEN: PO saja yang berbahasa Inggris.
//  SPH/SPK TIDAK BOLEH tersentuh oleh revisi Final Survey/PO.
//  Final Survey tetap Indonesia (dokumen internal).
//  Tes ini menjaga batas itu supaya tidak jebol lagi diam-diam.
// ============================================================
import { describe, it, expect } from 'vitest';
import { htmlSurvey, htmlPo, teksRingkasSurvey } from '@/lib/survey-cetak';
import type { PoRevisiRow } from '@/lib/survey-types';
import type { BahanCetakPo } from '@/lib/survey-cetak';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const t = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const dtLengkap = {
  jenisLift: 'Passenger', kapasitas: '400', kecepatan: '60', sfd: '4/4/4',
  tipeMesin: 'MRL', shaftSize: '1600 x 1500', pitDepth: '1400',
  tipePintu: 'Center Opening', bukaanPintu: '800',
  finishCarDoor: 'Hairline Gold', finishLandingDoor: 'Mirror Silver',
  cabinSize: '1100 x 1400', bahanCabin: 'Stainless Champagne', power: '380 3ph',
  lantai: [
    { lantai: 'Lantai 1', tinggi: '3800', door: 'CO 800', finishing: 'Granit' },
    { lantai: 'Lantai 2', tinggi: '3500', door: 'CO 800', finishing: 'Granit' },
  ],
  addon: [{ kode: 'A1', nama: 'ARD', on: true, ada: true, fotoLink: '' }],
  'note:jenisLift': 'Sesuai peruntukan.',
};

const po = {
  no_po: 'PO/X/1', tgl_po: '2026-11-20', kode_proyek: 'PRJ', nama_prospek: 'Proyek',
  pabrik: 'PT. Sinar Cerah Sempurna', pic: 'Bpk', catatan: '', rev_terakhir: 1,
  status: 'diterbitkan', dibuat_oleh: 'Ops',
} as unknown as BahanCetakPo;
const revisi = [{ rev: 1, tgl_revisi: '2026-11-20', oleh: 'Ops', alasan: 'awal', jml_perubahan: 0, dt: dtLengkap }] as unknown as PoRevisiRow[];

const survey = {
  jenis: 'final', noSurvey: 'FS-1', tgl: '2026-11-20', kodeProyek: 'PRJ', kodeLead: 'L1',
  namaProspek: 'Proyek', surveyor: 'Andi', pjLapangan: 'Budi', pjTelp: '0812',
  jamKerja: '09:00-15:00', dt: dtLengkap,
  addon: dtLengkap.addon, lantai: dtLengkap.lantai,
  pekerjaan: [], kesimpulan: [], dokumentasi: [], catatanLapangan: '',
  ttd: { sales: 'Andi', surveyor: 'Andi', pelanggan: 'Pak X' },
} as unknown as Parameters<typeof htmlSurvey>[0];

describe('Batas dokumen — PO Inggris, Final Survey Indonesia, SPH/SPK utuh', () => {
  it('PO: label tabel lantai & add-on berbahasa Inggris', () => {
    const x = t(htmlPo(po, revisi));
    expect(x).toContain('Floor Table');
    expect(x).toContain('Height (mm)');
    expect(x).toContain('Door Opening');
    expect(x).toContain('Ordered');
    expect(x).toContain('Available');
    expect(x).toContain('Photo');
  });

  it('Final Survey: tabel lantai & add-on TETAP berbahasa Indonesia', () => {
    const x = t(htmlSurvey(survey));
    expect(x).toContain('Tabel Lantai');
    expect(x).toContain('Lantai');
    expect(x).toContain('Tinggi (mm)');
    expect(x).toContain('Bukaan Pintu');
    expect(x).toContain('Kode');
    expect(x).toContain('Nama');
    expect(x).toContain('Dipesan');
    expect(x).toContain('Sudah Ada');
    expect(x).toContain('Foto');
    // dan tidak boleh ikut terterjemahkan
    expect(x).not.toContain('Floor Table');
    expect(x).not.toContain('Ordered');
    expect(x).not.toContain('Available');
  });

  it('Final Survey: nilai add-on memakai "Ya", bukan "Yes"', () => {
    const x = t(htmlSurvey(survey));
    expect(x).toContain('Ya');
    expect(x).not.toContain('Yes');
  });

  it('ringkasan teks Final Survey tetap Indonesia', () => {
    const r = teksRingkasSurvey({
      jenis: 'final', noSurvey: 'FS-1', tgl: '2026-11-20', kodeProyek: 'PRJ',
      namaProspek: 'Proyek', dt: dtLengkap, addon: dtLengkap.addon, lantai: dtLengkap.lantai,
    } as unknown as Parameters<typeof teksRingkasSurvey>[0]);
    expect(r).toContain('Jenis lift');
    expect(r).toContain('Kapasitas');
    expect(r).toContain('Lantai');
  });

  it('field warna baru tercetak di PO DAN di Final Survey (katalog sama)', () => {
    for (const warna of ['Hairline Gold', 'Mirror Silver', 'Stainless Champagne']) {
      expect(t(htmlPo(po, revisi))).toContain(warna);
      expect(t(htmlSurvey(survey))).toContain(warna);
    }
  });

  it('field yang dihapus tidak tercetak di kedua dokumen bila kosong', () => {
    for (const h of [t(htmlPo(po, revisi)), t(htmlSurvey(survey))]) {
      expect(h).not.toContain('Motor Power');
      expect(h).not.toContain('Machine Brand');
      expect(h).not.toContain('Machine Position');
      expect(h).not.toContain('Drive System');
    }
  });

  it('sph-generator tidak diubah oleh revisi ini (penjaga SPH/SPK)', () => {
    // Label SPH/SPK harus tetap 'Stops/Floors/Doors' — kalau seseorang
    // menerjemahkan katalog lalu menyentuh generator SPH, tes ini gagal.
    const src = readFileSync(resolve(process.cwd(), 'src/lib/sph-generator.ts'), 'utf8');
    expect(src).toContain("['Stops/Floors/Doors', s.sfd]");
    expect(src).not.toContain("['Floors/Stops/Doors', s.sfd]");
  });
});
