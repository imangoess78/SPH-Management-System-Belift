import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Clock3, CheckCircle2, AlertTriangle, Timer, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, type DokumenRow, type RefSales, type Lead } from '@/lib/crm-api';
import { ConfirmDialog } from '@/components/ConfirmDialog';

const JENIS = ['SPH', 'SPK Induk', 'Lampiran Teknis', 'Gambar Kerja', 'Lainnya'];

function jamKeTeks(jam: number | null | undefined): string {
  if (jam === null || jam === undefined) return '—';
  if (jam < 24) return `${jam.toFixed(1).replace('.', ',')} jam`;
  return `${(jam / 24).toFixed(1).replace('.', ',')} hari`;
}

function waktuRingkas(v: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v).slice(0, 16).replace('T', ' ');
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Sisa waktu menuju batas SLA. */
function sisaSla(d: DokumenRow): { teks: string; lewat: boolean } | null {
  if (d.selesai || !d.target_selesai) return null;
  const target = new Date(d.target_selesai).getTime();
  if (isNaN(target)) return null;
  const sisaJam = (target - Date.now()) / 3_600_000;
  if (sisaJam < 0) return { teks: `Lewat ${jamKeTeks(-sisaJam)}`, lewat: true };
  return { teks: `Sisa ${jamKeTeks(sisaJam)}`, lewat: false };
}

