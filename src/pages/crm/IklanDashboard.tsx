import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RefreshCw, TrendingUp, TrendingDown, Wallet, Users, FileText, Handshake, Target, AlertTriangle, Plus, Trash2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend } from 'recharts';
import { api, type BarisKanal, type RingkasanIklan, type RefKanal, type BiayaIklan } from '@/lib/crm-api';
import { formatRupiah, labelPeriode } from '@/lib/crm-utils';
import { KelompokBadge } from '@/components/crm/CrmBadges';
import { useCrmUser } from '@/hooks/useCrmUser';

function persen(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${(v * 100).toFixed(1).replace('.', ',')}%`;
}

/** Pilih warna angka: makin kecil CPL makin bagus. */
function warnaBiaya(v: number | null): string {
  if (!v) return 'text-muted-foreground';
  return v > 1_000_000 ? 'text-rose-600' : v > 400_000 ? 'text-amber-600' : 'text-emerald-600';
}

function Kartu({ judul, nilai, sub, ikon, warna }: { judul: string; nilai: string; sub?: string; ikon: React.ReactNode; warna?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{judul}</p>
        <span className="text-muted-foreground/60">{ikon}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums mt-1 ${warna || ''}`}>{nilai}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function IklanDashboard() {
  const { bolehKelolaMaster } = useCrmUser();
  const [periode, setPeriode] = useState(new Date().toISOString().slice(0, 7));
  const [ringkasan, setRingkasan] = useState<RingkasanIklan | null>(null);
  const [perKanal, setPerKanal] = useState<BarisKanal[]>([]);
  const [kanalRef, setKanalRef] = useState<RefKanal[]>([]);
  const [biayaList, setBiayaList] = useState<BiayaIklan[]>([]);
  const [memuat, setMemuat] = useState(true);

  const [dialog, setDialog] = useState(false);
  const [formKanal, setFormKanal] = useState('');
  const [formBiaya, setFormBiaya] = useState('');
  const [formCatatan, setFormCatatan] = useState('');

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const [d, k, b] = await Promise.all([
        api.dashboard(periode),
        api.listRef<RefKanal>('ref_kanal'),
        api.listRef<BiayaIklan>('biaya_iklan', { periode }),
      ]);
      setRingkasan(d.ringkasan);
      setPerKanal(d.per_kanal);
      setKanalRef(k.data);
      setBiayaList(b.data);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal memuat dashboard'); }
    finally { setMemuat(false); }
  }, [periode]);

  useEffect(() => { muat(); }, [muat]);

  const pilihanPeriode = useMemo(() => {
    const out: string[] = [];
    const d = new Date();
    for (let i = 0; i < 18; i++) {
      out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() - 1);
    }
    return out;
  }, []);

  /** Data grafik: kanal berbayar + organik, dibandingkan jumlah lead & CPL. */
  const dataGrafik = useMemo(() => perKanal
    .filter(k => k.jml_lead > 0)
    .slice(0, 10)
    .map(k => ({ nama: k.nama_kanal.replace(/^(Google Ads|Meta Ads|TikTok Ads) - /, '$1\n'), lead: k.jml_lead, deal: k.jml_deal })), [perKanal]);

  const totalBiayaTerinput = biayaList.reduce((t, b) => t + Number(b.biaya), 0);

  const simpanBiaya = async () => {
    if (!formKanal) { toast.error('Pilih kanal dulu'); return; }
    const nilai = Number(formBiaya.replace(/\D/g, ''));
    if (!nilai) { toast.error('Isi jumlah biaya'); return; }
    try {
      // Kalau kanal + periode sudah ada, perbarui — jangan bikin baris ganda
      const ada = biayaList.find(b => b.kode_kanal === formKanal);
      if (ada) await api.updateRef('biaya_iklan', ada.id, { biaya: nilai, catatan: formCatatan });
      else await api.createRef('biaya_iklan', { periode, kode_kanal: formKanal, biaya: nilai, catatan: formCatatan });
      toast.success('Biaya iklan tersimpan');
      setDialog(false); setFormKanal(''); setFormBiaya(''); setFormCatatan('');
      muat();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menyimpan'); }
  };

  const hapusBiaya = async (id: string) => {
    try { await api.deleteRef('biaya_iklan', id); toast.success('Biaya dihapus'); muat(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Gagal menghapus'); }
  };

  const kanalBerbayar = perKanal.filter(k => k.kelompok === 'Paid');
  const kanalOrganik = perKanal.filter(k => k.kelompok !== 'Paid');

  return (
    <div className="space-y-4">
      {/* ── Judul ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Efektivitas Iklan</h1>
          <p className="text-sm text-muted-foreground">
            Berapa biaya yang keluar untuk setiap lead, penawaran, dan deal — per kanal.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Select value={periode} onValueChange={setPeriode}>
            <SelectTrigger className="h-9 min-w-[150px] flex-1 sm:w-[180px] sm:flex-none"><SelectValue /></SelectTrigger>
            <SelectContent>
              {pilihanPeriode.map(p => <SelectItem key={p} value={p}>{labelPeriode(p)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={muat} disabled={memuat} className="shrink-0">
            <RefreshCw className={`w-4 h-4 mr-1.5 ${memuat ? 'animate-spin' : ''}`} />Muat ulang
          </Button>
          {bolehKelolaMaster && (
            <Button size="sm" onClick={() => setDialog(true)} className="shrink-0 whitespace-nowrap">
              <Plus className="w-4 h-4 mr-1.5" />Input Biaya Iklan
            </Button>
          )}
        </div>
      </div>

      {/* ── Peringatan data kurang ── */}
      {!!ringkasan?.lead_tanpa_nilai && (
        <Card className="p-3 border-amber-300 bg-amber-50 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900">
            <p className="font-semibold">{ringkasan.lead_tanpa_nilai} lead sudah dapat penawaran tapi Nilai SPH masih kosong.</p>
            <p className="mt-0.5">
              Angka <b>Nilai Deal</b> dan <b>ROAS</b> di bawah belum menghitung lead tersebut. Lengkapi Nilai SPH di halaman Leads supaya laporannya utuh.
            </p>
          </div>
        </Card>
      )}

      {totalBiayaTerinput === 0 && !memuat && (
        <Card className="p-3 border-sky-300 bg-sky-50 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <p className="text-xs text-sky-900">
            Belum ada biaya iklan untuk <b>{labelPeriode(periode)}</b>. Klik <b>Input Biaya Iklan</b> untuk mengisi
            pengeluaran per kanal — tanpa ini, CPL dan CAC tidak bisa dihitung.
          </p>
        </Card>
      )}

      {/* ── Ringkasan ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kartu judul="Total Biaya Iklan" nilai={formatRupiah(ringkasan?.total_biaya, true)} sub={labelPeriode(periode)} ikon={<Wallet className="w-4 h-4" />} />
        <Kartu judul="Total Lead" nilai={String(ringkasan?.total_lead ?? 0)} sub={`${ringkasan?.total_sph ?? 0} dapat penawaran · ${ringkasan?.total_deal ?? 0} deal`} ikon={<Users className="w-4 h-4" />} />
        <Kartu judul="CPL — Biaya per Lead" nilai={formatRupiah(ringkasan?.cpl, true)} sub="biaya iklan ÷ jumlah lead" ikon={<Target className="w-4 h-4" />} warna={warnaBiaya(ringkasan?.cpl ?? null)} />
        <Kartu judul="CAC — Biaya per Deal" nilai={formatRupiah(ringkasan?.cac, true)} sub="biaya iklan ÷ jumlah deal" ikon={<Handshake className="w-4 h-4" />} warna={warnaBiaya(ringkasan?.cac ?? null)} />
        <Kartu judul="Konversi SPH" nilai={persen(ringkasan?.konversi_sph)} sub="lead → dapat penawaran" ikon={<FileText className="w-4 h-4" />} />
        <Kartu judul="Konversi Deal" nilai={persen(ringkasan?.konversi_deal)} sub="lead → SPK ditandatangani" ikon={<Handshake className="w-4 h-4" />} />
        <Kartu judul="Nilai Deal" nilai={formatRupiah(ringkasan?.nilai_deal, true)} sub="total nilai SPK (manual)" ikon={<TrendingUp className="w-4 h-4" />} />
        <Kartu
          judul="ROAS" nilai={ringkasan?.roas ? `${ringkasan.roas.toFixed(2).replace('.', ',')}×` : '—'}
          sub={ringkasan?.roas ? (ringkasan.roas >= 1 ? 'untung — nilai deal melebihi biaya' : 'belum balik modal iklan') : 'butuh biaya + nilai deal'}
          ikon={ringkasan?.roas && ringkasan.roas >= 1 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          warna={ringkasan?.roas ? (ringkasan.roas >= 1 ? 'text-emerald-600' : 'text-rose-600') : ''}
        />
      </div>

      {/* ── Grafik ── */}
      {dataGrafik.length > 0 && (
        <Card className="p-4">
          <p className="text-sm font-semibold mb-3">Lead & Deal per Kanal — {labelPeriode(periode)}</p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dataGrafik} margin={{ top: 4, right: 8, left: -16, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nama" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} height={60} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <RTooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="lead" name="Jumlah Lead" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="deal" name="Deal (SPK)" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* ── Tabel per kanal ── */}
      <Card className="overflow-hidden">
        <div className="p-4 pb-3">
          <p className="text-sm font-semibold">Rincian per Kanal</p>
          <p className="text-xs text-muted-foreground">CPL hijau = murah, merah = mahal (acuan cepat).</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3 font-medium">Kanal</th>
                <th className="text-left p-3 font-medium">Kelompok</th>
                <th className="text-right p-3 font-medium">Lead</th>
                <th className="text-right p-3 font-medium">HOT</th>
                <th className="text-right p-3 font-medium">SPH</th>
                <th className="text-right p-3 font-medium">Deal</th>
                <th className="text-right p-3 font-medium">Biaya</th>
                <th className="text-right p-3 font-medium">CPL</th>
                <th className="text-right p-3 font-medium">CAC</th>
                <th className="text-right p-3 font-medium">Konv. Deal</th>
                <th className="text-right p-3 font-medium">Nilai Deal</th>
                <th className="text-right p-3 font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {memuat && <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">Memuat…</td></tr>}
              {!memuat && perKanal.length === 0 && (
                <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">
                  Belum ada lead masuk di {labelPeriode(periode)}.
                </td></tr>
              )}
              {!memuat && perKanal.map(k => (
                <tr key={k.kode_kanal} className="border-t hover:bg-muted/30">
                  <td className="p-3">
                    <p className="font-medium">{k.nama_kanal}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{k.kode_kanal}</p>
                  </td>
                  <td className="p-3"><KelompokBadge kelompok={k.kelompok} /></td>
                  <td className="p-3 text-right tabular-nums">{k.jml_lead}</td>
                  <td className="p-3 text-right tabular-nums text-red-600">{k.jml_hot}</td>
                  <td className="p-3 text-right tabular-nums">{k.jml_sph}</td>
                  <td className="p-3 text-right tabular-nums font-medium">{k.jml_deal}</td>
                  <td className="p-3 text-right tabular-nums">{k.biaya ? formatRupiah(k.biaya, true) : <span className="text-muted-foreground">—</span>}</td>
                  <td className={`p-3 text-right tabular-nums font-medium ${warnaBiaya(k.cpl)}`}>{formatRupiah(k.cpl, true)}</td>
                  <td className={`p-3 text-right tabular-nums ${warnaBiaya(k.cac)}`}>{formatRupiah(k.cac, true)}</td>
                  <td className="p-3 text-right tabular-nums">{persen(k.konversi_deal)}</td>
                  <td className="p-3 text-right tabular-nums">{k.nilai_deal ? formatRupiah(k.nilai_deal, true) : <span className="text-muted-foreground">—</span>}</td>
                  <td className={`p-3 text-right tabular-nums font-medium ${k.roas ? (k.roas >= 1 ? 'text-emerald-600' : 'text-rose-600') : 'text-muted-foreground'}`}>
                    {k.roas ? `${k.roas.toFixed(2).replace('.', ',')}×` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ringkasan cepat berbayar vs organik */}
        {!memuat && (kanalBerbayar.length > 0 || kanalOrganik.length > 0) && (
          <div className="grid md:grid-cols-2 gap-3 p-4 border-t bg-muted/20">
            <div>
              <p className="text-xs font-semibold mb-1.5">Kanal Berbayar (Paid)</p>
              <p className="text-xs text-muted-foreground">
                {kanalBerbayar.reduce((t, k) => t + k.jml_lead, 0)} lead · biaya {formatRupiah(kanalBerbayar.reduce((t, k) => t + k.biaya, 0), true)} ·
                {' '}CPL rata-rata {formatRupiah(
                  kanalBerbayar.reduce((t, k) => t + k.jml_lead, 0)
                    ? kanalBerbayar.reduce((t, k) => t + k.biaya, 0) / kanalBerbayar.reduce((t, k) => t + k.jml_lead, 0)
                    : null, true)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-1.5">Kanal Organik & Lainnya</p>
              <p className="text-xs text-muted-foreground">
                {kanalOrganik.reduce((t, k) => t + k.jml_lead, 0)} lead ·
                {' '}{kanalOrganik.reduce((t, k) => t + k.jml_deal, 0)} deal
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Daftar biaya terinput ── */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Biaya Iklan Terinput — {labelPeriode(periode)}</p>
          <p className="text-sm font-bold tabular-nums">{formatRupiah(totalBiayaTerinput)}</p>
        </div>
        {biayaList.length === 0 ? (
          <p className="text-xs text-muted-foreground">Belum ada biaya untuk periode ini.</p>
        ) : (
          <div className="space-y-1.5">
            {biayaList.map(b => {
              const k = kanalRef.find(x => x.kode === b.kode_kanal);
              return (
                <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{k?.kanal || b.kode_kanal}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{b.kode_kanal}{b.catatan ? ` · ${b.catatan}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="tabular-nums font-medium">{formatRupiah(b.biaya)}</span>
                    {bolehKelolaMaster && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => hapusBiaya(b.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        <b>Cara baca:</b> CPL = biaya iklan ÷ jumlah lead. CAC = biaya iklan ÷ jumlah deal.
        ROAS = nilai deal ÷ biaya iklan. Angka deal dihitung dari lead berstatus
        "SPK Ditandatangani + DP" ke atas.
      </p>

      {/* ── Dialog input biaya ── */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Input Biaya Iklan — {labelPeriode(periode)}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Kanal</Label>
              <Select value={formKanal} onValueChange={setFormKanal}>
                <SelectTrigger><SelectValue placeholder="Pilih kanal" /></SelectTrigger>
                <SelectContent>
                  {kanalRef.filter(k => k.aktif).map(k => (
                    <SelectItem key={k.kode} value={k.kode}>{k.kanal} · {k.kelompok}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Biaya (Rp)</Label>
              <Input inputMode="numeric" value={formBiaya} onChange={e => setFormBiaya(e.target.value)} placeholder="15000000" />
              {!!formBiaya && <p className="text-[11px] text-muted-foreground">{formatRupiah(Number(formBiaya.replace(/\D/g, '')))}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Catatan (opsional)</Label>
              <Input value={formCatatan} onChange={e => setFormCatatan(e.target.value)} placeholder="Spend Meta Ads Oktober" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Batal</Button>
            <Button onClick={simpanBiaya}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
