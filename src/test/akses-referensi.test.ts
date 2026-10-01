import { describe, it, expect } from 'vitest';
import { IZIN_PER_PERAN, izinEfektif } from '../../shared/akses';

/**
 * Data referensi (daftar sales + opsi desain) dibaca form SPH/SPK lewat
 * /api/data?table=sales dan ?table=design_items. Endpoint itu memakai izin
 * `sph` untuk pembacaan dan `master` untuk penulisan.
 *
 * Regresi yang dijaga di sini: peran yang mengisi form SPH wajib punya `sph`,
 * dan sebaliknya tidak boleh diberi `master` hanya demi membaca data
 * referensi — itu akan membuka kembali menu Master Data yang sengaja
 * disembunyikan dari sales dan staff.
 */
describe('izin data referensi untuk pengisi form SPH', () => {
  it('sales punya `sph` supaya bisa membaca daftar sales & opsi desain', () => {
    expect(izinEfektif('sales', null)).toContain('sph');
  });

  it('staff punya `sph` supaya bisa membaca daftar sales & opsi desain', () => {
    expect(izinEfektif('staff', null)).toContain('sph');
  });

  it('sales tidak punya `master` (Master CRM/Master Data tetap tersembunyi)', () => {
    expect(izinEfektif('sales', null)).not.toContain('master');
  });

  it('staff tidak punya `master` (Master CRM/Master Data tetap tersembunyi)', () => {
    expect(izinEfektif('staff', null)).not.toContain('master');
  });

  it('admin, direktur, dan manager tetap punya `master`', () => {
    for (const peran of ['admin', 'direktur', 'manager']) {
      expect(izinEfektif(peran, null), `peran ${peran}`).toContain('master');
    }
  });

  it('izin khusus tetap menang atas bawaan peran', () => {
    // Staff yang diberi `master` secara eksplisit boleh membuka Master Data.
    expect(izinEfektif('staff', ['master'])).toContain('master');
    // Array kosong berarti benar-benar tanpa izin, bukan "pakai bawaan".
    expect(izinEfektif('staff', [])).not.toContain('sph');
  });

  it('peran tak dikenal jatuh ke staff', () => {
    expect(izinEfektif('entah-apa', null)).toEqual(izinEfektif('staff', null));
  });

  it('hanya admin yang memakai izin penuh (`*`); peran lain tetap daftar eksplisit', () => {
    for (const peran of ['direktur', 'manager', 'sales', 'staff'] as const) {
      const daftar = IZIN_PER_PERAN[peran] as readonly string[];
      // Penanda `*` akan diam-diam memberi SEMUA izin (termasuk `master`),
      // jadi peran non-admin tidak boleh memakainya.
      expect(daftar, `peran ${peran} tidak boleh memakai '*'`).not.toBe('*');
      expect(daftar, `peran ${peran} wajib bisa mengisi form SPH`).toContain('sph');
    }
  });
});
