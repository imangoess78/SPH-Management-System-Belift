import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, GripVertical, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { api, type Lead, type Meta } from '@/lib/crm-api';
import { KualifikasiBadge } from '@/components/crm/CrmBadges';
import { useCrmUser } from '@/hooks/useCrmUser';
import { formatRupiah, KUALIFIKASI_STYLE, type Kualifikasi } from '@/lib/crm-utils';

const SEMUA = '__semua__';

export default function Kanban() {
  const navigate = useNavigate();
  const { nama, bolehLihatSemua, bolehUbahBaris, bolehUbahSemua } = useCrmUser();

  const [meta, setMeta] = useState<Meta | null>(null);
  const [kolom, setKolom] = useState<{ status: string; urutan: number; pemilik: string | null; leads: Lead[] }[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [fSales, setFSales] = useState(SEMUA);
  const [fKanal, setFKanal] = useState(SEMUA);
  const [seret, setSeret] = useState<Lead | null>(null);
  const [diAtas, setDiAtas] = useState<string | null>(null);
  const [pindah, setPindah] = useState(false);

  useEffect(() => { api.meta().then(setMeta).catch(() => toast.error('Gagal memuat master data')); }, []);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const r = await api.kanban({
        sales: bolehLihatSemua ? (fSales === SEMUA ? undefined : fSales) : nama,
        kode_kanal: fKanal === SEMUA ? undefined : fKanal,
      });
      setKolom(r.kolom);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat papan'); }
    finally { setMemuat(false); }
  }, [fSales, fKanal, bolehLihatSemua, nama]);

  useEffect(() => { muat(); }, [muat]);

  const jatuhkan = async (statusBaru: string) => {
    setDiAtas(null);
    const lead = seret;
    setSeret(null);
    if (!lead || lead.status_terakhir === statusBaru) return;
    if (!bolehUbahBaris(lead.sales)) {
      toast.error('Lead ini milik sales lain — hanya Manager/Admin yang boleh memindahkan');
      return;
    }
    // Status "Gugur" wajib alasan -> arahkan ke form
    if (statusBaru === 'Gugur') {
      toast.info('Status Gugur wajib diisi alasan. Silakan buka lead dan pilih status Gugur.');
      navigate(`/crm/leads/${lead.id}`);
      return;
    }
    // Pindah optimistis supaya terasa langsung
    setPindah(true);
    const cadangan = kolom;
    setKolom(prev => prev.map(k => ({
      ...k,
      leads: k.status === statusBaru
        ? [{ ...lead, status_terakhir: statusBaru }, ...k.leads]
        : k.leads.filter(l => l.id !== lead.id),
    })));
    try {
      await api.updateLead(lead.id, { status_terakhir: statusBaru, catatan_riwayat: 'Dipindahkan lewat papan Kanban' });
      toast.success(`${lead.nama_prospek} → ${statusBaru}`);
    } catch (e) {
      setKolom(cadangan);
      toast.error(e instanceof Error ? e.message : 'Gagal memindahkan lead');
    } finally { setPindah(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Papan Kanban</h1>
          <p className="text-sm text-muted-foreground">
            {bolehLihatSemua ? 'Semua lead' : `Lead milik ${nama}`} · geser kartu antar kolom untuk mengubah status
            {pindah && <span className="ml-2 text-primary">menyimpan…</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {bolehLihatSemua && (
            <Select value={fSales} onValueChange={setFSales}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={SEMUA}>Semua sales</SelectItem>
                {(meta?.sales || []).filter(s => s.peran === 'Sales').map(s => <SelectItem key={s.nama} value={s.nama}>{s.nama}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={fKanal} onValueChange={setFKanal}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={SEMUA}>Semua kanal</SelectItem>
              {(meta?.kanal || []).map(k => <SelectItem key={k.kode} value={k.kode}>{k.kanal}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={muat} disabled={memuat}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${memuat ? 'animate-spin' : ''}`} />Muat ulang
          </Button>
        </div>
      </div>

      {memuat ? (
        <Card className="p-16 text-center text-muted-foreground">Memuat papan…</Card>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {kolom.map(k => (
              <div
                key={k.status}
                onDragOver={e => { e.preventDefault(); setDiAtas(k.status); }}
                onDragLeave={() => setDiAtas(s => (s === k.status ? null : s))}
                onDrop={() => jatuhkan(k.status)}
                className={`w-[268px] shrink-0 rounded-xl border bg-muted/30 transition-colors ${
                  diAtas === k.status ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="p-3 border-b bg-background/60 rounded-t-xl">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold leading-tight">{k.status}</p>
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted font-medium">{k.leads.length}</span>
                  </div>
                  {k.pemilik && <p className="text-[10px] text-muted-foreground mt-0.5">PIC: {k.pemilik}</p>}
                </div>

                <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">
                  {k.leads.length === 0 && (
                    <p className="text-[11px] text-muted-foreground text-center py-6">— kosong —</p>
                  )}
                  {k.leads.map(l => {
                    const gaya = KUALIFIKASI_STYLE[(l.kualifikasi || 'COLD') as Kualifikasi];
                    const boleh = bolehUbahBaris(l.sales);
                    return (
                      <div
                        key={l.id}
                        draggable={boleh}
                        onDragStart={() => setSeret(l)}
                        onDragEnd={() => { setSeret(null); setDiAtas(null); }}
                        onClick={() => navigate(`/crm/leads/${l.id}`)}
                        className={`group bg-background rounded-lg border p-2.5 space-y-1.5 transition-shadow hover:shadow-md ${
                          boleh ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer opacity-90'
                        } ${seret?.id === l.id ? 'opacity-40' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <p className="text-[13px] font-medium leading-snug">{l.nama_prospek}</p>
                          {boleh && <GripVertical className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <KualifikasiBadge nilai={l.kualifikasi} skor={l.skor} />
                          {l.kode_lead && <span className="text-[10px] font-mono text-muted-foreground">{l.kode_lead}</span>}
                        </div>
                        <div className="space-y-0.5 text-[11px] text-muted-foreground">
                          {l.kota && <p className="flex items-center gap-1"><MapPin className="w-3 h-3" />{l.kota}</p>}
                          {l.no_hp && <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{l.no_hp}</p>}
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5 border-t">
                          <span className="text-[10px] text-muted-foreground">{l.sales || '—'}</span>
                          {!!l.nilai_sph && <span className="text-[10px] font-medium tabular-nums">{formatRupiah(l.nilai_sph, true)}</span>}
                        </div>
                        {!boleh && <span className={`inline-block text-[10px] px-1.5 rounded ${gaya.bg} ${gaya.text}`}>read-only</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Lead berstatus <b>Gugur</b> tidak tampil di papan (wajib isi alasan gugur).{' '}
        {!bolehUbahSemua && 'Kartu milik sales lain hanya bisa dibaca.'}
      </p>
    </div>
  );
}
