import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  ArrowLeft, Save, Lock, Unlock, Printer, Copy, AlertTriangle, CheckCircle2, Eye,
  ClipboardCheck, History, Ban,
} from 'lucide-react';
import { surveyApi } from '@/lib/survey-api';
import { useCrmUser } from '@/hooks/useCrmUser';
import { bolehIsiSurvey, bolehIsiFinal, bolehKunciFinal } from '@/lib/crm-akses';
import {
  DT_FIELDS, FIELD_WAJIB_KUNCI, KELOMPOK_FIELD,
  type DataTeknis, type Lantai, type AddOn, type BarisDokumentasi,
  type PekerjaanTambahan, type ButirKesimpulan, type TtdSurvey, type RiwayatRow,
} from '@/lib/survey-types';
import {
  DataTeknisPanel, LantaiPanel, AddOnPanel, DokumentasiPanel, PekerjaanPanel, KesimpulanPanel,
  dtKosong, dokumentasiKosong, kesimpulanKosong, pekerjaanKosong, bacaTeks, bacaLantai, bacaAddon,
} from '@/components/survey/SurveyPanels';
import { cetakSurvey, salinRingkasSurvey } from '@/lib/survey-cetak';

const TAB = ['Data Teknis', 'Lantai', 'Add-on', 'Dokumentasi', 'Pekerjaan Tambahan', 'Kesimpulan & Catatan'] as const;
type Tab = typeof TAB[number];

const hariIni = () => new Date().toISOString().slice(0, 10);

/**
 * Ambil kolom JSON dari server sebagai array dengan aman.
 * Nilai bisa datang sebagai null, teks biasa, atau bentuk lama yang bukan
 * array — satu nilai seperti itu cukup membuat `.filter()` meledak dan
 * mematikan seluruh halaman. Selalu jatuh ke bentuk kosong.
 */
function sebagaiArray<T>(nilai: unknown, kosong: () => T[]): T[] {
  if (Array.isArray(nilai)) return nilai as T[];
  if (typeof nilai === 'string') {
    try {
      const u = JSON.parse(nilai);
      if (Array.isArray(u)) return u as T[];
    } catch { /* teks biasa — pakai bentuk kosong */ }
  }
  return kosong();
}

