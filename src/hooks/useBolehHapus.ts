import { useAuth } from '@/hooks/useAuth';

/**
 * Apakah pengguna yang sedang login berwenang menghapus data?
 *
 * Sumbernya adalah `izin` dari /api/auth/session, yang dihitung server lewat
 * izinEfektif(role, permissions) — jadi akun dengan izin khusus (bukan hanya
 * peran bawaan) ikut terbaca benar.
 *
 * PENTING: ini hanya untuk menyembunyikan tombol. Pengamanan sebenarnya ada di
 * server (functions/api/*.ts memanggil boleh(akses.izin, 'hapus_data')).
 */
export function useBolehHapus(): boolean {
  const { izin } = useAuth();
  return izin.includes('hapus_data');
}
