import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft, Printer, History, CheckCircle2, Circle, AlertTriangle, Lock, Unlock,
  ArrowRight, FileText, Factory, GitCompare,
} from 'lucide-react';
import { surveyApi, bandingkanDt, type BalikanLacak } from '@/lib/survey-api';
import type { DataTeknis, TemuanDiff, SurveyRowTerurai, PoRow, PoRevisiRow, RiwayatRow } from '@/lib/survey-types';
import { fmtTglPendek, fmtWaktu, tahapLabel, TAHAP_URUT, warnaTingkat, lencanaTingkat, labelTingkat } from '@/lib/survey-utils';
import { cetakLacak } from '@/lib/survey-cetak';

const dtDari = (s: SurveyRowTerurai | null | undefined): DataTeknis | null =>
  (s?.dt as DataTeknis) || null;

const revDari = (r: PoRevisiRow | null | undefined): DataTeknis | null =>
  (r?.dt as DataTeknis) || null;

export default function SurveyLacak() {
  const { idLead } = useParams<{ idLead: string }>();
  const navigate = useNavigate();
  const [d, setD] = useState<BalikanLacak | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [sumber, setSumber] = useState('kontrak');
  const [pembanding, setPembanding] = useState('sekarang');

  const muat = useCallback(async () => {
    if (!idLead) return;
    setMemuat(true);
    try {
      setD(await surveyApi.lacak(idLead));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat lacak');
    } finally { setMemuat(false); }
  }, [idLead]);

  useEffect(() => { muat(); }, [muat]);

  // ── Titik-titik data yang bisa dibandingkan ──
  const titik = useMemo(() => {
    if (!d) return [] as { kunci: string; label: string; sub: string; dt: DataTeknis | null }[];
    const out: { kunci: string; label: string; sub: string; dt: DataTeknis | null }[] = [];
    const ss = d.survey_sales as SurveyRowTerurai | null;
    const fs = d.final_survey as SurveyRowTerurai | null;
    const po = d.po as (PoRow & { revisi?: PoRevisiRow[] }) | null;

    if (ss) out.push({ kunci: 'sales', label: 'Survey Sales', sub: fmtTglPendek(ss.tgl_survey), dt: dtDari(ss) });
    if (d.sph) out.push({
      kunci: 'kontrak', label: 'Kontrak / SPK',
      sub: String((d.sph as Record<string, unknown>).nomor_spk || (d.sph as Record<string, unknown>).nomor_sph || 'SPH'),
      dt: (() => {
        const raw = (d.sph as Record<string, unknown>).data_teknis;
        if (!raw) return null;
        try { return typeof raw === 'string' ? JSON.parse(raw) as DataTeknis : raw as DataTeknis; } catch { return null; }
      })(),
    });
    if (fs) out.push({ kunci: 'final', label: 'Final Survey', sub: fmtTglPendek(fs.tgl_survey), dt: dtDari(fs) });
    if (po) {
      const rev = (po.revisi || [])[0];
      out.push({ kunci: 'po', label: 'PO Pabrik (terakhir)', sub: rev ? `Rev ${rev.rev}` : 'Belum terbit', dt: revDari(rev) });
    }
    out.push({ kunci: 'sekarang', label: 'Data Kerja Sekarang', sub: fs?.terkunci ? 'dari Final Survey terkunci' : 'belum terkunci', dt: dtDari(fs) || dtDari(ss) });
    return out;
  }, [d]);

  const temuan: TemuanDiff[] = useMemo(() => {
    const a = titik.find(t => t.kunci === sumber)?.dt;
    const b = titik.find(t => t.kunci === pembanding)?.dt;
    if (!a && !b) return [];
    const arah = (sumber === 'kontrak' || pembanding === 'final') ? 'kontrak→final' : 'final→po';
    return bandingkanDt(a, b, arah);
  }, [titik, sumber, pembanding]);

  const kritis = temuan.filter(t => t.tingkat === 'kritis').length;
  const perhatian = temuan.filter(t => t.tingkat === 'perhatian').length;

  if (memuat) return <div className="p-8 text-center text-muted-foreground">Memuat…</div>;
  if (!d) return <div className="p-8 text-center text-muted-foreground">Data tidak ditemukan.</div>;

  const lead = d.lead as Record<string, unknown>;
  const ada = (k: string) => titik.find(t => t.kunci === k);

  return (
    <div className="space-y-4">
      {/* ── Kepala ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Kembali
          </Button>
          <h1 className="text-xl font-bold">Lacak Perubahan Data Teknis</h1>
          <p className="text-sm text-muted-foreground">
            {String(lead.kode_lead || '—')} · {String(lead.nama_prospek || '—')}
            {d.proyek?.kode_proyek && <> · <span className="font-mono">{d.proyek.kode_proyek}</span></>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => cetakLacak({
          namaProspek: String(lead.nama_prospek || ''), kodeLead: String(lead.kode_lead || ''),
          kodeProyek: d.proyek?.kode_proyek || null,
          titik: titik.map(t => ({ label: t.label, sub: t.sub })),
          temuan, sumber: titik.find(t => t.kunci === sumber)?.label || sumber,
          pembanding: titik.find(t => t.kunci === pembanding)?.label || pembanding,
        })}>
          <Printer className="w-4 h-4 mr-1.5" /> Cetak lacak
        </Button>
      </div>

      {/* ── Rantai tahap ── */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Alur 5 Tahap</h2>
        <div className="flex flex-wrap items-center gap-2">
          {[
            { k: 'SURVEY_SALES', nama: 'Survey Sales', ok: !!ada('sales'), ket: ada('sales')?.sub },
            { k: 'KONTRAK', nama: 'Kontrak', ok: !!d.sph, ket: d.sph ? fmtTglPendek(String((d.sph as Record<string, unknown>).tanggal)) : undefined },
            { k: 'FINAL_SURVEY', nama: 'Final Survey', ok: !!(d.final_survey as SurveyRowTerurai | null)?.terkunci, ket: d.final_survey ? fmtTglPendek((d.final_survey as SurveyRowTerurai).tgl_survey) : undefined },
            { k: 'PO', nama: 'PO Pabrik', ok: !!(d.po as PoRow | null)?.rev_terakhir, ket: (d.po as PoRow | null)?.no_po || undefined },
          ].map((t, i, arr) => (
            <div key={t.k} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
                t.ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground'}`}>
                {t.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                {t.nama}
                {t.ket && <span className="opacity-70 font-normal">{t.ket}</span>}
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          ))}
          <span className="text-xs text-muted-foreground ml-1">Tahap sekarang: <strong>{tahapLabel(d.proyek?.tahap_sekarang)}</strong></span>
        </div>
      </Card>

      {/* ── Mesin pembanding ── */}
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <GitCompare className="w-4 h-4" /> Bandingkan Data Teknis
        </h2>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] items-center">
          <Select value={sumber} onValueChange={setSumber}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {titik.filter(t => t.dt).map(t => (
                <SelectItem key={t.kunci} value={t.kunci}>{t.label} — {t.sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-center text-xs text-muted-foreground">dibandingkan dengan</span>
          <Select value={pembanding} onValueChange={setPembanding}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {titik.filter(t => t.dt).map(t => (
                <SelectItem key={t.kunci} value={t.kunci}>{t.label} — {t.sub}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
            {kritis} perubahan setelah Final Survey (kritis)
          </span>
          <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            {perhatian} perubahan setelah kontrak
          </span>
          <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground">
            {temuan.length} total perbedaan
          </span>
        </div>

        {temuan.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-md border border-green-200 bg-green-50 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span>Tidak ada perbedaan antara <strong>{titik.find(t => t.kunci === sumber)?.label}</strong> dan <strong>{titik.find(t => t.kunci === pembanding)?.label}</strong>.</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {temuan.map((t, i) => (
              <div key={i} className={`p-2.5 rounded-md ${warnaTingkat[t.tingkat]}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="text-sm">{t.label}</strong>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${lencanaTingkat[t.tingkat]}`}>
                    {labelTingkat[t.tingkat]}
                  </span>
                </div>
                <div className="text-xs font-mono mt-1">
                  <span className="text-muted-foreground line-through">{t.teks.split(' → ')[0]}</span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="font-semibold">{t.teks.split(' → ').slice(1).join(' → ')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Dokumen kunci ── */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Survey Sales
          </h3>
          {ada('sales') ? (
            <div className="text-xs space-y-1">
              <p>No: <span className="font-mono">{(d.survey_sales as SurveyRowTerurai)?.no_survey || '—'}</span></p>
              <p>Tanggal: {fmtTglPendek((d.survey_sales as SurveyRowTerurai)?.tgl_survey)}</p>
              <p>Oleh: {(d.survey_sales as SurveyRowTerurai)?.disurvey_oleh || '—'}</p>
              <Button size="sm" variant="link" className="px-0"
                onClick={() => navigate(`/survey/sales/${(d.survey_sales as SurveyRowTerurai).id}`)}>Buka survey</Button>
            </div>
          ) : <p className="text-xs text-muted-foreground">Belum ada Survey Sales.</p>}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            {(d.final_survey as SurveyRowTerurai)?.terkunci ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />} Final Survey
          </h3>
          {d.final_survey ? (
            <div className="text-xs space-y-1">
              <p>No: <span className="font-mono">{(d.final_survey as SurveyRowTerurai).no_survey || '—'}</span></p>
              <p>Tanggal: {fmtTglPendek((d.final_survey as SurveyRowTerurai).tgl_survey)}</p>
              <p>Surveyor: {(d.final_survey as SurveyRowTerurai).surveyor || '—'}</p>
              <p>Status: {(d.final_survey as SurveyRowTerurai).terkunci
                ? <span className="text-green-700 font-medium">Terkunci {fmtTglPendek((d.final_survey as SurveyRowTerurai).dikunci_pada)}</span>
                : <span className="text-amber-700 font-medium">Belum dikunci</span>}</p>
              <Button size="sm" variant="link" className="px-0"
                onClick={() => navigate(`/survey/final/${(d.final_survey as SurveyRowTerurai).id}`)}>Buka final survey</Button>
            </div>
          ) : <p className="text-xs text-muted-foreground">Belum ada Final Survey.</p>}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
            <Factory className="w-4 h-4" /> PO Pabrik
          </h3>
          {d.po ? (
            <div className="text-xs space-y-1">
              <p>No: <span className="font-mono">{(d.po as PoRow).no_po || '—'}</span></p>
              <p>Pabrik: {(d.po as PoRow).pabrik || '—'}</p>
              <p>Revisi: {(d.po as PoRow).rev_terakhir || 0}</p>
              <p>Status: {(d.po as PoRow).status || '—'}</p>
              <Button size="sm" variant="link" className="px-0"
                onClick={() => navigate(`/po/${(d.po as PoRow).id}`)}>Buka PO</Button>
            </div>
          ) : <p className="text-xs text-muted-foreground">PO belum diterbitkan.</p>}
        </Card>
      </div>

      {/* ── Riwayat ── */}
      {d.riwayat.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <History className="w-4 h-4" /> Riwayat Perubahan
          </h2>
          <div className="space-y-1.5">
            {d.riwayat.map((r: RiwayatRow) => (
              <div key={r.id} className="flex flex-wrap items-baseline gap-2 text-xs py-1.5 border-b last:border-0">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  r.jenis === 'po' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                  {r.jenis === 'po' ? 'PO' : 'Survey'}
                </span>
                <span className="font-medium">{r.aksi}</span>
                <span className="text-muted-foreground">oleh {r.oleh || '—'}</span>
                <span className="text-muted-foreground">{fmtWaktu(r.waktu)}</span>
                {r.catatan && <span className="text-muted-foreground">· {r.catatan}</span>}
                {r.alasan && <span className="italic text-muted-foreground">— {r.alasan}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Peringatan ── */}
      {kritis > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-rose-200 bg-rose-50 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" />
          <span>
            Ada <strong>{kritis} perubahan setelah Final Survey dikunci</strong>.
            Perubahan ini sebaiknya disertai revisi PO supaya pabrik memakai data terbaru.
          </span>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Membandingkan: <strong>{titik.find(t => t.kunci === sumber)?.label}</strong> → <strong>{titik.find(t => t.kunci === pembanding)?.label}</strong>
        {' '}· Urutan tahap baku: {TAHAP_URUT.map(t => tahapLabel(t)).join(' → ')}
      </p>
    </div>
  );
}
