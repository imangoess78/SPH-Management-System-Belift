import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Search, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { api, type Lead } from '@/lib/crm-api';
import { surveyApi, type BarisSurvey } from '@/lib/survey-api';
import { StatusBadge, KualifikasiBadge } from '@/components/crm/CrmBadges';
import { fmtTglPendek } from '@/lib/survey-utils';

const TAHAP_SURVEY = ['Survey Dijadwalkan', 'Survey Selesai'];

/**
 * Pilih lead untuk memulai Survey Sales / Final Survey.
 * Yang ditampilkan hanya lead yang sudah lolos ke tahap survey.
 */
export default function SurveyPilihLead({ jenis }: { jenis: 'sales' | 'final' }) {
  const navigate = useNavigate();
  const final = jenis === 'final';
  const induk = final ? '/survey/final' : '/survey/sales';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [sudah, setSudah] = useState<BarisSurvey[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [q, setQ] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [l, s] = await Promise.all([
        api.listLeads({ limit: 500 }),
        surveyApi.daftar({ jenis }),
      ]);
      setLeads((l.data || []) as Lead[]);
      setSudah(s.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally { setMemuat(false); }
  }, [jenis]);

  useEffect(() => { muat(); }, [muat]);

  const petaSudah = useMemo(() => {
    const m = new Map<string, BarisSurvey>();
    for (const s of sudah) m.set(s.id_lead, s);
    return m;
  }, [sudah]);

  const perluFinal = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const s of sudah) if (s.jenis === 'sales') m.set(s.id_lead, true);
    return m;
  }, [sudah]);

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

  const belumTahapSurvey = useMemo(
    () => leads.filter(l => !TAHAP_SURVEY.includes(l.status_terakhir || '') && !petaSudah.has(l.id)).length,
    [leads, petaSudah],
  );

  const mulai = (idLead: string) => navigate(`${induk}/baru?lead=${encodeURIComponent(idLead)}`);

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate(induk)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Daftar {final ? 'Final Survey' : 'Survey Sales'}
        </Button>
        <h1 className="text-xl font-bold">{final ? 'Mulai Final Survey' : 'Mulai Survey Sales'}</h1>
        <p className="text-sm text-muted-foreground">
          {final
            ? 'Pilih proyek yang sudah punya Survey Sales. Final Survey dikerjakan Surveyor di lokasi.'
            : 'Pilih lead yang masuk tahap survey. Kode proyek dibuat otomatis.'}
        </p>
      </div>

      {final && (
        <div className="flex items-start gap-2 p-3 rounded-md border border-sky-200 bg-sky-50 text-sm">
          <Info className="w-4 h-4 mt-0.5 text-sky-600 shrink-0" />
          <span>Yang muncul di sini hanya proyek yang <strong>sudah melewati Survey Sales</strong> dan belum punya Final Survey.</span>
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
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari prospek, kode lead, kota, sales…" className="pl-8" />
      </div>

      <Card className="overflow-hidden">
        {memuat ? (
          <p className="p-8 text-center text-muted-foreground">Memuat…</p>
        ) : layak.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {final
                ? 'Semua proyek yang punya Survey Sales sudah punya Final Survey.'
                : 'Tidak ada lead yang perlu disurvey.'}
            </p>
          </div>
        ) : (
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
                {layak.map(l => {
                  const ss = petaSudah.get(l.id);
                  return (
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
                            ? <span className="text-green-700">Ada · {fmtTglPendek(sudah.find(s => s.id_lead === l.id && s.jenis === 'sales')?.tgl_survey)}</span>
                            : <span className="text-muted-foreground">Belum ada</span>}
                        </td>
                      )}
                      <td className="p-2.5 text-right">
                        <Button size="sm" onClick={() => mulai(l.id)}>Pilih</Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