export default function Dokumen() {
  const navigate = useNavigate();
  const [data, setData] = useState<DokumenRow[]>([]);
  const [salesRef, setSalesRef] = useState<RefSales[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [hapus, setHapus] = useState<DokumenRow | null>(null);
  const [leadPilihan, setLeadPilihan] = useState<Lead[]>([]);

  const [fJenis, setFJenis] = useState('');
  const [fLead, setFLead] = useState('');
  const [fSla, setFSla] = useState('24');
  const [fPic, setFPic] = useState('');
  const [fCatatan, setFCatatan] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [d, s] = await Promise.all([api.listDokumen(), api.listRef<RefSales>('ref_sales')]);
      setData(d.data); setSalesRef(s.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat antrean'); }
    finally { setMemuat(false); }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  useEffect(() => {
    if (!dialog) return;
    api.listLeads({ status: 'Deal - Menunggu Dokumen', limit: 100 })
      .then(r => setLeadPilihan(r.data)).catch(() => setLeadPilihan([]));
  }, [dialog]);

  const tandaiSelesai = async (d: DokumenRow) => {
    try {
      await api.updateDokumen(d.id, { selesai: new Date().toISOString() });
      toast.success('Dokumen ditandai selesai');
      muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan'); }
  };

  const simpan = async () => {
    if (!fLead) { toast.error('Pilih lead dulu'); return; }
    if (!fJenis) { toast.error('Pilih jenis dokumen'); return; }
    const now = new Date();
    const sla = Number(fSla) || 24;
    try {
      await api.createDokumen({
        id_lead: fLead, jenis_dokumen: fJenis,
        masuk_meja: now.toISOString(),
        sla_jam: sla,
        target_selesai: new Date(now.getTime() + sla * 3_600_000).toISOString(),
        status_sla: 'Menunggu diproses',
        pic_admin: fPic || null, catatan: fCatatan || null,
      });
      toast.success('Dokumen masuk antrean');
      setDialog(false); setFLead(''); setFJenis(''); setFCatatan(''); setFPic('');
      muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan'); }
  };

  const konfirmasiHapus = async () => {
    if (!hapus) return;
    try { await api.deleteDokumen(hapus.id); toast.success('Dihapus'); setHapus(null); muat(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus'); }
  };

  const menunggu = data.filter(d => !d.selesai);
  const lewatSla = menunggu.filter(d => sisaSla(d)?.lewat);
  const selesai = data.filter(d => d.selesai);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Meja Dokumen</h1>
          <p className="text-sm text-muted-foreground">Antrean penerbitan SPK & lampiran. SLA standar 24 jam.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={muat} disabled={memuat}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${memuat ? 'animate-spin' : ''}`} />Muat ulang
          </Button>
          <Button size="sm" onClick={() => setDialog(true)}><Plus className="w-4 h-4 mr-1.5" />Tambah Dokumen</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" />Menunggu</p>
          <p className="text-2xl font-bold">{menunggu.length}</p>
        </Card>
        <Card className={`p-3 ${lewatSla.length ? 'border-rose-300 bg-rose-50' : ''}`}>
          <p className="text-xs text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5 text-rose-500" />Lewat SLA</p>
          <p className="text-2xl font-bold text-rose-600">{lewatSla.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />Selesai</p>
          <p className="text-2xl font-bold text-emerald-600">{selesai.length}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Lead</th>
                <th className="text-left p-3 font-medium">Jenis</th>
                <th className="text-left p-3 font-medium">Masuk Meja</th>
                <th className="text-left p-3 font-medium">SLA</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">PIC</th>
                <th className="text-left p-3 font-medium">No. Terbit</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {memuat && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Memuat…</td></tr>}
              {!memuat && data.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Belum ada dokumen di antrean. Baris otomatis muncul saat lead berstatus
                  <b> "Deal - Menunggu Dokumen"</b>.
                </td></tr>
              )}
              {!memuat && data.map(d => {
                const sisa = sisaSla(d);
                return (
                  <tr key={d.id} className={`border-t hover:bg-muted/30 ${sisa?.lewat ? 'bg-rose-50/50' : ''}`}>
                    <td className="p-3">
                      <button className="text-left hover:underline" onClick={() => navigate(`/crm/leads/${d.id_lead}`)}>
                        <p className="font-medium">{d.nama_prospek || '(lead dihapus)'}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{d.kode_lead || '—'} · {d.sales || '—'}</p>
                      </button>
                    </td>
                    <td className="p-3 text-xs">{d.jenis_dokumen || '—'}</td>
                    <td className="p-3 text-xs whitespace-nowrap">{waktuRingkas(d.masuk_meja)}</td>
                    <td className="p-3 text-xs whitespace-nowrap">
                      <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{d.sla_jam ?? 24} jam</span>
                    </td>
                    <td className="p-3 text-xs">
                      {d.selesai ? (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          d.status_sla === 'Melebihi SLA'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          <CheckCircle2 className="w-3 h-3" />
                          {d.status_sla || 'Selesai'} · {jamKeTeks(d.lama_jam)}
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
                          sisa?.lewat ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-sky-50 text-sky-700 border-sky-200'}`}>
                          <Clock3 className="w-3 h-3" />{sisa?.teks || 'Berjalan'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-xs">{d.pic_admin || '—'}</td>
                    <td className="p-3 text-xs font-mono">{d.no_dokumen_terbit || '—'}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-end">
                        {!d.selesai && (
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => tandaiSelesai(d)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Selesai
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setHapus(d)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        <b>Lama jam</b> dan <b>status SLA</b> dihitung otomatis dari selisih waktu masuk meja ke waktu selesai.
      </p>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tambah Dokumen ke Antrean</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Lead</Label>
              <Select value={fLead} onValueChange={setFLead}>
                <SelectTrigger><SelectValue placeholder="Pilih lead" /></SelectTrigger>
                <SelectContent>
                  {leadPilihan.length === 0 && <SelectItem value="__kosong__" disabled>Belum ada lead berstatus "Deal - Menunggu Dokumen"</SelectItem>}
                  {leadPilihan.map(l => (
                    <SelectItem key={l.id} value={l.id}>{l.kode_lead} — {l.nama_prospek}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Jenis Dokumen</Label>
              <Select value={fJenis} onValueChange={setFJenis}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis" /></SelectTrigger>
                <SelectContent>{JENIS.map(j => <SelectItem key={j} value={j}>{j}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">SLA (jam)</Label>
                <Input inputMode="numeric" value={fSla} onChange={e => setFSla(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PIC Admin</Label>
                <Select value={fPic} onValueChange={setFPic}>
                  <SelectTrigger><SelectValue placeholder="Pilih PIC" /></SelectTrigger>
                  <SelectContent>
                    {salesRef.filter(s => s.peran !== 'Sales').map(s => <SelectItem key={s.id} value={s.nama}>{s.nama}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catatan</Label>
              <Input value={fCatatan} onChange={e => setFCatatan(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Batal</Button>
            <Button onClick={simpan}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!hapus}
        onOpenChange={o => !o && setHapus(null)}
        title="Hapus dokumen ini?"
        description={`Dokumen "${hapus?.jenis_dokumen || ''}" untuk ${hapus?.nama_prospek || ''} akan dihapus dari antrean.`}
        onConfirm={konfirmasiHapus}
      />
    </div>
  );
}
