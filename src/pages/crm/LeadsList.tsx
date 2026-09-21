import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, RefreshCw, Pencil, Trash2, ChevronLeft, ChevronRight, Flame, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { api, type Lead, type Meta } from '@/lib/crm-api';
import { KualifikasiBadge, StatusBadge } from '@/components/crm/CrmBadges';
import { useCrmUser } from '@/hooks/useCrmUser';
import { formatRupiah } from '@/lib/crm-utils';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const SEMUA = '__semua__';
const PAGE_SIZE = 25;

function tanggalRingkas(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v).slice(0, 10);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' });
}

export default function LeadsList() {
  const navigate = useNavigate();
  const { nama, peran, bolehLihatSemua, bolehUbahBaris } = useCrmUser();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [halaman, setHalaman] = useState(1);
  const [memuat, setMemuat] = useState(true);
  const [hapus, setHapus] = useState<Lead | null>(null);

  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState(SEMUA);
  const [fKual, setFKual] = useState(SEMUA);
  const [fKanal, setFKanal] = useState(SEMUA);
  const [fSales, setFSales] = useState(SEMUA);

  useEffect(() => { api.meta().then(setMeta).catch(() => toast.error('Gagal memuat master data')); }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await api.listLeads({
        q: q || undefined,
        status: fStatus === SEMUA ? undefined : fStatus,
        kualifikasi: fKual === SEMUA ? undefined : fKual,
        kode_kanal: fKanal === SEMUA ? undefined : fKanal,
        sales: bolehLihatSemua ? (fSales === SEMUA ? undefined : fSales) : nama,
        page: halaman, limit: PAGE_SIZE,
      });
      setLeads(r.data); setTotal(r.total);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat lead');
    } finally { setMemuat(false); }
  }, [q, fStatus, fKual, fKanal, fSales, halaman, bolehLihatSemua, nama]);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { setHalaman(1); }, [q, fStatus, fKual, fKanal, fSales]);

  const jumlahHalaman = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const ringkas = useMemo(() => ({
    hot: leads.filter(l => l.kualifikasi === 'HOT').length,
    warm: leads.filter(l => l.kualifikasi === 'WARM').length,
    cold: leads.filter(l => l.kualifikasi === 'COLD').length,
    tanpaNilai: leads.filter(l => ['SPH Terkirim', 'Negosiasi', 'Menunggu Approval Diskon'].includes(l.status_terakhir || '') && !l.nilai_sph).length,
  }), [leads]);

  const konfirmasiHapus = async () => {
    if (!hapus) return;
    try {
      await api.deleteLead(hapus.id);
      toast.success(`Lead ${hapus.kode_lead || hapus.nama_prospek} dihapus`);
      setHapus(null); muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus'); }
  };

  const adaFilter = q || fStatus !== SEMUA || fKual !== SEMUA || fKanal !== SEMUA || fSales !== SEMUA;

  return (
    <div className="space-y-4">
      {/* ── Judul ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Leads</h1>
          <p className="text-sm text-muted-foreground">
            {bolehLihatSemua ? `Semua lead · ${total} baris` : `Lead milik ${nama} · ${total} baris`}
            <span className="ml-2 text-[11px] uppercase tracking-wide opacity-60">peran: {peran}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={muat} disabled={memuat}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${memuat ? 'animate-spin' : ''}`} />Muat ulang
          </Button>
          <Button size="sm" onClick={() => navigate('/crm/leads/baru')}>
            <Plus className="w-4 h-4 mr-1.5" />Tambah Lead
          </Button>
        </div>
      </div>

      {/* ── Ringkasan halaman ini ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Flame className="w-3.5 h-3.5 text-red-500" />HOT</p>
          <p className="text-2xl font-bold">{ringkas.hot}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">WARM</p>
          <p className="text-2xl font-bold text-amber-600">{ringkas.warm}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">COLD</p>
          <p className="text-2xl font-bold text-slate-500">{ringkas.cold}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-amber-500" />Nilai SPH kosong</p>
          <p className="text-2xl font-bold">{ringkas.tanpaNilai}</p>
        </Card>
      </div>

      {/* ── Filter ── */}
      <Card className="p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Cari nama, HP, kota, kode..." value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <Select value={fKual} onValueChange={setFKual}>
            <SelectTrigger><SelectValue placeholder="Kualifikasi" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua kualifikasi</SelectItem>
              <SelectItem value="HOT">HOT</SelectItem>
              <SelectItem value="WARM">WARM</SelectItem>
              <SelectItem value="COLD">COLD</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua status</SelectItem>
              {(meta?.status || []).map(s => <SelectItem key={s.status} value={s.status}>{s.status}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fKanal} onValueChange={setFKanal}>
            <SelectTrigger><SelectValue placeholder="Kanal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua kanal</SelectItem>
              {(meta?.kanal || []).map(k => <SelectItem key={k.kode} value={k.kode}>{k.kanal}</SelectItem>)}
            </SelectContent>
          </Select>
          {bolehLihatSemua ? (
            <Select value={fSales} onValueChange={setFSales}>
              <SelectTrigger><SelectValue placeholder="Sales" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua sales</SelectItem>
                {(meta?.sales || []).filter(s => s.peran === 'Sales').map(s => <SelectItem key={s.nama} value={s.nama}>{s.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          ) : <div />}
        </div>
        {adaFilter && (
          <button className="text-xs text-primary hover:underline"
            onClick={() => { setQ(''); setFStatus(SEMUA); setFKual(SEMUA); setFKanal(SEMUA); setFSales(SEMUA); }}>
            Bersihkan filter
          </button>
        )}
      </Card>

      {/* ── Tabel ── */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Kode</th>
                <th className="text-left p-3 font-medium">Prospek</th>
                <th className="text-left p-3 font-medium">Kanal</th>
                <th className="text-left p-3 font-medium">Sales</th>
                <th className="text-left p-3 font-medium">Kualifikasi</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-right p-3 font-medium">Nilai SPH</th>
                <th className="text-left p-3 font-medium">Masuk</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {memuat && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">Memuat…</td></tr>
              )}
              {!memuat && leads.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Belum ada lead. Klik <b>Tambah Lead</b> untuk mulai mencatat.
                </td></tr>
              )}
              {!memuat && leads.map(l => {
                const kanal = meta?.kanal.find(k => k.kode === l.kode_kanal);
                return (
                  <tr key={l.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs whitespace-nowrap">{l.kode_lead || '—'}</td>
                    <td className="p-3">
                      <p className="font-medium">{l.nama_prospek}</p>
                      <p className="text-xs text-muted-foreground">{l.kota || '—'}{l.no_hp ? ` · ${l.no_hp}` : ''}</p>
                    </td>
                    <td className="p-3 text-xs">{kanal ? kanal.kanal : (l.kode_kanal || '—')}</td>
                    <td className="p-3 text-xs whitespace-nowrap">{l.sales || '—'}</td>
                    <td className="p-3"><KualifikasiBadge nilai={l.kualifikasi} skor={l.skor} /></td>
                    <td className="p-3"><StatusBadge status={l.status_terakhir} /></td>
                    <td className="p-3 text-right whitespace-nowrap tabular-nums">
                      {l.nilai_sph ? formatRupiah(l.nilai_sph, true) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-3 text-xs whitespace-nowrap">{tanggalRingkas(l.waktu_masuk)}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => navigate(`/crm/leads/${l.id}`)} title="Buka / ubah">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        {bolehUbahBaris(l.sales) && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => setHapus(l)} title="Hapus">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {jumlahHalaman > 1 && (
          <div className="flex items-center justify-between gap-2 p-3 border-t">
            <p className="text-xs text-muted-foreground">Halaman {halaman} dari {jumlahHalaman}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={halaman <= 1} onClick={() => setHalaman(h => h - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={halaman >= jumlahHalaman} onClick={() => setHalaman(h => h + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Lihat juga: <Link to="/crm/kanban" className="text-primary hover:underline">Papan Kanban</Link> ·
        <Link to="/crm/iklan" className="text-primary hover:underline ml-1">Efektivitas Iklan</Link>
      </p>

      <ConfirmDialog
        open={!!hapus}
        onOpenChange={o => !o && setHapus(null)}
        title="Hapus lead ini?"
        description={`Lead ${hapus?.kode_lead || ''} — ${hapus?.nama_prospek || ''} akan dihapus permanen beserta riwayat dan antrean dokumennya.`}
        onConfirm={konfirmasiHapus}
      />
    </div>
  );
}
