// ============================================================
//  PRATINJAU PO PABRIK — dokumen di layar sebelum dicetak.
//
//  Sebelumnya PO hanya punya tombol "Cetak PO" yang langsung membuka
//  dialog print, jadi tidak ada kesempatan memeriksa dokumen dulu.
//  SPH & SPK sudah punya halaman pratinjau; halaman ini menyamakan
//  PO dengan keduanya.
//
//  Dokumen dirender di dalam <iframe srcDoc> supaya gaya A4 milik
//  dokumen (GAYA di survey-cetak.ts) tidak bertabrakan dengan gaya
//  aplikasi. Gambar berjalur relatif seperti /logo.png tetap
//  termuat karena srcDoc mewarisi alamat halaman induk.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, AlertTriangle } from 'lucide-react';
import { poApi, type BalikanPoDetail } from '@/lib/survey-api';
import { htmlPo } from '@/lib/survey-cetak';

// 210mm x 297mm pada 96dpi
const LEBAR_A4 = 794;
const TINGGI_A4 = 1123;

export default function PoPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [d, setD] = useState<BalikanPoDetail | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [siap, setSiap] = useState(false);

  const muat = useCallback(async () => {
    if (!id) return;
    setMemuat(true);
    try {
      setD(await poApi.ambil(id));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat PO');
    } finally { setMemuat(false); }
  }, [id]);

  useEffect(() => { muat(); }, [muat]);

  // Perkecil dokumen di layar sempit supaya tidak perlu menggeser ke samping
  useEffect(() => {
    const hitung = () => setScale(window.innerWidth < 900 ? Math.min(1, (window.innerWidth - 24) / LEBAR_A4) : 1);
    hitung();
    window.addEventListener('resize', hitung);
    return () => window.removeEventListener('resize', hitung);
  }, []);

  if (memuat) return <div className="p-8 text-center text-muted-foreground">Memuat pratinjau…</div>;
  if (galat || !d) return <div className="p-8 text-center text-muted-foreground">{galat || 'PO tidak ditemukan.'}</div>;

  const po = d.data;
  const html = htmlPo(po, d.revisi);
  const jmlHalaman = (html.match(/class="page/g) || []).length || 1;
  const tinggiAsli = jmlHalaman * TINGGI_A4;

  const cetak = () => {
    const frame = document.getElementById('po-preview-frame') as HTMLIFrameElement | null;
    const win = frame?.contentWindow;
    if (!win) { window.alert('Pratinjau belum siap. Coba lagi sesaat.'); return; }
    win.focus();
    win.print();
  };

  return (
    <div style={{ overflowX: 'hidden', width: '100%' }}>
      <div className="flex items-center gap-2 mb-3 px-1 no-print">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-base font-bold text-foreground flex-1 truncate">
          Preview PO <span className="font-mono font-normal text-sm">{po.no_po || '—'}</span>
        </h1>
        <Button onClick={cetak} size="sm" disabled={!siap} className="gap-1.5 shrink-0 text-xs px-3">
          <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cetak / </span>PDF
        </Button>
      </div>

      {po.rev_terakhir === 0 && (
        <div className="flex items-start gap-2 p-3 mb-3 mx-1 rounded-md border border-amber-200 bg-amber-50 text-sm no-print">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
          <span>
            PO ini <strong>belum diterbitkan</strong>, jadi bagian data teknis acuan pabrik masih kosong.
            Dokumen akan lengkap setelah PO terbit.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', overflowX: 'hidden', width: '100%' }}>
        <div
          style={scale < 1 ? {
            transformOrigin: 'top center',
            transform: `scale(${scale})`,
            marginBottom: `${(scale - 1) * tinggiAsli}px`,
            width: LEBAR_A4,
            flexShrink: 0,
          } : undefined}
        >
          <iframe
            id="po-preview-frame"
            title="Pratinjau PO Pabrik"
            srcDoc={html}
            onLoad={() => setSiap(true)}
            style={{
              width: LEBAR_A4,
              height: tinggiAsli,
              border: 'none',
              background: '#fff',
              boxShadow: '0 2px 18px rgba(89,34,3,.16)',
              display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  );
}
