import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2, RefreshCw, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api, type RefKanal, type RefSales, type RefDiskon, type RefStatus } from '@/lib/crm-api';
import { useCrmUser } from '@/hooks/useCrmUser';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { KelompokBadge } from '@/components/crm/CrmBadges';

type Resource = 'ref_kanal' | 'ref_sales' | 'ref_diskon' | 'ref_status';

export default function CrmMaster() {
  const { bolehKelolaMaster } = useCrmUser();
  const [kanal, setKanal] = useState<RefKanal[]>([]);
  const [sales, setSales] = useState<RefSales[]>([]);
  const [diskon, setDiskon] = useState<RefDiskon[]>([]);
  const [status, setStatus] = useState<RefStatus[]>([]);
  const [memuat, setMemuat] = useState(true);

  const [dialog, setDialog] = useState<{ resource: Resource; baris: Record<string, unknown> | null } | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [hapus, setHapus] = useState<{ resource: Resource; id: string; label: string } | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [k, s, d, st] = await Promise.all([
        api.listRef<RefKanal>('ref_kanal'),
        api.listRef<RefSales>('ref_sales'),
        api.listRef<RefDiskon>('ref_diskon'),
        api.listRef<RefStatus>('ref_status'),
      ]);
      setKanal(k.data); setSales(s.data); setDiskon(d.data); setStatus(st.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat master data'); }
    finally { setMemuat(false); }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const buka = (resource: Resource, baris: Record<string, unknown> | null) => {
    setDialog({ resource, baris });
    setForm(baris ? { ...baris } : {});
  };

  const kunciBaris = (resource: Resource): string => {
    const baris = dialog?.baris;
    if (!baris) return '';
    if (resource === 'ref_kanal') return String(baris.kode);
    if (resource === 'ref_status') return String(baris.status);
    return String(baris.id);
  };

  const simpan = async () => {
    if (!dialog) return;
    const { resource, baris } = dialog;
    try {
      if (baris) await api.updateRef(resource, kunciBaris(resource), form);
      else await api.createRef(resource, form);
      toast.success('Tersimpan');
      setDialog(null); muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan'); }
  };

  const konfirmasiHapus = async () => {
    if (!hapus) return;
    try { await api.deleteRef(hapus.resource, hapus.id); toast.success('Dihapus'); setHapus(null); muat(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus'); }
  };

  const F = ({ k, label, tipe = 'text', pilihan }: { k: string; label: string; tipe?: string; pilihan?: string[] }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {pilihan ? (
        <Select value={String(form[k] ?? '')} onValueChange={v => setForm(p => ({ ...p, [k]: v }))}>
          <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
          <SelectContent>{pilihan.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
        </Select>
      ) : (
        <Input
          type={tipe}
          value={String(form[k] ?? '')}
          onChange={e => setForm(p => ({ ...p, [k]: tipe === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value }))}
        />
      )}
    </div>
  );

  if (!bolehKelolaMaster) {
    return (
      <Card className="p-10 text-center space-y-2">
        <Lock className="w-6 h-6 mx-auto text-muted-foreground" />
        <p className="font-medium">Master Data CRM hanya untuk Manager / Admin</p>
        <p className="text-sm text-muted-foreground">Hubungi Manager atau Admin Sistem untuk perubahan data referensi.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Master Data CRM</h1>
          <p className="text-sm text-muted-foreground">Data referensi modul CRM Sales — kanal, sales, jenjang diskon, dan status.</p>
        </div>
        <Button variant="outline" size="sm" onClick={muat} disabled={memuat}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${memuat ? 'animate-spin' : ''}`} />Muat ulang
        </Button>
      </div>

      <Tabs defaultValue="kanal">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="kanal">Kanal ({kanal.length})</TabsTrigger>
          <TabsTrigger value="sales">Sales ({sales.length})</TabsTrigger>
          <TabsTrigger value="diskon">Jenjang Diskon ({diskon.length})</TabsTrigger>
          <TabsTrigger value="status">Status ({status.length})</TabsTrigger>
        </TabsList>

        {/* ── KANAL ── */}
        <TabsContent value="kanal" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => buka('ref_kanal', null)}><Plus className="w-4 h-4 mr-1.5" />Tambah Kanal</Button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Kode</th>
                    <th className="text-left p-3 font-medium">Kelompok</th>
                    <th className="text-left p-3 font-medium">Kanal</th>
                    <th className="text-left p-3 font-medium">Keterangan</th>
                    <th className="text-left p-3 font-medium">Aktif</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {kanal.map(k => (
                    <tr key={k.kode} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{k.kode}</td>
                      <td className="p-3"><KelompokBadge kelompok={k.kelompok} /></td>
                      <td className="p-3">{k.kanal}</td>
                      <td className="p-3 text-xs text-muted-foreground">{k.keterangan || '—'}</td>
                      <td className="p-3 text-xs">{k.aktif ? 'Ya' : 'Tidak'}</td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => buka('ref_kanal', k as unknown as Record<string, unknown>)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => setHapus({ resource: 'ref_kanal', id: k.kode, label: k.kanal })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── SALES ── */}
        <TabsContent value="sales" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => buka('ref_sales', null)}><Plus className="w-4 h-4 mr-1.5" />Tambah Orang</Button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Nama</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Peran</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Wilayah</th>
                    <th className="text-right p-3 font-medium">Bobot</th>
                    <th className="text-right p-3 font-medium">Kuota</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map(s => (
                    <tr key={s.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{s.nama}</td>
                      <td className="p-3 text-xs text-muted-foreground">{s.email || '—'}</td>
                      <td className="p-3 text-xs">{s.peran}</td>
                      <td className="p-3 text-xs">{s.status}</td>
                      <td className="p-3 text-xs">{s.wilayah || '—'}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{s.bobot}</td>
                      <td className="p-3 text-right tabular-nums text-xs">{s.kuota_aktif}</td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => buka('ref_sales', s as unknown as Record<string, unknown>)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => setHapus({ resource: 'ref_sales', id: s.id, label: s.nama })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Peran menentukan hak akses di modul CRM: <b>Sales</b> hanya melihat lead sendiri, <b>Manager/Direktur</b> melihat semua.
            Kecocokan dilakukan lewat email akun login.
          </p>
        </TabsContent>

        {/* ── DISKON ── */}
        <TabsContent value="diskon" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => buka('ref_diskon', null)}><Plus className="w-4 h-4 mr-1.5" />Tambah Jenjang</Button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">Batas Bawah</th>
                    <th className="text-left p-3 font-medium">Batas Atas</th>
                    <th className="text-left p-3 font-medium">Approver</th>
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Dampak Margin</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {diskon.map(d => (
                    <tr key={d.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 text-xs">{(Number(d.batas_bawah) * 100).toFixed(0)}%</td>
                      <td className="p-3 text-xs">{(Number(d.batas_atas) * 100).toFixed(0)}%</td>
                      <td className="p-3 font-medium text-xs">{d.approver}</td>
                      <td className="p-3 text-xs text-muted-foreground">{d.email_approver || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{d.catatan || '—'}</td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => buka('ref_diskon', d as unknown as Record<string, unknown>)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => setHapus({ resource: 'ref_diskon', id: d.id, label: `Jenjang ${d.batas_bawah}-${d.batas_atas}` })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Isi batas dalam bentuk desimal: <b>0,03</b> = 3%. Approver wajib dihitung otomatis saat sales mengajukan diskon.
          </p>
        </TabsContent>

        {/* ── STATUS ── */}
        <TabsContent value="status" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => buka('ref_status', null)}><Plus className="w-4 h-4 mr-1.5" />Tambah Status</Button>
          </div>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-right p-3 font-medium">Urutan</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Pemilik</th>
                    <th className="text-left p-3 font-medium">Keterangan</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {status.map(s => (
                    <tr key={s.status} className="border-t hover:bg-muted/30">
                      <td className="p-3 text-right tabular-nums text-xs">{s.urutan}</td>
                      <td className="p-3 font-medium">{s.status}</td>
                      <td className="p-3 text-xs">{s.pemilik || '—'}</td>
                      <td className="p-3 text-xs text-muted-foreground">{s.keterangan || '—'}</td>
                      <td className="p-3">
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => buka('ref_status', s as unknown as Record<string, unknown>)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => setHapus({ resource: 'ref_status', id: s.status, label: s.status })}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Urutan menentukan susunan kolom di Papan Kanban. Status <b>Gugur</b> sebaiknya dibiarkan di urutan terakhir.
          </p>
        </TabsContent>
      </Tabs>

      {/* ── Dialog tambah/ubah ── */}
      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog?.baris ? 'Ubah' : 'Tambah'} {
                dialog?.resource === 'ref_kanal' ? 'Kanal'
                  : dialog?.resource === 'ref_sales' ? 'Orang'
                  : dialog?.resource === 'ref_diskon' ? 'Jenjang Diskon' : 'Status'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2 md:grid-cols-2">
            {dialog?.resource === 'ref_kanal' && <>
              <F k="kode" label="Kode Kanal" />
              <F k="kelompok" label="Kelompok" pilihan={['Organik', 'Paid', 'Affiliate', 'Offline', 'Lainnya']} />
              <F k="kanal" label="Nama Kanal" />
              <F k="urutan" label="Urutan" tipe="number" />
              <div className="md:col-span-2"><F k="keterangan" label="Keterangan" /></div>
              <F k="aktif" label="Aktif (1 = ya, 0 = tidak)" tipe="number" />
            </>}
            {dialog?.resource === 'ref_sales' && <>
              <F k="nama" label="Nama" />
              <F k="email" label="Email" />
              <F k="peran" label="Peran" pilihan={['Sales', 'Admin', 'Manager', 'Direktur']} />
              <F k="status" label="Status" pilihan={['Aktif', 'Nonaktif']} />
              <F k="wilayah" label="Wilayah Prioritas" />
              <F k="bobot" label="Bobot Distribusi" tipe="number" />
              <F k="kuota_aktif" label="Kuota Lead Aktif Maks" tipe="number" />
              <div className="md:col-span-2"><F k="catatan" label="Catatan" /></div>
            </>}
            {dialog?.resource === 'ref_diskon' && <>
              <F k="batas_bawah" label="Batas Bawah (0,03 = 3%)" tipe="number" />
              <F k="batas_atas" label="Batas Atas (0,08 = 8%)" tipe="number" />
              <F k="approver" label="Approver" pilihan={['Tidak Perlu', 'Sales Manager', 'Direktur Operasional', 'Direktur']} />
              <F k="email_approver" label="Email Approver" />
              <div className="md:col-span-2"><F k="catatan" label="Dampak Margin" /></div>
            </>}
            {dialog?.resource === 'ref_status' && <>
              <F k="status" label="Status" />
              <F k="urutan" label="Urutan" tipe="number" />
              <F k="pemilik" label="Pemilik Tahap" pilihan={['Sales', 'Admin', 'Operasional']} />
              <div className="md:col-span-2"><F k="keterangan" label="Keterangan" /></div>
            </>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
            <Button onClick={simpan}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!hapus}
        onOpenChange={o => !o && setHapus(null)}
        title="Hapus data referensi ini?"
        description={`"${hapus?.label || ''}" akan dihapus dari master data. Lead yang sudah memakai nilai ini tidak ikut berubah.`}
        onConfirm={konfirmasiHapus}
      />
    </div>
  );
}
