import { describe, it, expect } from 'vitest';
import { boleh, izinEfektif, SEMUA_KUNCI } from '../../shared/akses';

/**
 * Master CRM (kanal, batas diskon, daftar sales, status, biaya iklan) ditulis
 * lewat /api/crm?resource=ref_* dan ?resource=biaya_iklan.
 *
 * LUBANG YANG PERNAH ADA: seluruh endpoint /api/crm hanya dijaga izin `crm`.
 * Peran sales PUNYA `crm` tapi TIDAK punya `master`, sehingga sales bisa
 * menambah, mengubah, dan menghapus data acuan itu lewat API — walaupun menu
 * "Master CRM" tersembunyi dari mereka di tampilan.
 *
 * Pelajarannya: menyembunyikan menu di tampilan BUKAN pengamanan. Halaman
 * yang disembunyikan tetap harus ditolak di sisi API. Test ini menjaga agar
 * pemisahan itu tidak bocor lagi.
 */
describe('tulis Master CRM wajib izin `master`, bukan sekadar `crm`', () => {
  it('sales punya `crm` tetapi TIDAK punya `master` — inilah sebab lubangnya', () => {
    const izin = izinEfektif('sales', null);
    expect(izin).toContain('crm');
    expect(izin).not.toContain('master');
  });

  it('sales tidak boleh lolos gerbang tulis Master CRM', () => {
    // Gerbang sebenarnya di functions/api/crm.ts: `boleh(akses.izin, 'master')`.
    expect(boleh(izinEfektif('sales', null), 'master')).toBe(false);
  });

  it('peran tanpa `master` sama-sama ditolak (staff, dan peran tak dikenal)', () => {
    for (const peran of ['staff', 'entah-apa']) {
      expect(boleh(izinEfektif(peran, null), 'master'), `peran ${peran}`).toBe(false);
    }
  });

  it('pengelola Master Data tetap boleh menulis', () => {
    for (const peran of ['admin', 'direktur', 'manager']) {
      expect(boleh(izinEfektif(peran, null), 'master'), `peran ${peran}`).toBe(true);
    }
  });

  it('izin khusus `master` cukup untuk menulis tanpa perlu peran admin', () => {
    expect(boleh(izinEfektif('staff', ['master']), 'master')).toBe(true);
  });

  it('menghapus Master CRM juga ikut tertutup, bukan hanya POST/PUT', () => {
    // DELETE memakai gerbang yang sama; pastikan peran operasional pun tidak
    // otomatis berhak menghapus data acuan tanpa `master`.
    const izinSales = izinEfektif('sales', null);
    expect(boleh(izinSales, 'master')).toBe(false);
    expect(boleh(izinSales, 'hapus_data')).toBe(false);
  });
});

/**
 * Pengaman menyeluruh: setiap kunci halaman yang dipakai sebagai gerbang API
 * harus benar-benar ada di daftar kunci yang dikenal. Salah ketik satu huruf
 * (`survei_final` alih-alih `survey_final`) akan membuat gerbangnya selalu
 * menolak — atau lebih buruk, selalu membuka.
 */
describe('kunci izin yang dipakai gerbang API terdaftar', () => {
  const dipakai = [
    'dashboard', 'crm', 'sph', 'survey_sales', 'survey_final',
    'po', 'laporan', 'master', 'kalkulator', 'pengaturan', 'akun', 'backup',
    'lihat_sendiri', 'lihat_semua', 'ubah_sendiri', 'ubah_semua',
    'approve_diskon', 'kunci_final', 'reassign_lead', 'hapus_data',
  ] as string[];

  it('semua kunci gerbang dikenal oleh SEMUA_KUNCI', () => {
    for (const k of dipakai) {
      expect(SEMUA_KUNCI, `kunci tak dikenal: ${k}`).toContain(k);
    }
  });
});
