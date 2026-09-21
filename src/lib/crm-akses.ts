export interface Pengguna {
  id: string;
  email: string | null;
  nama: string;
  peran: string;          // Sales | Admin | Manager | Direktur | Admin Sistem
  jabatan: string | null;
}

/**
 * Tentukan hak akses dari sesi login.
 *
 * Sales  : hanya melihat & mengubah lead miliknya sendiri.
 * Admin  : Meja Dokumen + seluruh lead (read).
 * Manager: seluruh lead + boleh ubah.
 * Direktur: seluruh lead + boleh ubah.
 *
 * Dicocokkan lewat nama tampilan / email terhadap crm_ref_sales.
 * Kalau tidak cocok, diberi peran paling sempit (Sales).
 */
export function tentukanPeran(
  profil: { full_name?: string | null; email?: string | null } | null | undefined,
  daftarSales: { nama: string; email: string | null; peran: string }[],
  emailLogin?: string | null,
): { nama: string; peran: string } {
  const nama = profil?.full_name || emailLogin || 'Pengguna';
  const email = (profil?.email || emailLogin || '').toLowerCase();

  // 1. Cocok lewat email (paling akurat)
  if (email) {
    const byEmail = daftarSales.find(s => (s.email || '').toLowerCase() === email);
    if (byEmail) return { nama: byEmail.nama, peran: byEmail.peran };
  }
  // 2. Cocok lewat nama
  const namaLower = nama.toLowerCase();
  const byNama = daftarSales.find(s => s.nama.toLowerCase() === namaLower)
    || daftarSales.find(s => namaLower.includes(s.nama.toLowerCase()) || s.nama.toLowerCase().includes(namaLower));
  if (byNama) return { nama: byNama.nama, peran: byNama.peran };

  return { nama, peran: 'Sales' };
}

export const bolehLihatSemua = (peran: string) => ['Manager', 'Direktur', 'Admin', 'Admin Sistem'].includes(peran);
export const bolehUbahSemua = (peran: string) => ['Manager', 'Direktur', 'Admin Sistem'].includes(peran);
export const bolehKelolaMaster = (peran: string) => ['Manager', 'Direktur', 'Admin Sistem'].includes(peran);
