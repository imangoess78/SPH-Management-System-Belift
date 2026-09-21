import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RefreshCw, CheckCircle2, XCircle, Clock3, ShieldCheck, Info } from 'lucide-react';
import { toast } from 'sonner';
import { api, type Lead, type RefDiskon } from '@/lib/crm-api';
import { formatRupiah } from '@/lib/crm-utils';
import { useCrmUser } from '@/hooks/useCrmUser';

export default function ApprovalDiskon() {
  const navigate = useNavigate();
  const { nama, peran, bolehUbahSemua, bolehUbahBaris } = useCrmUser();
  const [data, setData] = useState<Lead[]>([]);
  const [diskonRef, setDiskonRef] = useState<RefDiskon[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [putus, setPutus] = useState<{ lead: Lead; aksi: 'Setuju' | 'Tolak' } | null>(null);
  const [catatan, setCatatan] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [d, r] = await Promise.all([
        api.listLeads({ status: 'Menunggu Approval Diskon', limit: 200 }),
        api.listRef<RefDiskon>('ref_diskon'),
      ]);
      setData(d.data); setDiskonRef(r.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat'); }
    finally { setMemuat(false); }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const jenjang = (d: number | null) => {
    const v = Number(d || 0);
    return diskonRef.find(r => v > Number(r.batas_bawah) && v <= Number(r.batas_atas));
  };

  const proses = async () => {
    if (!putus) return;
    const { lead, aksi } = putus;
    // Hanya approver yang berhak (atau Manager/Direktur) yang boleh memutuskan
    const wajib = lead.approver_wajib || jenjang(lead.diskon_diminta)?.approver;
    if (!bolehUbahSemua && wajib !== nama) {
      toast.error(`Diskon ini wewenang ${wajib || 'approver lain'}`);
      return;
    }
    try {
      await api.updateLead(lead.id, {
        status_approval: aksi === 'Setuju' ? 'Disetujui' : 'Ditolak',
        tgl_approval: new Date().toISOString(),
        catatan_riwayat: `Approval diskon ${aksi} oleh ${nama}${catatan ? ` — ${catatan}` : ''}`,
        ...(aksi === 'Setuju'
          ? { status_terakhir: 'Deal - Menunggu Dokumen' }
          : { status_terakhir: 'Negosiasi' }),
      });
      toast.success(`Diskon ${aksi.toLowerCase()} untuk ${lead.nama_prospek}`);
      setPutus(null); setCatatan('');
      muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Approval Diskon</h1>
          <p className="text-sm text-muted-foreground">
            Pengajuan diskon berjenjang. Anda login sebagai <b>{nama}</b> ({peran}).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={muat} disabled={memuat}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${memuat ? 'animate-spin' : ''}`} />Muat ulang
        </Button>
      </div>

      {/* ── Jenjang kewenangan ── */}
      <Card className="p-4 space-y-2">
        <p className="text-sm font-semibold flex items-center gap-1.5"><ShieldCheck className="w-4 h-4" />Jenjang Kewenangan</p>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
          {diskonRef.map(r => {
            const sayaWenang = bolehUbahSemua || r.approver === nama;
            return (
              <div key={r.id} className={`rounded-lg border p-2.5 text-xs ${sayaWenang ? 'border-primary/40 bg-primary/5' : ''}`}>
                <p className="font-semibold">
                  {r.batas_bawah === 0 && r.batas_atas === 0 ? 'Tanpa diskon'
                    : `> ${(r.batas_bawah * 100).toFixed(0)}% – ${(r.batas_atas * 100).toFixed(0)}%`}
                </p>
                <p className="text-muted-foreground mt-0.5">{r.approver}</p>
                {sayaWenang && <p className="text-[10px] text-primary font-medium mt-1">← wewenang Anda</p>}
              </div>
            );
          })}
        </div>
      </Card>

      {memuat ? (
        <Card className="p-12 text-center text-muted-foreground">Memuat…</Card>
      ) : data.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          Tidak ada pengajuan diskon yang menunggu approval.
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map(l => {
            const j = jenjang(l.diskon_diminta);
            const wewenangSaya = bolehUbahSemua || l.approver_wajib === nama || j?.approver === nama;
            const nilaiAwal = l.nilai_sph ? l.nilai_sph / (1 - Number(l.diskon_diminta || 0)) : null;
            return (
              <Card key={l.id} className={`p-4 ${wewenangSaya ? 'border-primary/30' : ''}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <button className="text-left" onClick={() => navigate(`/crm/leads/${l.id}`)}>
                      <p className="font-semibold hover:underline">{l.nama_prospek}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{l.kode_lead} · {l.sales || '—'} · {l.kota || '—'}</p>
                    </button>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Diskon Diminta</p>
                        <p className="font-bold text-amber-600">{((Number(l.diskon_diminta) || 0) * 100).toFixed(1).replace('.', ',')}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Nilai Setelah Diskon</p>
                        <p className="font-medium tabular-nums">{formatRupiah(l.nilai_sph)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Nilai Sebelum Diskon</p>
                        <p className="tabular-nums">{formatRupiah(nilaiAwal)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Approver Wajib</p>
                        <p className="font-medium">{l.approver_wajib || j?.approver || '—'}</p>
                      </div>
                    </div>
                    {l.alasan_diskon && (
                      <p className="text-xs mt-2.5 rounded-lg bg-muted/50 border p-2">
                        <span className="text-muted-foreground">Alasan sales: </span>{l.alasan_diskon}
                      </p>
                    )}
                    {j?.catatan && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1">
                        <Info className="w-3 h-3 shrink-0 mt-0.5" />{j.catatan}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {wewenangSaya ? (
                      <>
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => { setPutus({ lead: l, aksi: 'Setuju' }); setCatatan(''); }}>
                          <CheckCircle2 className="w-4 h-4 mr-1.5" />Setujui
                        </Button>
                        <Button size="sm" variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50"
                          onClick={() => { setPutus({ lead: l, aksi: 'Tolak' }); setCatatan(''); }}>
                          <XCircle className="w-4 h-4 mr-1.5" />Tolak
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 px-2 py-1 rounded bg-muted">
                        <Clock3 className="w-3 h-3" />Menunggu {l.approver_wajib || j?.approver || 'approver'}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        <b>Setujui</b> → lead langsung berpindah ke status "Deal - Menunggu Dokumen" dan otomatis masuk antrean Meja Dokumen.
        <b> Tolak</b> → lead kembali ke "Negosiasi".
      </p>

      <Dialog open={!!putus} onOpenChange={o => !o && setPutus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{putus?.aksi === 'Setuju' ? 'Setujui' : 'Tolak'} Diskon — {putus?.lead.nama_prospek}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-muted/50 border p-3 text-sm space-y-1">
              <p className="flex justify-between"><span className="text-muted-foreground">Diskon</span>
                <b>{((Number(putus?.lead.diskon_diminta) || 0) * 100).toFixed(1).replace('.', ',')}%</b></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Nilai SPH setelah diskon</span>
                <b className="tabular-nums">{formatRupiah(putus?.lead.nilai_sph)}</b></p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catatan (opsional)</Label>
              <Input value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="Misal: disetujui, syarat DP 50%" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPutus(null)}>Batal</Button>
            <Button className={putus?.aksi === 'Setuju' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
              onClick={proses}>
              {putus?.aksi === 'Setuju' ? 'Ya, Setujui' : 'Ya, Tolak'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
