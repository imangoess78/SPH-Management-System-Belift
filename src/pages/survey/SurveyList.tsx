import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Plus, Search, Lock, Unlock, ArrowRight, ClipboardList, Printer, Trash2, History,
} from 'lucide-react';
import { surveyApi, type BarisSurvey } from '@/lib/survey-api';
import { useCrmUser } from '@/hooks/useCrmUser';
import { bolehIsiSurvey, bolehIsiFinal } from '@/lib/crm-akses';
import { StatusBadge } from '@/components/crm/CrmBadges';
import { fmtTglPendek } from '@/lib/survey-utils';

/**
 * Daftar Survey — dipakai untuk Survey Sales (jenis='sales')
 * dan Final Survey (jenis='final'). Tampilan sama, aksi berbeda.
 */
export default function SurveyList({ jenis }: { jenis: 'sales' | 'final' }) {
  const navigate = useNavigate();
  const { nama, peran, bolehUbahBaris } = useCrmUser();
  const final = jenis === 'final';
  const induk = final ? '/survey/final' : '/survey/sales';

  const [baris, setBaris] = useState<BarisSurvey[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('SEMUA');
  const [hapus, setHapus] = useState<BarisSurvey | null>(null);

  const bolehIsi = final ? bolehIsiFinal(peran) : bolehIsiSurvey(peran);
  const bisaTambah = bolehIsi;

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await surveyApi.daftar({ jenis });
      setBaris(r.data || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat daftar');
    } finally { setMemuat(false); }
  }, [jenis]);

  useEffect(() => { muat(); }, [muat]);

  const tersaring = useMemo(() => baris.filter(b => {
    if (q) {
      const t = q.toLowerCase();
      const cocok = (b.nama_prospek || '').toLowerCase().includes(t)
        || (b.kode_lead || '').toLowerCase().includes(t)
        || (b.kode_proyek || '').toLowerCase().includes(t)
        || (b.kota || '').toLowerCase().includes(t);
      if (!cocok) return false;
    }
    if (fStatus === 'TERKUNCI') return b.terkunci;
    if (fStatus === 'TERBUKA') return !b.terkunci;
    return true;
  }), [baris, q, fStatus]);

  const ringkas = useMemo(() => ({
    total: baris.length,
    terkunci: baris.filter(b => b.terkunci).length,
    mingguIni: baris.filter(b => {
      if (!b.tgl_survey) return false;
      const d = new Date(b.tgl_survey);
      const tujuhHari = Date.now() - 7 * 86400000;
      return d.getTime() >= tujuhHari;
    }).length,
  }), [baris]);

  const hapusBaris = async () => {
    if (!hapus) return;
    try {
      await surveyApi.hapus(hapus.id);
      toast.success('Survey dihapus');
      setHapus(null); muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus'); }
  };

  return (
    <div className="space-y-4">
      {/* ── Judul ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{final ? 'Final Survey' : 'Survey Sales'}</h1>
          <p className="text-sm text-muted-foreground">
            {final
              ? 'Survei teknis akhir oleh Surveyor. Dikunci sebelum PO diterbitkan.'
              : 'Survei awal oleh Sales. Dikenakan pada lead yang sudah masuk tahap survey.'}
          </p>
        </div>
        {bisaTambah && (
          <Button onClick={() => navigate(`${induk}/pilih`)}>
            <Plus className="w-4 h-4 mr-1.5" /> {final ? 'Mulai Final Survey' : 'Mulai Survey'}
          </Button>
        )}
      </div>

      {/* ── Ringkasan ── */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total survey', nilai: ringkas.total, warna: 'text-foreground' },
          { label: final ? 'Terkunci' : 'Selesai dikunci', nilai: ringkas.terkunci, warna: 'text-green-600' },
          { label: '7 hari terakhir', nilai: ringkas.mingguIni, warna: 'text-sky-600' },
        ].map(k => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={`text-2xl font-bold ${k.warna}`}>{k.nilai}</p>
          </Card>
        ))}
      </div>

      {/* ── Saringan ── */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari prospek, kode, kota…" className="pl-8" />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SEMUA">Semua status</SelectItem>
            <SelectItem value="TERKUNCI">Terkunci</SelectItem>
            <SelectItem value="TERBUKA">Belum dikunci</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={muat} disabled={memuat}>Muat ulang</Button>
      </div>

      {/* ── Tabel ── */}
      <Card className="overflow-hidden">
        {memuat ? (
          <p className="p-8 text-center text-muted-foreground">Memuat…</p>
        ) : tersaring.length === 0 ? (
          <div className="p-10 text-center">
            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {baris.length === 0
                ? `Belum ada ${final ? 'Final Survey' : 'Survey Sales'}.`
                : 'Tidak ada baris yang cocok dengan saringan.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left">
                  <th className="p-2.5">Prospek</th>
                  <th className="p-2.5">Kode Proyek</th>
                  <th className="p-2.5">No. Survey</th>
                  <th className="p-2.5">Tanggal</th>
                  <th className="p-2.5">{final ? 'Surveyor' : 'Disurvey Oleh'}</th>
                  <th className="p-2.5">Status</th>
                  <th className="p-2.5">Tahap Lead</th>
                  <th className="p-2.5 w-32" />
                </tr>
              </thead>
              <tbody>
                {tersaring.map(b => (
                  <tr key={b.id} className="border-t hover:bg-muted/30">
                    <td className="p-2.5">
                      <button className="text-left hover:underline" onClick={() => navigate(`${induk}/${b.id}`)}>
                        <span className="font-medium">{b.nama_prospek || '—'}</span>
                        <span className="block text-xs text-muted-foreground">{b.kode_lead || '—'}{b.kota ? ` · ${b.kota}` : ''}</span>
                      </button>
                    </td>
                    <td className="p-2.5 font-mono text-xs">{b.kode_proyek || '—'}</td>
                    <td className="p-2.5 font-mono text-xs">{b.no_survey || '—'}</td>
                    <td className="p-2.5 whitespace-nowrap">{fmtTglPendek(b.tgl_survey)}</td>
                    <td className="p-2.5">{final ? (b.surveyor || '—') : (b.disurvey_oleh || '—')}</td>
                    <td className="p-2.5">
                      {b.terkunci ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 text-[11px] font-semibold">
                          <Lock className="w-3 h-3" /> Terkunci
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                          <Unlock className="w-3 h-3" /> Terbuka
                        </span>
                      )}
                    </td>
                    <td className="p-2.5"><StatusBadge status={b.status_terakhir} /></td>
                    <td className="p-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => navigate(`${induk}/${b.id}`)}>
                          Buka <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                        {bolehUbahBaris(b.disurvey_oleh) && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                            onClick={() => setHapus(b)} disabled={b.terkunci}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        {final
          ? `Final Survey dikunci oleh Surveyor. Peran Anda: ${peran}.`
          : `Survey Sales diisi oleh Sales pemilik lead (${nama}). Peran Anda: ${peran}.`}
      </p>

      {/* ── Konfirmasi hapus ── */}
      {hapus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="max-w-md w-full p-5">
            <h3 className="font-semibold mb-1">Hapus survey ini?</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {hapus.nama_prospek} — {hapus.kode_proyek || 'tanpa kode'}. Seluruh isi survey ikut terhapus dan tidak bisa dikembalikan.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setHapus(null)}>Batal</Button>
              <Button variant="destructive" onClick={hapusBaris}>Hapus</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
