// ============================================================
//  PRATINJAU SURVEY — Survey Sales & Final Survey
//
//  Sebelumnya kedua survey hanya punya tombol "Cetak" yang langsung
//  membuka dialog print. Halaman ini menampilkan dokumennya dulu di
//  layar, sama seperti pratinjau SPH/SPK dan PO Pabrik.
//
//  Isi dokumen diambil dari server (surveyApi.ambil) lalu disusun
//  lewat htmlSurvey() — fungsi yang sama yang dipakai tombol Cetak,
//  jadi yang dilihat di layar sama persis dengan yang tercetak.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, Lock } from 'lucide-react';
import { surveyApi } from '@/lib/survey-api';
import { htmlSurvey, type BahanCetakSurvey } from '@/lib/survey-cetak';
import { dtKosong, dokumentasiKosong, kesimpulanKosong, pekerjaanKosong } from '@/components/survey/SurveyPanels';
import type {
  DataTeknis, BarisDokumentasi, PekerjaanTambahan, ButirKesimpulan, TtdSurvey,
} from '@/lib/survey-types';

const LEBAR_A4 = 794;
const TINGGI_A4 = 1123;

/** Kolom JSON lama bisa berisi teks biasa — satu nilai bukan-array cukup
 *  untuk mematikan seluruh halaman. Samakan penjagaan dengan SurveyForm. */
function sebagaiArray<T>(nilai: unknown, kosong: () => T[]): T[] {
  return Array.isArray(nilai) && nilai.length ? (nilai as T[]) : kosong();
}

export default function SurveyPreview({ jenis }: { jenis: 'sales' | 'final' }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bahan, setBahan] = useState<BahanCetakSurvey | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [siap, setSiap] = useState(false);

  const final = jenis === 'final';

  const muat = useCallback(async () => {
    if (!id) return;
    setMemuat(true);
    try {
      const r = await surveyApi.ambil(id);
      const d = r.data;
      const tgl = String(d.tgl_survey || '').slice(0, 10);
      setBahan({
        jenis,
        judul: final ? 'Final Survey' : 'Survey Sales',
        noSurvey: String(d.no_survey || ''),
        tgl,
        kodeProyek: String(d.kode_proyek || ''),
        namaProspek: String(d.nama_prospek || '—'),
        kodeLead: String(d.kode_lead || '—'),
        surveyor: String(d.surveyor || ''),
        pjLapangan: String(d.pj_lapangan || ''),
        pjTelp: String(d.pj_telp || ''),
        jamKerja: String(d.jam_kerja || ''),
        dt: { ...dtKosong(), ...((d.dt as DataTeknis) || {}) },
        dokumentasi: sebagaiArray<BarisDokumentasi>(d.dokumentasi, dokumentasiKosong),
        pekerjaan: sebagaiArray<PekerjaanTambahan>(d.pekerjaan_tambahan, pekerjaanKosong),
        kesimpulan: sebagaiArray<ButirKesimpulan>(d.kesimpulan, kesimpulanKosong),
        ttd: (d.ttd as TtdSurvey) || { sales: '', customer: '', surveyor: '' },
        catatanLapangan: String(d.catatan_lapangan || ''),
        videoLink: String(d.video_link || ''),
        dikunciOleh: d.dikunci_oleh,
        dikunciPada: d.dikunci_pada,
      });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat survey');
    } finally { setMemuat(false); }
  }, [id, jenis, final]);

  useEffect(() => { muat(); }, [muat]);

  useEffect(() => {
    const hitung = () => setScale(window.innerWidth < 900 ? Math.min(1, (window.innerWidth - 24) / LEBAR_A4) : 1);
    hitung();
    window.addEventListener('resize', hitung);
    return () => window.removeEventListener('resize', hitung);
  }, []);

  if (memuat) return <div className="p-8 text-center text-muted-foreground">Memuat pratinjau…</div>;
  if (galat || !bahan) return <div className="p-8 text-center text-muted-foreground">{galat || 'Survey tidak ditemukan.'}</div>;

  const html = htmlSurvey(bahan);
  const jmlHalaman = (html.match(/class="page/g) || []).length || 1;
  const tinggiAsli = jmlHalaman * TINGGI_A4;

  const cetak = () => {
    const frame = document.getElementById('survey-preview-frame') as HTMLIFrameElement | null;
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
          Preview {bahan.judul}{' '}
          <span className="font-mono font-normal text-sm">{bahan.noSurvey || '—'}</span>
        </h1>
        <Button onClick={cetak} size="sm" disabled={!siap} className="gap-1.5 shrink-0 text-xs px-3">
          <Printer className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cetak / </span>PDF
        </Button>
      </div>

      <p className="text-xs text-muted-foreground px-2 mb-3 no-print">
        {bahan.kodeLead} · {bahan.namaProspek}
        {bahan.kodeProyek && <> · <span className="font-mono">{bahan.kodeProyek}</span></>}
        {final && bahan.dikunciOleh && (
          <span className="inline-flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-semibold">
            <Lock className="w-3 h-3" /> Dikunci {bahan.dikunciOleh}
          </span>
        )}
      </p>

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
            id="survey-preview-frame"
            title={`Pratinjau ${bahan.judul}`}
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