export default function SurveyForm({ jenis }: { jenis: 'sales' | 'final' }) {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { nama, peran } = useCrmUser();

  const final = jenis === 'final';
  const [tab, setTab] = useState<Tab>('Data Teknis');
  const [memuat, setMemuat] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);

  // Kepala form
  const [idLead, setIdLead] = useState('');
  const [kodeProyek, setKodeProyek] = useState('');
  const [noSurvey, setNoSurvey] = useState('');
  const [tgl, setTgl] = useState(hariIni());
  const [surveyor, setSurveyor] = useState('');
  const [pjLapangan, setPjLapangan] = useState('');
  const [pjTelp, setPjTelp] = useState('');
  const [jamKerja, setJamKerja] = useState('');

  // Isi survey
  const [dt, setDt] = useState<DataTeknis>(dtKosong);
  const [dokumentasi, setDokumentasi] = useState<BarisDokumentasi[]>(dokumentasiKosong);
  const [videoLink, setVideoLink] = useState('');
  const [pekerjaan, setPekerjaan] = useState<PekerjaanTambahan[]>(pekerjaanKosong);
  const [catatanLapangan, setCatatanLapangan] = useState('');
  const [catatanDesain, setCatatanDesain] = useState('');
  const [kesimpulan, setKesimpulan] = useState<ButirKesimpulan[]>(kesimpulanKosong);
  const [ttd, setTtd] = useState<TtdSurvey>({ sales: '', customer: '', surveyor: '' });

  // Pengesahan
  const [terkunci, setTerkunci] = useState(false);
  const [dikunciOleh, setDikunciOleh] = useState<string | null>(null);
  const [dikunciPada, setDikunciPada] = useState<string | null>(null);
  const [riwayat, setRiwayat] = useState<RiwayatRow[]>([]);
  const [infoLead, setInfoLead] = useState<Record<string, unknown> | null>(null);

  const bolehIsi = final ? bolehIsiFinal(peran) : bolehIsiSurvey(peran);
  const bolehKunci = final && bolehKunciFinal(peran);
  const [bacaSaja, setBacaSaja] = useState(false);

  // ── Muat ──────────────────────────────────────────────────
  useEffect(() => {
    let aktif = true;
    (async () => {
      setMemuat(true);
      try {
        if (id) {
          const r = await surveyApi.ambil(id);
          if (!aktif) return;
          const d = r.data;
          setIdLead(String(d.id_lead || ''));
          setKodeProyek(String(d.kode_proyek || ''));
          setNoSurvey(String(d.no_survey || ''));
          setTgl(String(d.tgl_survey || hariIni()).slice(0, 10));
          setSurveyor(String(d.surveyor || ''));
          setPjLapangan(String(d.pj_lapangan || ''));
          setPjTelp(String(d.pj_telp || ''));
          setJamKerja(String(d.jam_kerja || ''));
          setDt({ ...dtKosong(), ...(d.dt as DataTeknis || {}) });
          // Server sudah mengirim bentuk kosong yang benar, tapi kita tetap
          // berjaga: kolom JSON lama bisa saja berisi teks biasa, dan satu
          // nilai bukan-array saja cukup untuk mematikan seluruh halaman.
          setDokumentasi(sebagaiArray<BarisDokumentasi>(d.dokumentasi, dokumentasiKosong));
          setVideoLink(String(d.video_link || ''));
          setPekerjaan(sebagaiArray<PekerjaanTambahan>(d.pekerjaan_tambahan, pekerjaanKosong));
          setCatatanLapangan(String(d.catatan_lapangan || ''));
          setCatatanDesain(String(d.catatan_desain || ''));
          setKesimpulan(sebagaiArray<ButirKesimpulan>(d.kesimpulan, kesimpulanKosong));
          setTtd((d.ttd as TtdSurvey) || { sales: '', customer: '', surveyor: '' });
          setTerkunci(!!d.terkunci);
          setDikunciOleh(d.dikunci_oleh);
          setDikunciPada(d.dikunci_pada);
          setRiwayat(r.riwayat || []);
          setInfoLead(d as unknown as Record<string, unknown>);
        } else {
          const lead = sp.get('lead');
          if (!lead) { toast.error('Lead tidak dipilih'); navigate(final ? '/survey/final' : '/survey/sales'); return; }
          const buat = await surveyApi.buat({
            id_lead: lead, jenis, tgl_survey: hariIni(),
            surveyor: final ? (peran === 'Surveyor' ? nama : '') : undefined,
            disurvey_oleh: final ? undefined : nama,
          });
          navigate(`/${final ? 'survey/final' : 'survey/sales'}/${buat.id}`, { replace: true });
          return;
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal memuat survey');
        navigate(final ? '/survey/final' : '/survey/sales');
      } finally { if (aktif) setMemuat(false); }
    })();
    return () => { aktif = false; };
    // sengaja: hanya saat id/jenis berubah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, jenis]);

  // Hak ubah: terkunci → semua baca saja; Final Survey → hanya Surveyor/Manager/Direktur
  useEffect(() => { setBacaSaja(terkunci || !bolehIsi); }, [terkunci, bolehIsi]);

  // ── Kelengkapan ───────────────────────────────────────────
  const wajibKosong = useMemo(
    () => FIELD_WAJIB_KUNCI.filter(k => !bacaTeks(dt, k).trim()),
    [dt],
  );
  const terisi = useMemo(
    () => DT_FIELDS.filter(f => bacaTeks(dt, f.key).trim()).length,
    [dt],
  );
  const persen = Math.round((terisi / DT_FIELDS.length) * 100);

  // ── Simpan ────────────────────────────────────────────────
  const kumpulkan = useCallback(() => ({
    id_lead: idLead, jenis, tgl_survey: tgl,
    surveyor: surveyor || null, pj_lapangan: pjLapangan || null,
    pj_telp: pjTelp || null, jam_kerja: jamKerja || null,
    dt, dokumentasi, video_link: videoLink || null,
    pekerjaan_tambahan: pekerjaan, catatan_lapangan: catatanLapangan || null,
    catatan_desain: catatanDesain || null, kesimpulan, ttd,
  }), [idLead, jenis, tgl, surveyor, pjLapangan, pjTelp, jamKerja, dt, dokumentasi,
    videoLink, pekerjaan, catatanLapangan, catatanDesain, kesimpulan, ttd]);

  const simpan = async (diam = false) => {
    if (!id) return;
    setMenyimpan(true);
    try {
      await surveyApi.ubah(id, kumpulkan());
      if (!diam) toast.success('Survey tersimpan');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan');
    } finally { setMenyimpan(false); }
  };

  const kunci = async () => {
    if (!id) return;
    if (wajibKosong.length) {
      toast.error(`${wajibKosong.length} field wajib belum diisi. Lihat tanda ⚠ di tab Data Teknis.`);
      setTab('Data Teknis');
      return;
    }
    if (!confirm('Kunci Final Survey? Setelah dikunci, data tidak bisa diubah tanpa membuka kunci (tercatat).')) return;
    try {
      await simpan(true);
      await surveyApi.kunci(id);
      toast.success('Final Survey terkunci');
      const r = await surveyApi.ambil(id);
      setTerkunci(true); setDikunciOleh(r.data.dikunci_oleh); setDikunciPada(r.data.dikunci_pada);
      setRiwayat(r.riwayat || []);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal mengunci'); }
  };

  const bukaKunci = async () => {
    if (!id) return;
    const alasan = prompt('Alasan membuka kunci (wajib, tercatat di riwayat):');
    if (!alasan?.trim()) return;
    try {
      await surveyApi.bukaKunci(id, alasan.trim());
      toast.success('Kunci dibuka — perubahan tercatat');
      const r = await surveyApi.ambil(id);
      setTerkunci(false); setRiwayat(r.riwayat || []);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal membuka kunci'); }
  };

  if (memuat) return <div className="p-8 text-center text-muted-foreground">Memuat…</div>;

  const judul = final ? 'Final Survey' : 'Survey Sales';
  const namaProspek = String(infoLead?.nama_prospek || '—');
  const kodeLead = String(infoLead?.kode_lead || '—');

  return (
    <div className="space-y-4">
      {/* ── Kepala ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-1"
            onClick={() => navigate(final ? '/survey/final' : '/survey/sales')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Daftar {judul}
          </Button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            {judul}
            {terkunci && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-[11px] font-semibold">
                <Lock className="w-3 h-3" /> Terkunci
              </span>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            {kodeLead} · {namaProspek}
            {kodeProyek && <> · <span className="font-mono">{kodeProyek}</span></>}
            {noSurvey && <> · <span className="font-mono">{noSurvey}</span></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm"
            onClick={() => navigate(`/${final ? 'survey/final' : 'survey/sales'}/${id}/preview`)}
            disabled={!id}>
            <Eye className="w-4 h-4 mr-1.5" /> Preview Dokumen
          </Button>
          <Button variant="outline" size="sm" onClick={() => cetakSurvey({
            jenis, judul, noSurvey, tgl, kodeProyek, namaProspek, kodeLead,
            surveyor, pjLapangan, pjTelp, jamKerja, dt, dokumentasi, pekerjaan, kesimpulan, ttd,
            catatanLapangan, videoLink, dikunciOleh, dikunciPada,
          })}>
            <Printer className="w-4 h-4 mr-1.5" /> Cetak
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            salinRingkasSurvey({
              jenis, noSurvey, tgl, kodeProyek, namaProspek, dt,
              addon: bacaAddon(dt), lantai: bacaLantai(dt),
            });
            toast.success('Tersalin — tempel di aplikasi KOM');
          }}>
            <Copy className="w-4 h-4 mr-1.5" /> Salin data ke KOM
          </Button>
          {!terkunci && bolehIsi && (
            <Button size="sm" onClick={() => simpan()} disabled={menyimpan}>
              <Save className="w-4 h-4 mr-1.5" /> {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </Button>
          )}
          {final && !terkunci && bolehKunci && (
            <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700" onClick={kunci}>
              <Lock className="w-4 h-4 mr-1.5" /> Kunci Final Survey
            </Button>
          )}
          {final && terkunci && bolehKunci && (
            <Button size="sm" variant="outline" onClick={bukaKunci}>
              <Unlock className="w-4 h-4 mr-1.5" /> Buka kunci
            </Button>
          )}
        </div>
      </div>

      {/* ── Bilah keadaan ── */}
      {!bolehIsi && !terkunci && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-slate-200 bg-slate-50 text-sm">
          <Ban className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
          <span>Peran <strong>{peran}</strong> hanya dapat melihat {judul}. Yang mengisi: {final ? 'Surveyor' : 'Sales pemilik lead'}.</span>
        </div>
      )}
      {terkunci && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-green-200 bg-green-50 text-sm">
          <CheckCircle2 className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
          <span>
            <strong>Final Survey terkunci</strong> oleh {dikunciOleh || '—'} pada{' '}
            {dikunciPada ? new Date(dikunciPada).toLocaleString('id-ID') : '—'}.
            {' '}Data tidak dapat diubah tanpa membuka kunci.
          </span>
        </div>
      )}
      {final && !terkunci && wajibKosong.length > 0 && bolehKunci && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
          <span>
            <strong>{wajibKosong.length} field wajib belum diisi.</strong> Final Survey belum bisa dikunci.
            Field yang kurang ditandai ⚠ di tab Data Teknis.
          </span>
        </div>
      )}

      {/* ── Kelengkapan ── */}
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Kelengkapan data teknis</span>
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full transition-all ${persen === 100 ? 'bg-green-500' : persen >= 60 ? 'bg-amber-500' : 'bg-rose-400'}`}
              style={{ width: `${persen}%` }} />
          </div>
          <span className="text-xs font-semibold whitespace-nowrap">{terisi}/{DT_FIELDS.length} · {persen}%</span>
        </div>
      </Card>

      {/* ── Identitas survey ── */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Identitas Survey</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Tanggal Survey</label>
            <Input type="date" value={tgl} onChange={e => setTgl(e.target.value)} disabled={bacaSaja} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{final ? 'Surveyor' : 'Disurvey Oleh'}</label>
            {final ? (
              <Input value={surveyor} onChange={e => setSurveyor(e.target.value)} disabled={bacaSaja} placeholder="Nama surveyor" />
            ) : (
              <Input value={nama} readOnly disabled className="bg-muted" />
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">PJ Lapangan</label>
            <Input value={pjLapangan} onChange={e => setPjLapangan(e.target.value)} disabled={bacaSaja} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Telp PJ</label>
            <Input value={pjTelp} onChange={e => setPjTelp(e.target.value)} disabled={bacaSaja} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Jam Kerja di Lokasi</label>
            <Input value={jamKerja} onChange={e => setJamKerja(e.target.value)} disabled={bacaSaja} placeholder="mis. 09.00 – 15.00" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">No. Form Survey</label>
            <Input value={noSurvey} readOnly disabled className="bg-muted font-mono text-xs" />
          </div>
        </div>
      </Card>

      {/* ── Tab ── */}
      <div className="flex flex-wrap gap-1.5 border-b pb-2">
        {TAB.map(t => {
          const jml = t === 'Dokumentasi' ? dokumentasi.filter(d => d.foto.length).length
            : t === 'Add-on' ? bacaAddon(dt).filter(a => a.on).length
            : t === 'Lantai' ? bacaLantai(dt).length
            : t === 'Kesimpulan & Catatan' ? kesimpulan.filter(k => k.jawab).length : 0;
          return (
            <Button key={t} size="sm" variant={tab === t ? 'default' : 'ghost'} onClick={() => setTab(t)}>
              {t}{jml ? <span className="ml-1.5 opacity-70 text-[11px]">{jml}</span> : null}
            </Button>
          );
        })}
      </div>

      <Card className="p-4">
        {tab === 'Data Teknis' && (
          <DataTeknisPanel dt={dt} ubah={(k, v) => setDt(p => ({ ...p, [k]: v }))} bacaSaja={bacaSaja} wajibKosong={wajibKosong} />
        )}
        {tab === 'Lantai' && (
          <LantaiPanel lantai={bacaLantai(dt)} ubah={(l: Lantai[]) => setDt(p => ({ ...p, lantai: l }))} bacaSaja={bacaSaja} />
        )}
        {tab === 'Add-on' && (
          <AddOnPanel addon={bacaAddon(dt)} ubah={(a: AddOn[]) => setDt(p => ({ ...p, addon: a }))} bacaSaja={bacaSaja} />
        )}
        {tab === 'Dokumentasi' && (
          <div className="space-y-4">
            <DokumentasiPanel baris={dokumentasi} ubah={setDokumentasi} bacaSaja={bacaSaja} />
            <div className="space-y-1 pt-2 border-t">
              <label className="text-xs font-medium text-muted-foreground">Tautan Video Survey</label>
              <Input value={videoLink} onChange={e => setVideoLink(e.target.value)} disabled={bacaSaja} placeholder="https://…" />
            </div>
          </div>
        )}
        {tab === 'Pekerjaan Tambahan' && (
          <PekerjaanPanel baris={pekerjaan} ubah={setPekerjaan} bacaSaja={bacaSaja} />
        )}
        {tab === 'Kesimpulan & Catatan' && (
          <div className="space-y-6">
            <KesimpulanPanel baris={kesimpulan} ubah={setKesimpulan} bacaSaja={bacaSaja} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Catatan Lapangan</label>
                <textarea value={catatanLapangan} onChange={e => setCatatanLapangan(e.target.value)} disabled={bacaSaja}
                  rows={5} className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Catatan untuk Bagian Desain</label>
                <textarea value={catatanDesain} onChange={e => setCatatanDesain(e.target.value)} disabled={bacaSaja}
                  rows={5} className="w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold mb-3 pb-1.5 border-b">Penanda Tangan</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{final ? 'Sales' : 'Disurvey Oleh'}</label>
                  <Input value={ttd.sales || (!final ? nama : '')}
                    onChange={e => setTtd(p => ({ ...p, sales: e.target.value }))} disabled={bacaSaja} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Customer</label>
                  <Input value={ttd.customer} onChange={e => setTtd(p => ({ ...p, customer: e.target.value }))} disabled={bacaSaja} />
                </div>
                {final && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Surveyor</label>
                    <Input value={ttd.surveyor || surveyor}
                      onChange={e => setTtd(p => ({ ...p, surveyor: e.target.value }))} disabled={bacaSaja} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Riwayat ── */}
      {riwayat.length > 0 && (
        <Card className="p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <History className="w-4 h-4" /> Riwayat
          </h2>
          <div className="space-y-1.5">
            {riwayat.map(r => (
              <div key={r.id} className="flex flex-wrap items-baseline gap-2 text-xs py-1 border-b last:border-0">
                <span className="font-medium">{r.aksi}</span>
                <span className="text-muted-foreground">oleh {r.oleh || '—'}</span>
                <span className="text-muted-foreground">{new Date(r.waktu).toLocaleString('id-ID')}</span>
                {r.alasan && <span className="italic text-muted-foreground">— {r.alasan}</span>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Simpan bawah ── */}
      {!terkunci && bolehIsi && (
        <div className="flex justify-end gap-2 sticky bottom-4">
          <Button variant="outline" onClick={() => simpan()} disabled={menyimpan}>
            <Save className="w-4 h-4 mr-1.5" /> Simpan
          </Button>
          {final && bolehKunci && (
            <Button className="bg-green-600 hover:bg-green-700" onClick={kunci}>
              <ClipboardCheck className="w-4 h-4 mr-1.5" /> Kunci Final Survey
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
