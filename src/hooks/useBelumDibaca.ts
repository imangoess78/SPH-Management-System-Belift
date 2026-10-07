import { useCallback, useEffect, useState } from 'react';

/**
 * Jumlah pemberitahuan yang belum dibaca, untuk lencana di menu.
 *
 * Sengaja TIDAK memakai React Query: lencana perlu menyegar sendiri tanpa
 * membuat pengguna menekan apa pun, dan poling ringan 60 detik jauh lebih
 * murah daripada membangun kanal langsung. Bila permintaannya gagal, lencana
 * disembunyikan (null) dan tidak dianggap nol — nol berarti "sudah dibaca
 * semua", dan menampilkan itu saat jaringan bermasalah akan menyesatkan.
 */
export function useBelumDibaca(selangMs = 60_000) {
  const [jumlah, setJumlah] = useState<number | null>(null);

  const ambil = useCallback(async () => {
    try {
      const r = await fetch('/api/notifikasi?jumlah=1', { credentials: 'include' });
      if (!r.ok) return;
      const j = await r.json();
      // API membalas `{ jumlah: n }` untuk mode hitung-cepat ini.
      if (typeof j.jumlah === 'number') setJumlah(j.jumlah);
    } catch {
      // Diamkan: lencana bukan hal yang layak mengganggu layar dengan galat.
    }
  }, []);

  useEffect(() => {
    void ambil();
    const t = setInterval(() => void ambil(), selangMs);
    // Menyegarkan begitu tab dilihat lagi — orang yang baru kembali ke
    // jendela ini paling mungkin sedang menunggu kabar terbaru.
    const saatTerlihat = () => { if (document.visibilityState === 'visible') void ambil(); };
    document.addEventListener('visibilitychange', saatTerlihat);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', saatTerlihat); };
  }, [ambil, selangMs]);

  return { jumlah, segarkan: ambil };
}
