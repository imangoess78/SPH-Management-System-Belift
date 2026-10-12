import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api, type RefSales } from '@/lib/crm-api';
import { tentukanPeran, bolehLihatSemua, bolehUbahSemua, bolehKelolaMaster } from '@/lib/crm-akses';

/**
 * Siapa yang sedang login di modul CRM, dan apa hak aksesnya.
 *
 * Peran wewenang (`peran`) DIAMBIL DARI SERVER lewat `peranMaster`, bukan
 * dihitung ulang di sini. Dulu nilainya dihitung di tampilan lewat
 * `tentukanPeran()` yang membaca `crm_ref_sales`; akun yang tidak punya izin
 * `crm` (mis. staff) tidak bisa memuat daftar itu, pencocokan gagal, peran
 * jatuh ke 'Sales', lalu tombol kunci Final Survey dan terbit PO HILANG padahal
 * server mengizinkan. Sekarang nilainya sama persis dengan yang diperiksa
 * `functions/api/survey.ts` dan `functions/api/po.ts`.
 *
 * `daftarSales` tetap dimuat dari Master CRM, tapi hanya untuk mengisi pilihan
 * penyaring di halaman CRM — bukan lagi untuk menentukan wewenang.
 */
export function useCrmUser() {
  const { user, fullName, namaSales: namaSalesServer, peranMaster } = useAuth();
  const [daftarSales, setDaftarSales] = useState<RefSales[]>([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    let aktif = true;
    api.meta()
      .then(m => { if (aktif) setDaftarSales(m.sales); })
      .catch(() => { if (aktif) setDaftarSales([]); })
      .finally(() => { if (aktif) setSiap(true); });
    return () => { aktif = false; };
  }, []);

  // Cadangan bila server belum mengirim `peranMaster` (mis. sesi lama yang
  // masih terbuka saat rilis). Hitungannya sengaja disamakan dengan server.
  const cadangan = useMemo(
    () => tentukanPeran({ full_name: fullName, email: user?.email ?? null }, daftarSales, user?.email ?? null),
    [fullName, user?.email, daftarSales],
  );

  const peran = peranMaster || cadangan.peran;
  // Nama untuk mencocokkan kepemilikan data (kolom `sales` pada leads). Server
  // sudah menyelesaikannya lewat email → `crm_ref_sales.nama`, lalu full_name.
  const nama = peranMaster
    ? (namaSalesServer || fullName || user?.email || 'Pengguna')
    : cadangan.nama;

  const bolehUbahSemuaSekarang = bolehUbahSemua(peran);

  // WAJIB useCallback: fungsi ini dipakai sebagai dependensi useEffect di
  // halaman-halaman CRM. Kalau referensinya berubah tiap render, efek akan
  // jalan tanpa henti dan halaman macet di status "Memuat…".
  const bolehUbahBaris = useCallback(
    (salesLead: string | null | undefined) => bolehUbahSemuaSekarang || salesLead === nama,
    [bolehUbahSemuaSekarang, nama],
  );

  return {
    nama, peran, siap,
    isSales: peran === 'Sales',
    bolehLihatSemua: bolehLihatSemua(peran),
    bolehUbahSemua: bolehUbahSemuaSekarang,
    bolehKelolaMaster: bolehKelolaMaster(peran),
    daftarSales,
    /** true kalau baris ini boleh diubah oleh pengguna saat ini */
    bolehUbahBaris,
  };
}
