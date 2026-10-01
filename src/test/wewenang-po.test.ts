import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Wewenang menerbitkan PO — dua syarat yang keduanya wajib.
 *
 * Dulu cabang PO di functions/api/po.ts TIDAK memeriksa wewenang ubah sama
 * sekali: siapa pun yang bisa mencapai /api/po (izin halaman `po`) bebas
 * mengubah dan menerbitkan PO — termasuk akun yang sengaja dibatasi
 * "hanya lihat" oleh admin. Modul SPH dan Survey sudah lama menolaknya.
 *
 * Uji ini memeriksa SUMBER po.ts sebagai teks: yang dijaga adalah "apakah
 * pemeriksaannya ada", dan itu hanya terlihat di kode.
 *
 * Catatan penting soal arah perbaikan: wewenang terbit PO TIDAK boleh
 * disandarkan pada peran akun (`app_users.role`). Menurut PRD 9.7, yang
 * menerbitkan PO adalah PIC PO berperan "Operasional" di Master CRM, dan akun
 * itu dibuat ber-role `staff`. Menyandarkannya ke peran akun akan MEMATIKAN
 * alur kerja PIC PO — pernah dicoba dan dibatalkan karena alasan ini.
 */
const SUMBER = readFileSync(resolve(__dirname, '../../functions/api/po.ts'), 'utf8');

describe('wewenang terbit PO', () => {
  it('peran penerbit tetap dari Master CRM (PIC PO ber-role staff tetap bisa)', () => {
    expect(SUMBER).toMatch(/const PERAN_PENERBIT\s*=\s*\[[^\]]*'Operasional'[^\]]*\]/);
  });

  it('tidak menyandarkan wewenang pada peran akun', () => {
    expect(
      SUMBER.includes('ROLE_AKUN_PENERBIT'),
      'wewenang disandarkan pada app_users.role — PIC PO (role staff) kehilangan haknya',
    ).toBe(false);
  });

  it('bolehTerbitkanPO juga menuntut akun tidak "hanya lihat"', () => {
    const i = SUMBER.indexOf('function bolehTerbitkanPO');
    expect(i, 'bolehTerbitkanPO hilang').toBeGreaterThan(-1);
    const isi = SUMBER.slice(i, i + 900).replace(/\s+/g, ' ');
    expect(isi).toContain('PERAN_PENERBIT.includes');
    expect(isi, 'PO bisa diterbitkan akun hanya-lihat — lubang lama kembali').toContain("cakupanUbah !== 'tidak'");
  });

  it('terbitkan() menerima dan memakai akses pemanggil', () => {
    const i = SUMBER.indexOf('async function terbitkan');
    expect(i).toBeGreaterThan(-1);
    const isi = SUMBER.slice(i, SUMBER.indexOf('const revisiBaru', i));
    expect(isi).toContain('bolehTerbitkanPO(aku, akses)');
  });

  it('ubah PO (PUT/POST) memeriksa wewenang ubah dan kepemilikan sales', () => {
    const i = SUMBER.indexOf("case 'po':");
    expect(i).toBeGreaterThan(-1);
    const cabang = SUMBER.slice(i, i + 2000);
    expect(cabang, 'PUT/POST PO tidak memeriksa cakupanUbah').toContain("cakupanUbah === 'tidak'");
    expect(cabang, 'PUT PO tidak memeriksa kepemilikan').toContain('bolehSentuh');
  });
});
