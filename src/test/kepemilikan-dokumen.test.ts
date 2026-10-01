import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Kepemilikan dokumen (`user_id` / `nama_sales`) tidak boleh ditentukan oleh
 * pengirim request.
 *
 * LUBANG YANG PERNAH ADA: kedua kolom itu datang di dalam body PUT dan
 * ditulis apa adanya. Sales A (punya `ubah_sendiri`, tanpa `ubah_semua`)
 * cukup menyertakan `user_id` sales B untuk memindahkan dokumennya ke B —
 * sudah dibuktikan ke server sungguhan (PUT balas 200 dan `user_id`
 * benar-benar berpindah). Pemeriksaan kepemilikan di atasnya tidak menangkap
 * karena dokumen masih milik A saat diperiksa.
 *
 * Uji ini memeriksa sumber data.ts sebagai teks.
 */
const SUMBER = readFileSync(resolve(__dirname, '../../functions/api/data.ts'), 'utf8');

describe('kepemilikan dokumen tidak bisa ditentukan pengirim', () => {
  it('kolom pemilik diabaikan saat PUT oleh akun tanpa ubah_semua', () => {
    const i = SUMBER.indexOf("if (!boleh(akses.izin, 'ubah_semua'))");
    expect(i, 'pemeriksaan ubah_semua untuk kolom pemilik hilang').toBeGreaterThan(-1);
    const blok = SUMBER.slice(i, i + 700);
    expect(blok, 'user_id dari body masih ditulis saat PUT').toContain('delete clean.user_id');
    expect(blok, 'nama_sales dari body masih ditulis saat PUT').toContain('delete clean.nama_sales');
  });

  it('nama_sales hanya diterima bila memang milik pengirim', () => {
    const i = SUMBER.indexOf('delete clean.user_id');
    const blok = SUMBER.slice(i, i + 400);
    expect(blok, 'nama_sales ditulis tanpa pemeriksaan kepemilikan').toContain('bolehSentuh');
  });

  it('POST tetap memaksa pemilik = pembuat dokumen', () => {
    const i = SUMBER.indexOf("if (!boleh(akses.izin, 'ubah_semua'))");
    const blok = SUMBER.slice(i, i + 700);
    expect(blok).toContain('clean.user_id = akses.userId');
  });
});
