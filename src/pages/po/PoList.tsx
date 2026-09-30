import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Factory, Search, ArrowRight, Plus, GitCompare, Eye } from 'lucide-react';
import { poApi } from '@/lib/survey-api';
import type { PoRow } from '@/lib/survey-types';
import { useCrmUser } from '@/hooks/useCrmUser';
import { bolehTerbitPO } from '@/lib/crm-akses';
import { fmtTglPendek } from '@/lib/survey-utils';

const LENCANA_STATUS: Record<string, string> = {
  Draft: 'bg-slate-50 text-slate-600 border-slate-200',
  Terbit: 'bg-green-50 text-green-700 border-green-200',
  Revisi: 'bg-amber-50 text-amber-700 border-amber-200',
  Batal: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function PoList() {
  const navigate = useNavigate();
  const { peran } = useCrmUser();
  const [baris, setBaris] = useState<(PoRow & { nama_prospek?: string | null; jml_revisi?: number })[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [q, setQ] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await poApi.daftar();
      setBaris(r.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat PO');
    } finally { setMemuat(false); }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const tersaring = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return baris;
    return baris.filter(b =>
      (b.no_po || '').toLowerCase().includes(t)
      || (b.nama_prospek || '').toLowerCase().includes(t)
      || (b.pabrik || '').toLowerCase().includes(t)
      || (b.kode_proyek || '').toLowerCase().includes(t));
  }, [baris, q]);

  const ringkas = useMemo(() => ({
    total: baris.length,
    terbit: baris.filter(b => b.status === 'Terbit').length,
    revisi: baris.filter(b => (b.rev_terakhir || 0) > 1).length,
  }), [baris]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">PO Pabrik</h1>
          <p className="text-sm text-muted-foreground">
            Pemesanan lift ke pabrik. Terbit setelah Final Survey dikunci. Revisi tercatat otomatis.
          </p>
        </div>
        {bolehTerbitPO(peran) && (
          <Button onClick={() => navigate('/po/pilih')}>
            <Plus className="w-4 h-4 mr-1.5" /> PO Baru
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total PO', nilai: ringkas.total, warna: 'text-foreground' },
          { label: 'Sudah terbit', nilai: ringkas.terbit, warna: 'text-green-600' },
          { label: 'Punya revisi', nilai: ringkas.revisi, warna: 'text-amber-600' },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold ${k.warna}`}>{k.nilai}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari no. PO, prospek, pabrik…" className="pl-8" />
        </div>
        <Button variant="outline" onClick={muat} disabled={memuat}>Muat ulang</Button>
      </div>

      <Card className="overflow-hidden">
        {memuat ? (
          <p className="p-8 text-center text-muted-foreground">Memuat…</p>
        ) : tersaring.length === 0 ? (
          <div className="p-10 text-center">
            <Factory className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {baris.length === 0 ? 'Belum ada PO pabrik.' : 'Tidak ada baris yang cocok.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2.5">No. PO</th>
                  <th className="p-2.5">Proyek</th>
                  <th className="p-2.5">Pabrik</th>
                  <th className="p-2.5">Tgl PO</th>
                  <th className="p-2.5 text-center">Rev</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5 w-28" />
                </tr>
              </thead>
              <tbody>
                {tersaring.map(b => (
                  <tr key={b.id} className="border-t hover:bg-muted/30">
                    <td className="p-2.5 font-mono text-xs font-medium">{b.no_po || '—'}</td>
                    <td className="p-2.5">
                      <span className="font-medium">{b.nama_prospek || '—'}</span>
                      {b.kode_proyek && <span className="block text-xs text-muted-foreground font-mono">{b.kode_proyek}</span>}
                    </td>
                    <td className="p-2.5">{b.pabrik || '—'}</td>
                    <td className="p-2.5 whitespace-nowrap">{fmtTglPendek(b.tgl_po)}</td>
                    <td className="p-2.5 text-center">
                      <span className={`inline-block min-w-[22px] px-1.5 py-0.5 rounded text-xs font-semibold ${
                        (b.rev_terakhir || 0) > 1 ? 'bg-amber-50 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                        {b.rev_terakhir || 0}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                        LENCANA_STATUS[b.status || 'Draft'] || LENCANA_STATUS.Draft}`}>
                        {b.status || 'Draft'}
                      </span>
                    </td>
                    <td className="p-2.5">
                      <div className="flex justify-end gap-1">
                        {(b.jml_revisi || 0) > 0 && <GitCompare className="w-4 h-4 text-muted-foreground self-center" />}
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/po/${b.id}/preview`)}>
                          <Eye className="w-3.5 h-3.5 mr-1" /> Lihat
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/po/${b.id}`)}>
                          Buka <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
