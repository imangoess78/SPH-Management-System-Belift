import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Search, AlertTriangle, CheckCircle2, Info, FileText, Link2 } from 'lucide-react';
import { api, type Lead } from '@/lib/crm-api';
import { surveyApi, spkApi, type BarisSurvey } from '@/lib/survey-api';
import { StatusBadge, KualifikasiBadge } from '@/components/crm/CrmBadges';
import { fmtTglPendek } from '@/lib/survey-utils';
import type { SpkFinal } from '../../../shared/spk-dokumen';

const TAHAP_SURVEY = ['Survey Dijadwalkan', 'Survey Selesai'];

/**
 * Pilih jangkar untuk memulai Survey Sales / Final Survey.
 *
 * Final Survey punya DUA pintu masuk:
 *   1. Lewat lead — lead yang sudah melewati Survey Sales (alur baku)
 *   2. Lewat dokumen SPK final — untuk tim yang melompat langsung
 *      SPH → SPK tanpa mengisi Survey Sales dulu
 *
 * Pintu kedua sengaja ditambahkan karena tanpa itu halaman ini tampil kosong
 * meski SPK-nya sudah ada: daftar lead mensyaratkan Survey Sales lebih dulu,
 * sedangkan dokumen SPK tidak pernah menyimpan `id_lead`. Penautannya
 * diselesaikan server lewat `survey/taut_spk` saat tombol Pilih ditekan.
 */
