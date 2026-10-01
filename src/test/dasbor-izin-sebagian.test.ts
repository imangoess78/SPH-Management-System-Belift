import { describe, it, expect } from 'vitest';
import { susunBahan } from '@/lib/alur';

/**
 * Dasbor adalah halaman yang terbuka untuk SEMUA peran, tetapi datanya ditarik
 * dari beberapa endpoint yang izinnya berbeda-beda:
 *
 *   /api/data?table=sph        -> izin `sph`
 *   /api/survey?resource=...   -> izin `survey_sales` / `survey_final`
 *   /api/po                    -> izin `po`
 *   /api/crm?resource=leads    -> izin `crm`
 *
 * Staff tidak punya `crm` (dan sales tidak punya `po`), jadi sebagian sumber
 * PASTI gagal. Regresi yang dijaga di sini: kegagalan izin itu tidak boleh
 * membuat data yang BERHASIL dibaca ikut hilang.
 *
 * Sebelumnya daftar baris dibangun murni dari `m.lead`. Begitu staff ditolak
 * `/api/crm`, `m.lead` kosong dan seluruh tabel "Rincian per Lead" lenyap —
 * termasuk peringatan "proyek berubah setelah Final Survey dikunci", padahal
 * justru staff yang memproses revisi PO tersebut. Kegagalan izin menyamar
 * sebagai "tidak ada data".
 */

const leadL1 = {
  id: 'L1', kode_lead: 'LD-001', kode_proyek: 'PRJ-001',
  nama_prospek: 'PT Contoh', kota: 'Jakarta', sales: 'Imam',
  kualifikasi: 'HOT', status_terakhir: 'Baru',
  waktu_masuk: '2026-09-01T00:00:00Z', created_at: '2026-09-01T00:00:00Z',
};

const surveyFinalL1 = {
  id: 'SV1', id_lead: 'L1', kode_proyek: 'PRJ-001', jenis: 'final' as const,
  no_survey: '001/SV/F/2026', tgl_survey: '2026-09-20', tanggal: '2026-09-20',
  disurvey_oleh: 'Sur', surveyor: 'Sur', terkunci: true,
  dikunci_oleh: 'Sur', dikunci_pada: '2026-10-01T00:00:00Z',
  status: 'selesai', updated_at: '2026-10-01T00:00:00Z',
  nama_prospek: null, kode_lead: null, kota: null,
};

const poL1 = {
  id: 'PO1', id_lead: 'L1', kode_proyek: 'PRJ-001', no_po: '001/PO/2026',
  tgl_po: '2026-10-02', pabrik: 'Pabrik A', pic: 'PIC', rev_terakhir: 1,
  status: 'terbit', catatan: null, dibuat_oleh: 'Staf',
  // Lebih BARU dari dikunci_pada -> PO berubah setelah Final Survey dikunci.
  created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-05T00:00:00Z',
};

const sphL1 = { id: 'S1', id_lead: 'L1', nomor_sph: '001/SPH/LIFT/BAI/X/2026', status: 'final' };

describe('susunBahan — Dasbor tetap utuh saat satu sumber ditolak izin', () => {
  it('staff (lead ditolak 403) tetap melihat baris dari SPH/survey/PO', () => {
    const { angka, baris } = susunBahan({
      dokumen: [sphL1],
      proyek: [],
      survey: [surveyFinalL1],
      po: [poL1],
      lead: [], // <- staff tidak punya izin `crm`
    });

    expect(baris.length, 'tabel Rincian per Lead tidak boleh kosong').toBe(1);
    expect(baris[0].id_lead).toBe('L1');
    expect(baris[0].finalTerkunci).toBe(true);
    expect(baris[0].po).toBe(true);
    expect(baris[0].sph).toBe(true);
  });

  it('staff tetap menerima peringatan "PO berubah setelah Final Survey dikunci"', () => {
    const { angka } = susunBahan({
      dokumen: [sphL1],
      proyek: [],
      survey: [surveyFinalL1],
      po: [poL1],
      lead: [],
    });

    expect(angka.poPerluTinjau, 'peringatan revisi PO wajib muncul untuk staff').toBe(1);
    expect(angka.poTotal).toBe(1);
    expect(angka.finalTerkunci).toBe(1);
  });

  it('kolom yang hanya ada di CRM jujur tampil "—", bukan dikarang', () => {
    const { baris } = susunBahan({
      dokumen: [sphL1], proyek: [], survey: [surveyFinalL1], po: [poL1], lead: [],
    });

    expect(baris[0].kualifikasi).toBe('—');
    expect(baris[0].nama_prospek).toBe('—');
    expect(baris[0].kode_lead).toBe('—');
  });

  it('lead yang sama di banyak sumber tidak menghasilkan baris ganda', () => {
    const { baris } = susunBahan({
      dokumen: [sphL1],
      proyek: [{ id: 'PR1', kode_proyek: 'PRJ-001', id_lead: 'L1', nama_proyek: 'X', customer: 'PT Contoh', kota: 'Jakarta', status_terakhir: null, tahap_sekarang: null, created_at: '', updated_at: '' }],
      survey: [surveyFinalL1],
      po: [poL1],
      lead: [leadL1],
    });

    expect(baris.length).toBe(1);
  });

  it('peran yang punya `crm` tetap mendapat data lead seperti semula', () => {
    const { angka, baris } = susunBahan({
      dokumen: [sphL1],
      proyek: [],
      survey: [surveyFinalL1],
      po: [poL1],
      lead: [leadL1],
    });

    expect(baris.length).toBe(1);
    expect(baris[0].kualifikasi).toBe('HOT');
    expect(baris[0].nama_prospek).toBe('PT Contoh');
    expect(angka.leadTotal).toBe(1);
    expect(angka.leadHot).toBe(1);
    expect(angka.poPerluTinjau).toBe(1);
  });

  it('tanpa satu pun sumber terbaca, baris tetap kosong (bukan error)', () => {
    const { baris, angka } = susunBahan({
      dokumen: [], proyek: [], survey: [], po: [], lead: [],
    });

    expect(baris).toEqual([]);
    expect(angka.leadTotal).toBe(0);
    expect(angka.poPerluTinjau).toBe(0);
  });
});
