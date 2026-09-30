import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ArrowLeft, Search, Factory, Lock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { surveyApi, poApi, type BarisSurvey } from '@/lib/survey-api';
import { fmtTglPendek } from '@/lib/survey-utils';

/**
 * Pilih proyek untuk PO baru.
 * Syarat PO1: Final Survey sudah dikunci. Yang belum dikunci ditampilkan
 * sebagai peringatan supaya jelas kenapa tidak bisa dipilih.
 */
export default function PoPilihProyek() {
  const navigate = useNavigate();
  const [finals, setFinals] = useState<BarisSurvey[]>([]);
  const [sudah, setSudah] = useState<string[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [q, setQ] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [f, p] = await Promise.all([
        surveyApi.daftar({ jenis: 'final' }),
        poApi.daftar(),
      ]);
      setFinals(f.data || []);
      setSudah((p.data || []).map(x => x.id_lead));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat data');
    } finally { setMemuat(false); }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const { siap, belumKunci } = useMemo(() => {
    const setSudah = new Set(sudah);
    const kandidat = finals.filter(f => !setSudah.has(f.id_lead));
    return {
      siap: kandidat.filter(f => f.terkunci),
      belumKunci: kandidat.filter(f => !f.terkunci),
    };
  }, [finals, sudah]);

  const saring = (arr: BarisSurvey[]) => {
    const t = q.trim().toLowerCase();
    if (!t) return arr;
    return arr.filter(f =>
      (f.nama_prospek || '').toLowerCase().includes(t)
      || (f.kode_lead || '').toLowerCase().includes(t)
      || (f.kode_proyek || '').toLowerCase().includes(t));
  };

  return (
    <div className="space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate('/po')}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Daftar PO
        </Button>
        <h1 className="text-xl font-bold">PO Baru</h1>
        <p className="text-sm text-muted-foreground">
          Pilih proyek yang Final Survey-nya sudah dikunci. Nomor PO dibuat otomatis oleh sistem.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari prospek, kode lead, kode proyek…" className="pl-8" />
      </div>

      <Card className="overflow-hidden">
        <div className="px-3 py-2 bg-green-50/60 border-b flex items-center gap-2 text-sm font-medium text-green-800">
          <CheckCircle2 className="w-4 h-4" /> Siap dibuatkan PO ({siap.length})
        </div>
        {memuat ? (
          <p className="p-8 text-center text-muted-foreground">Memuat…</p>
        ) : saring(siap).length === 0 ? (
          <div className="p-8 text-center">
            <Factory className="w-9 h-9 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Tidak ada proyek yang siap. Final Survey harus dikunci lebih dahulu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2.5">Prospek</th>
                  <th className="p-2.5">Kode Proyek</th>
                  <th className="p-2.5">No. Final Survey</th>
                  <th className="p-2.5">Dikunci</th>
                  <th className="p-2.5">Surveyor</th>
                  <th className="p-2.5 w-28" />
                </tr>
              </thead>
              <tbody>
                {saring(siap).map(f => (
                  <tr key={f.id} className="border-t hover:bg-muted/30">
                    <td className="p-2.5 font-medium">{f.nama_prospek || '—'}
                      <span className="block text-xs text-muted-foreground">{f.kode_lead || '—'}</span>
                    </td>
                    <td className="p-2.5 font-mono text-xs">{f.kode_proyek || '—'}</td>
                    <td className="p-2.5 font-mono text-xs">{f.no_survey || '—'}</td>
                    <td className="p-2.5 text-xs">{fmtTglPendek(f.dikunci_pada)}</td>
                    <td className="p-2.5">{f.surveyor || '—'}</td>
                    <td className="p-2.5 text-right">
                      <Button size="sm" onClick={() => navigate(`/po/baru?lead=${encodeURIComponent(f.id_lead)}`)}>
                        Buat PO
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {belumKunci.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-3 py-2 bg-amber-50/60 border-b flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="w-4 h-4" /> Final Survey belum dikunci — belum bisa dibuat PO ({belumKunci.length})
          </div>
          <div className="divide-y">
            {saring(belumKunci).map(f => (
              <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-2.5 text-sm">
                <span>{f.nama_prospek || '—'}
                  <span className="text-xs text-muted-foreground ml-2">{f.kode_lead || '—'}</span>
                </span>
                <Button size="sm" variant="outline"
                  onClick={() => navigate(`/survey/final/${f.id}`)}>
                  <Lock className="w-3.5 h-3.5 mr-1.5" /> Buka Final Survey
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