export default function SurveyPilihLead({ jenis }: { jenis: 'sales' | 'final' }) {
  const navigate = useNavigate();
  const final = jenis === 'final';
  const induk = final ? '/survey/final' : '/survey/sales';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [sudah, setSudah] = useState<BarisSurvey[]>([]);
  // Daftar Survey Sales terpisah. `surveyApi.daftar({ jenis })` menyaring di
  // sisi SQL, jadi permintaan ber-jenis 'final' TIDAK PERNAH memuat baris
  // 'sales'. Final Survey menuntut Survey Sales yang sudah ada, jadi datanya
  // harus diambil sendiri — bukan disaring dari daftar yang sudah tersaring.
  const [surveySales, setSurveySales] = useState<BarisSurvey[]>([]);
  const [spkList, setSpkList] = useState<SpkFinal[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [q, setQ] = useState('');
  const [menaut, setMenaut] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [l, s, ss, sp] = await Promise.all([
        api.listLeads({ limit: 500 }),
        surveyApi.daftar({ jenis }),
        final ? surveyApi.daftar({ jenis: 'sales' }) : Promise.resolve({ data: [] as BarisSurvey[] }),
        final ? spkApi.final() : Promise.resolve({ data: [] as SpkFinal[] }),
      ]);
      setLeads((l.data || []) as Lead[]);
      setSudah(s.data || []);
      setSurveySales(ss.data || []);
      setSpkList(sp.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally { setMemuat(false); }
  }, [jenis, final]);

  useEffect(() => { muat(); }, [muat]);

  const petaSudah = useMemo(() => {
    const m = new Map<string, BarisSurvey>();
    for (const s of sudah) m.set(s.id_lead, s);
    return m;
  }, [sudah]);

  const perluFinal = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const s of surveySales) m.set(s.id_lead, true);
    return m;
  }, [surveySales]);

  // Tanggal Survey Sales per lead — untuk ditampilkan di kolom bantu Final Survey.
  const tglSales = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of surveySales) m.set(s.id_lead, s.tgl_survey || '');
    return m;
  }, [surveySales]);

  const petaLead = useMemo(() => {
    const m = new Map<string, Lead>();
    for (const l of leads) m.set(l.id, l);
    return m;
  }, [leads]);

  // Lead yang sudah punya Final Survey (dibuat dari pintu mana pun).
  const leadSudahFinal = useMemo(() => {
    const set = new Set<string>();
    if (final) for (const s of sudah) set.add(s.id_lead);
    return set;
  }, [sudah, final]);

  // Lead yang layak dipilih
  const layak = useMemo(() => {
    const keluar = leads.filter(l => {
      // Final Survey menuntut Survey Sales sudah ada
      if (final && !perluFinal.has(l.id)) return false;
      // Sudah punya survey jenis ini → jangan ditawarkan lagi
      if (petaSudah.has(l.id)) return false;
      return true;
    });
    const t = q.trim().toLowerCase();
    return t ? keluar.filter(l =>
      (l.nama_prospek || '').toLowerCase().includes(t)
      || (l.kode_lead || '').toLowerCase().includes(t)
      || (l.kota || '').toLowerCase().includes(t)
      || (l.sales || '').toLowerCase().includes(t)) : keluar;
  }, [leads, petaSudah, perluFinal, final, q]);

  /**
   * SPK final yang belum punya Final Survey.
   *
   * Bila dokumen sudah menunjuk lead (`id_lead` terisi) dan lead itu sudah
   * punya Final Survey, dokumennya disembunyikan — supaya tidak ada tombol
   * yang menghasilkan survey dobel. Bila `id_lead` masih kosong, dokumen
   * selalu ditawarkan: server yang akan menautkannya saat tombol ditekan.
   */
  const spkLayak = useMemo(() => {
    if (!final) return [];
    const tersaring = spkList.filter(s => {
      if (s.id_lead && leadSudahFinal.has(s.id_lead)) return false;
      return true;
    });
    const t = q.trim().toLowerCase();
    return t ? tersaring.filter(s =>
      s.customer.toLowerCase().includes(t)
      || s.nomor_spk.toLowerCase().includes(t)
      || s.kota.toLowerCase().includes(t)
      || s.sales.toLowerCase().includes(t)) : tersaring;
  }, [spkList, final, leadSudahFinal, q]);

  const belumTahapSurvey = useMemo(
    () => leads.filter(l => !TAHAP_SURVEY.includes(l.status_terakhir || '') && !petaSudah.has(l.id)).length,
    [leads, petaSudah],
  );

  const mulai = (idLead: string) => navigate(`${induk}/baru?lead=${encodeURIComponent(idLead)}`);

  /**
   * Final Survey dari dokumen SPK. Penautan dikerjakan server: cari lead yang
   * namanya cocok, kalau tidak ada buat lead baru dari data SPK, lalu tulis
   * `id_lead` balik ke dokumennya. Setelah itu alurnya sama saja dengan
   * pintu pertama — jadi tidak ada jalur kode terpisah yang bisa menyimpang.
   */
  async function mulaiDariSpk(s: SpkFinal) {
    setMenaut(s.id);
    try {
      const h = await spkApi.taut(s.id);
      toast.success(
        h.baru
          ? `Lead baru ${h.kode_lead || ''} dibuat dari ${s.nomor_spk}`
          : `Ditautkan ke lead ${h.kode_lead || h.id_lead}`,
      );
      mulai(h.id_lead);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menautkan SPK ke lead');
    } finally { setMenaut(null); }
  }

  const adaDokumen = spkLayak.length > 0;
  const kosong = layak.length === 0 && !adaDokumen;

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate(induk)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Daftar {final ? 'Final Survey' : 'Survey Sales'}
        </Button>
        <h1 className="text-xl font-bold">{final ? 'Mulai Final Survey' : 'Mulai Survey Sales'}</h1>
        <p className="text-sm text-muted-foreground">
          {final
            ? 'Pilih proyek yang sudah punya Survey Sales, atau langsung dari dokumen SPK yang sudah final. Final Survey dikerjakan Surveyor di lokasi.'
            : 'Pilih lead yang masuk tahap survey. Kode proyek dibuat otomatis.'}
        </p>
      </div>

      {final && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-sky-200 bg-sky-50 text-sm">
          <Info className="w-4 h-4 mt-0.5 text-sky-600 shrink-0" />
          <span>
            Dua cara memulai: lewat <strong>proyek yang sudah melewati Survey Sales</strong>, atau
            lewat <strong>dokumen SPK final</strong> — dokumen itu ditautkan ke lead-nya lebih dulu.
          </span>
        </div>
      )}
      {!final && belumTahapSurvey > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 bg-amber-50 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-600 shrink-0" />
          <span>
            {belumTahapSurvey} lead belum berstatus <em>Survey Dijadwalkan</em> atau <em>Survey Selesai</em>.
            Lead tetap bisa disurvey, tetapi alurnya di luar tahapan baku.
          </span>
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={final ? 'Cari prospek, kode lead, nomor SPK, kota, sales…' : 'Cari prospek, kode lead, kota, sales…'}
          className="pl-8"
        />
      </div>

      {memuat ? (
        <Card className="overflow-hidden"><p className="p-8 text-center text-muted-foreground">Memuat…</p></Card>
      ) : kosong ? (
        <Card className="overflow-hidden">
          <div className="p-10 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {final
                ? 'Semua proyek yang punya Survey Sales sudah punya Final Survey, dan tidak ada SPK final yang belum disurvey.'
                : 'Tidak ada lead yang perlu disurvey.'}
            </p>
          </div>
        </Card>
      ) : (
        <>
          {/* ── Pintu 1: proyek yang sudah melewati Survey Sales ── */}
          {layak.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {final ? 'Dari Proyek (punya Survey Sales)' : 'Dari Lead'}
                <span className="ml-2 font-normal normal-case">({layak.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-2.5">Prospek</th>
                      <th className="p-2.5">Kode Lead</th>
                      <th className="p-2.5">Kota</th>
                      <th className="p-2.5">Sales</th>
                      <th className="p-2.5">Kualifikasi</th>
                      <th className="p-2.5">Tahap</th>
                      {final && <th className="p-2.5">Survey Sales</th>}
                      <th className="p-2.5 w-28" />
                    </tr>
                  </thead>
                  <tbody>
                    {layak.map(l => (
                      <tr key={l.id} className="border-t hover:bg-muted/30">
                        <td className="p-2.5 font-medium">{l.nama_prospek || '—'}</td>
                        <td className="p-2.5 font-mono text-xs">{l.kode_lead || '—'}</td>
                        <td className="p-2.5">{l.kota || '—'}</td>
                        <td className="p-2.5">{l.sales || '—'}</td>
                        <td className="p-2.5"><KualifikasiBadge nilai={l.kualifikasi} skor={l.skor} /></td>
                        <td className="p-2.5"><StatusBadge status={l.status_terakhir} /></td>
                        {final && (
                          <td className="p-2.5 text-xs">
                            {perluFinal.has(l.id)
                              ? <span className="text-green-700">Ada · {fmtTglPendek(tglSales.get(l.id))}</span>
                              : <span className="text-muted-foreground">Belum ada</span>}
                          </td>
                        )}
                        <td className="p-2.5 text-right">
                          <Button size="sm" onClick={() => mulai(l.id)}>Pilih</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ── Pintu 2: dokumen SPK final ── */}
          {final && spkLayak.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-3 py-2 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Dari Dokumen SPK Final
                <span className="font-normal normal-case">({spkLayak.length})</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="p-2.5">Customer</th>
                      <th className="p-2.5">Nomor SPK</th>
                      <th className="p-2.5">Tanggal</th>
                      <th className="p-2.5">Kota</th>
                      <th className="p-2.5">Sales</th>
                      <th className="p-2.5">Tautan Lead</th>
                      <th className="p-2.5 w-40" />
                    </tr>
                  </thead>
                  <tbody>
                    {spkLayak.map(s => {
                      const lead = s.id_lead ? petaLead.get(s.id_lead) : undefined;
                      const cocokNama = !s.id_lead
                        ? leads.find(l => (l.nama_prospek || '').toLowerCase().trim() === s.customer.toLowerCase().trim())
                        : undefined;
                      return (
                        <tr key={s.id} className="border-t hover:bg-muted/30">
                          <td className="p-2.5 font-medium">{s.customer || '—'}</td>
                          <td className="p-2.5 font-mono text-xs">{s.nomor_spk || '—'}</td>
                          <td className="p-2.5">{s.tanggal ? fmtTglPendek(s.tanggal) : '—'}</td>
                          <td className="p-2.5">{s.kota || '—'}</td>
                          <td className="p-2.5">{s.sales || '—'}</td>
                          <td className="p-2.5 text-xs">
                            {s.id_lead ? (
                              <span className="text-green-700 font-mono">{lead?.kode_lead || 'Sudah tertaut'}</span>
                            ) : cocokNama ? (
                              <span className="text-amber-700">
                                Akan ditautkan ke <span className="font-mono">{cocokNama.kode_lead}</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Belum ada — lead baru akan dibuat</span>
                            )}
                          </td>
                          <td className="p-2.5 text-right">
                            <Button size="sm" disabled={menaut === s.id} onClick={() => mulaiDariSpk(s)}>
                              <Link2 className="w-3.5 h-3.5 mr-1" />
                              {menaut === s.id ? 'Menautkan…' : 'Tautkan & Survey'}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
