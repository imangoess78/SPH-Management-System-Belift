import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { api, type RefSales } from '@/lib/crm-api';
import { tentukanPeran, bolehLihatSemua, bolehUbahSemua, bolehKelolaMaster } from '@/lib/crm-akses';

/**
 * Siapa yang sedang login di modul CRM, dan apa hak aksesnya.
 * Peran diambil dari crm_ref_sales (cocokkan email lalu nama).
 */
export function useCrmUser() {
  const { user, fullName } = useAuth();
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

  const { nama, peran } = tentukanPeran(
    { full_name: fullName, email: user?.email ?? null },
    daftarSales,
    user?.email ?? null,
  );

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
