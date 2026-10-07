import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCheck, Info, AlertTriangle, CheckCircle2, Inbox } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useBelumDibaca } from '@/hooks/useBelumDibaca';

interface Notif {
  id: string;
  jenis: string;
  judul: string;
  pesan: string | null;
  tautan: string | null;
  oleh_nama: string | null;
  tingkat: string;
  created_at: string;
  dibaca: boolean;
}

/**
 * Tanda tingkat pemberitahuan. `peringatan` sengaja memakai warna hangat dan
 * bukan merah: ini bukan galat, hanya hal yang perlu dilihat lebih dulu
 * (mis. Final Survey dibuka kembali setelah PO terbit).
 */
const TINGKAT: Record<string, { kelas: string; Ikon: typeof Info }> = {
  info: { kelas: 'bg-sky-50 text-sky-700 border-sky-200', Ikon: Info },
  sukses: { kelas: 'bg-green-50 text-green-700 border-green-200', Ikon: CheckCircle2 },
  peringatan: { kelas: 'bg-amber-50 text-amber-700 border-amber-200', Ikon: AlertTriangle },
};

/** 'baru saja', '12 menit lalu', '3 hari lalu' — tanpa pustaka tambahan. */
function waktuRelatif(iso: string): string {
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60) return 'baru saja';
  const menit = Math.floor(detik / 60);
  if (menit < 60) return `${menit} menit lalu`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam lalu`;
  const hari = Math.floor(jam / 24);
  if (hari < 30) return `${hari} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Notifikasi() {
  const { segarkan } = useBelumDibaca();
  const [daftar, setDaftar] = useState<Notif[]>([]);
  // Jumlah belum dibaca dari SERVER, bukan hasil menghitung `daftar`.
  // Daftar dibatasi 50 baris, jadi menghitung sendiri akan melaporkan
  // angka yang lebih kecil dari kenyataan begitu pemberitahuan menumpuk.
  const [totalBelum, setTotalBelum] = useState(0);
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  // Penyaring tampilan: orang yang punya banyak pemberitahuan hampir selalu
  // hanya peduli pada yang belum dibaca.
  const [hanyaBelumDibaca, setHanyaBelumDibaca] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await fetch('/api/notifikasi', { credentials: 'include' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setDaftar(j.daftar || []);
      setTotalBelum(j.jumlahBelumDibaca || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat notifikasi');
    } finally { setMemuat(false); }
  }, []);

  useEffect(() => { void muat(); }, [muat]);

  const tandai = async (notif: Notif) => {
    if (notif.dibaca) return;
    // Perubahan tampilan didahulukan supaya terasa langsung; kalau server
    // menolak, daftar dimuat ulang dan tampilan kembali jujur.
    setDaftar(prev => prev.map(n => n.id === notif.id ? { ...n, dibaca: true } : n));
    setTotalBelum(n => Math.max(0, n - 1));
    try {
      const r = await fetch('/api/notifikasi', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notif.id }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      void segarkan();
    } catch (e) {
      toast.error('Gagal menandai sudah dibaca');
      void muat();
    }
  };

  const tandaiSemua = async () => {
    // Patokannya `totalBelum` (angka server), bukan isi `daftar` yang
    // terbatas 50 baris — server menandai SEMUA yang belum dibaca, jadi
    // pesan ke pengguna harus menyebut jumlah yang sama.
    if (!totalBelum) return;
    const jml = totalBelum;
    setSibuk(true);
    setDaftar(prev => prev.map(n => ({ ...n, dibaca: true })));
    setTotalBelum(0);
    try {
      const r = await fetch('/api/notifikasi', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      toast.success(`${jml} notifikasi ditandai sudah dibaca`);
      void segarkan();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menandai semua');
      void muat();
    } finally { setSibuk(false); }
  };

  const tampil = hanyaBelumDibaca ? daftar.filter(n => !n.dibaca) : daftar;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5" /> Notifikasi
          </h1>
          <p className="text-sm text-muted-foreground">
            {totalBelum ? `${totalBelum} belum dibaca.` : 'Semua pemberitahuan sudah dibaca.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant={hanyaBelumDibaca ? 'default' : 'outline'} size="sm"
            onClick={() => setHanyaBelumDibaca(v => !v)}>
            {hanyaBelumDibaca ? 'Tampilkan semua' : 'Hanya belum dibaca'}
          </Button>
          <Button variant="outline" size="sm" onClick={tandaiSemua} disabled={sibuk || !totalBelum}>
            <CheckCheck className="w-4 h-4 mr-1" /> Tandai semua dibaca
          </Button>
        </div>
      </div>

      {memuat ? (
        <Card className="p-6 text-sm text-muted-foreground">Memuat…</Card>
      ) : !tampil.length ? (
        <Card className="p-10 text-center">
          <Inbox className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {hanyaBelumDibaca ? 'Tidak ada notifikasi yang belum dibaca.' : 'Belum ada notifikasi untuk Anda.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {tampil.map(n => {
            const gaya = TINGKAT[n.tingkat] || TINGKAT.info;
            const { Ikon } = gaya;
            const isi = (
              <Card className={`p-4 transition-colors ${n.dibaca ? '' : 'border-l-4 border-l-primary bg-primary/[0.03]'}`}>
                <div className="flex gap-3">
                  <span className={`mt-0.5 shrink-0 rounded-full border p-1.5 ${gaya.kelas}`}>
                    <Ikon className="w-3.5 h-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm ${n.dibaca ? 'font-medium' : 'font-semibold'}`}>{n.judul}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {waktuRelatif(n.created_at)}
                      </span>
                    </div>
                    {n.pesan && <p className="text-sm text-muted-foreground mt-0.5">{n.pesan}</p>}
                  </div>
                </div>
              </Card>
            );

            // Notifikasi bertaut dibungkus <Link> supaya membukanya sekaligus
            // menandainya terbaca — satu gerakan, bukan dua.
            return n.tautan ? (
              <Link key={n.id} to={n.tautan} className="block hover:opacity-90"
                onClick={() => void tandai(n)}>
                {isi}
              </Link>
            ) : (
              <button key={n.id} type="button" className="block w-full text-left"
                onClick={() => void tandai(n)}>
                {isi}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
