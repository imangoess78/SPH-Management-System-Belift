import { Link } from 'react-router-dom';
import { FileText, PlusCircle, TrendingUp, Clock, ClipboardList, Lock, Factory, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadDocumentList, formatDate } from '@/lib/sph-utils';
import { muatBahanAlur, TAHAP, type BahanAlur } from '@/lib/alur';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Same SPK filter as SPKList.tsx
function isSPK(doc: any): boolean {
  const number = String(doc.nomor_sph || doc.nomorSPH || '').toUpperCase();
  if (number.includes('/SPK/')) return true;
  const specs: any[] = doc.specs || [];
  const ds = specs.find((s: any) => s.key === '__docstate');
  if (ds) {
    try {
      const parsed = JSON.parse(ds.value);
      return parsed.mode === 'SPK';
    } catch { /* ignore */ }
  }
  return String(doc.perihal || '').includes('SPK');
}

function isSPH(doc: any): boolean {
  // Nomor surat adalah sumber klasifikasi utama. Dokumen lama seperti
  // 001/SPH/... dapat memiliki __docstate tanpa field mode atau mode yang
  // tidak sinkron, sehingga jangan sampai hilang dari Dashboard.
  const number = String(doc.nomor_sph || doc.nomorSPH || '').toUpperCase();
  if (number.includes('/SPH/')) return true;
  if (number.includes('/SPK/')) return false;

  const specs: any[] = doc.specs || [];
  const ds = specs.find((s: any) => s.key === '__docstate');
  if (ds) {
    try {
      const parsed = JSON.parse(ds.value);
      if (parsed.mode === 'SPH') return true;
      if (parsed.mode === 'SPK') return false;
    } catch { /* ignore */ }
  }
  // Docs without __docstate that aren't SPK are treated as SPH
  return !isSPK(doc);
}

// The generator stores the selected sales name as `sales` inside __docstate,
// while older documents may expose it directly as namaSales/nama_sales.
function getSalesName(doc: any): string {
  const directName = doc.namaSales || doc.nama_sales || doc.sales || doc.sales_name;
  if (typeof directName === 'string' && directName.trim()) return directName.trim();

  const specs: any[] = Array.isArray(doc.specs) ? doc.specs : [];
  const docState = specs.find((spec: any) => spec.key === '__docstate');
  if (docState?.value) {
    try {
      const parsed = JSON.parse(docState.value);
      const savedName = parsed.sales || parsed.namaSales || parsed.nama_sales || parsed.state?.sales;
      if (typeof savedName === 'string' && savedName.trim()) return savedName.trim();
    } catch { /* ignore malformed legacy docstate */ }
  }

  return 'Tidak ada nama';
}

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/** Kartu tahap alur — jadi tautan hanya bila pengguna boleh membuka halaman itu. */
function KartuAlur({ ke, aktif, className, children }: {
  ke: string; aktif: boolean; className?: string; children: React.ReactNode;
}) {
  if (!aktif) return <div className={className}>{children}</div>;
  return <Link to={ke} className={className}>{children}</Link>;
}

const Index = () => {
  const [allDocs, setAllDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();

  // Separate month/year selectors for SPH and SPK charts
  const [sphMonth, setSphMonth] = useState(today.getMonth());
  const [sphYear, setSphYear] = useState(today.getFullYear());
  const [spkMonth, setSpkMonth] = useState(today.getMonth());
  const [spkYear, setSpkYear] = useState(today.getFullYear());

  useEffect(() => {
    loadDocumentList().then(list => {
      setAllDocs(list);
      setLoading(false);
    });
  }, []);

  // Alur proyek (Survey → Final Survey → PO) dimuat terpisah dari daftar
  // SPH/SPK supaya kegagalan salah satu sumber tidak mengosongkan seluruh
  // Dasbor.
  const [alur, setAlur] = useState<BahanAlur | null>(null);
  useEffect(() => {
    muatBahanAlur().then(setAlur).catch(() => setAlur(null));
  }, []);

  // Survey & PO sementara hanya untuk admin (lihat catatan di App.tsx).
  // Tautan ke modul itu disembunyikan supaya peran lain tidak dilempar
  // balik ke Dasbor saat mengklik.
  //
  // Kartu "1. Lead Baru" sebelumnya SELALU jadi tautan (`aktif={true}`),
  // padahal halaman /crm/leads hanya boleh dibuka peran ber-izin `crm`.
  // Akibatnya staf (tanpa `crm`) yang mengklik kartu itu langsung dilempar
  // balik ke Dasbor tanpa penjelasan — persis bug yang sama seperti kartu
  // Survey/PO di atas. Sekarang mengikuti izin yang sebenarnya.
  const { izin: daftarIzin } = useAuth();
  const bolehLihat = (kunci: string) => daftarIzin.includes(kunci) || daftarIzin.includes('*');

  // Split into SPH / SPK
  const sphList = useMemo(() => allDocs.filter(isSPH), [allDocs]);
  const spkList = useMemo(() => allDocs.filter(isSPK), [allDocs]);

  // SPH stats
  const totalSPH = sphList.length;
  const sphDraft = sphList.filter(s => s.status === 'draft').length;
  const sphFinal = sphList.filter(s => s.status === 'final').length;
  const recentSPH = sphList.slice(0, 5);

  // SPK stats
  const totalSPK = spkList.length;
  const spkDraft = spkList.filter(s => s.status === 'draft').length;
  const spkFinal = spkList.filter(s => s.status === 'final').length;
  const recentSPK = spkList.slice(0, 5);

  // SPH chart data
  const sphFiltered = useMemo(() => sphList.filter(s => {
    const d = new Date(s.tanggal);
    return d.getMonth() === sphMonth && d.getFullYear() === sphYear;
  }), [sphList, sphMonth, sphYear]);

  const sphSalesStats = useMemo(() => {
    const map = new Map<string, { sales: string; total: number; final: number }>();
    sphFiltered.forEach(s => {
      const key = getSalesName(s);
      const row = map.get(key) || { sales: key, total: 0, final: 0 };
      row.total += 1;
      if (s.status === 'final') row.final += 1;
      map.set(key, row);
    });
    return Array.from(map.values()).map(r => ({
      ...r, successRate: r.total ? Math.round((r.final / r.total) * 100) : 0,
    }));
  }, [sphFiltered]);

  const sphOverallRate = useMemo(() => {
    const total = sphFiltered.length;
    const finals = sphFiltered.filter(s => s.status === 'final').length;
    return total ? Math.round((finals / total) * 100) : 0;
  }, [sphFiltered]);

  // SPK chart data
  const spkFiltered = useMemo(() => spkList.filter(s => {
    const d = new Date(s.tanggal);
    return d.getMonth() === spkMonth && d.getFullYear() === spkYear;
  }), [spkList, spkMonth, spkYear]);

  const spkSalesStats = useMemo(() => {
    const map = new Map<string, { sales: string; total: number; final: number }>();
    spkFiltered.forEach(s => {
      const key = getSalesName(s);
      const row = map.get(key) || { sales: key, total: 0, final: 0 };
      row.total += 1;
      if (s.status === 'final') row.final += 1;
      map.set(key, row);
    });
    return Array.from(map.values()).map(r => ({
      ...r, successRate: r.total ? Math.round((r.final / r.total) * 100) : 0,
    }));
  }, [spkFiltered]);

  const spkOverallRate = useMemo(() => {
    const total = spkFiltered.length;
    const finals = spkFiltered.filter(s => s.status === 'final').length;
    return total ? Math.round((finals / total) * 100) : 0;
  }, [spkFiltered]);

  const yearOptions = Array.from({ length: 5 }).map((_, i) => today.getFullYear() - 2 + i);

  return (
    <div>
      {/* Page header + action buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Selamat datang di SPH Management System</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link to="/sph/new" className="w-full sm:w-auto">
            <Button className="gap-2 w-full sm:w-auto justify-center">
              <PlusCircle className="w-4 h-4" /> Buat SPH Baru
            </Button>
          </Link>
          <Link to="/spk/new" className="w-full sm:w-auto">
            <Button className="gap-2 w-full sm:w-auto justify-center bg-purple-600 hover:bg-purple-700 text-white border-0">
              <PlusCircle className="w-4 h-4" /> Buat SPK Baru
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Alur Proyek ────────────────────────────────────────── */}
      {alur && (
        <>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Alur Proyek</p>
          {/*
            Setiap kartu hanya muncul bila peran ini MEMANG boleh membaca
            datanya. Sebelumnya semua kartu selalu tampil, sehingga staf
            melihat "1. Lead Baru: 0" (padahal lead-nya ada — `/api/crm`
            menolak staf) dan sales melihat "5. PO Pabrik: 0" (padahal
            `/api/po` menolak sales). Angka nol palsu lebih berbahaya
            daripada kartu yang tidak ada: tidak ada yang sadar itu salah.
          */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-3">
            {bolehLihat('crm') && (
              <KartuAlur ke="/crm/leads" aktif={true} className="rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">1. Lead Baru</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1.5">{alur.angka.leadTotal}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-destructive font-medium">{alur.angka.leadHot} HOT</span>
                  {' · '}{alur.angka.leadWarm} WARM
                  {' · '}{alur.angka.leadGugur} gugur
                </p>
              </KartuAlur>
            )}

            {bolehLihat('survey_sales') && (
              <KartuAlur ke="/survey/sales" aktif={true} className="rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">2. Survey Sales</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1.5">{alur.angka.surveySales}</p>
                <p className="text-xs text-muted-foreground">
                  {alur.angka.surveySalesSelesai} selesai
                  {' · '}{alur.angka.surveySales - alur.angka.surveySalesSelesai} draft
                </p>
              </KartuAlur>
            )}

            {bolehLihat('sph') && (
              <KartuAlur ke="/sph" aktif={true} className="rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">3. SPH / SPK</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1.5">
                  {alur.angka.sph}<span className="text-base font-normal text-muted-foreground"> SPH</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {alur.angka.spk} SPK · {alur.angka.sphFinal} SPH final
                </p>
              </KartuAlur>
            )}

            {bolehLihat('survey_final') && (
              <KartuAlur ke="/survey/final" aktif={true} className="rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">4. Final Survey</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1.5">{alur.angka.finalSurvey}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="text-success font-medium">{alur.angka.finalTerkunci} terkunci</span>
                  {' · '}{alur.angka.finalDraft} draft
                </p>
              </KartuAlur>
            )}

            {bolehLihat('po') && (
              <KartuAlur ke="/po" aktif={true} className="rounded-lg border border-border bg-card p-3 hover:border-primary/50 transition-colors">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Factory className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">5. PO Pabrik</span>
                </div>
                <p className="text-2xl font-bold text-foreground mt-1.5">{alur.angka.poTotal}</p>
                <p className="text-xs text-muted-foreground">
                  {alur.angka.poTerbit} terbit
                  {alur.angka.jmlRevisi > 0 && <> · {alur.angka.jmlRevisi} revisi</>}
                </p>
              </KartuAlur>
            )}
          </div>

          {/* Peringatan: data berubah setelah Final Survey dikunci */}
          {alur.angka.poPerluTinjau > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 mb-6">
              <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-amber-900">
                  {alur.angka.poPerluTinjau} proyek berubah setelah Final Survey dikunci
                </p>
                <p className="text-amber-800 mt-0.5">
                  Data teknis acuan pabrik berbeda dari hasil survey terkunci — perlu ditinjau.
                </p>
              </div>
            </div>
          )}

          {/* Rincian per proyek */}
          {alur.baris.length > 0 && (
            <div className="rounded-lg border border-border bg-card mb-6 overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Rincian per Lead</p>
                <span className="text-xs text-muted-foreground">Klik kode proyek untuk melihat lacak lengkap</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="text-left text-muted-foreground">
                      <th className="p-2.5 font-medium">Kode Proyek</th>
                      <th className="p-2.5 font-medium">Customer</th>
                      <th className="p-2.5 font-medium">Sales</th>
                      {TAHAP.map(t => <th key={t.nama} className="p-2.5 font-medium text-center">{t.pendek}</th>)}
                      <th className="p-2.5 font-medium text-right">Tahap</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {alur.baris.slice(0, 8).map(p => (
                      <tr key={p.id_lead} className="hover:bg-muted/30">
                        <td className="p-2.5 whitespace-nowrap">
                          <Link to={`/lacak/${p.id_lead}`} className="font-medium text-primary hover:underline">
                            {p.kode_proyek}
                          </Link>
                        </td>
                        <td className="p-2.5 text-muted-foreground max-w-[180px] truncate">{p.nama_prospek}</td>
                        <td className="p-2.5 text-muted-foreground whitespace-nowrap">{p.sales}</td>
                        <td className="p-2.5 text-center text-muted-foreground">●</td>
                        <td className="p-2.5 text-center">
                          {p.surveySales ? <span className="text-success">✓</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="p-2.5 text-center">
                          {p.sph ? <span className="text-success">✓</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="p-2.5 text-center">
                          {p.finalSurvey
                            ? <span className={p.finalTerkunci ? 'text-success' : 'text-amber-500'}>{p.finalTerkunci ? '🔒' : '✓'}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="p-2.5 text-center">
                          {p.po ? <span className="text-success">✓</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="p-2.5 text-right">
                          <span className="inline-block px-2 py-0.5 rounded-full border border-border text-[11px] font-medium">
                            {p.tahap + 1}/5 · {p.tahapNama}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── SPH Stats ──────────────────────────────────────────── */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Statistik SPH</p>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Link to="/sph" className="stat-card hover:border-primary/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{loading ? '…' : totalSPH}</p>
              <p className="text-xs text-muted-foreground">Total SPH</p>
            </div>
          </div>
        </Link>
        <Link to="/sph?status=draft" className="stat-card hover:border-warning/60 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{loading ? '…' : sphDraft}</p>
              <p className="text-xs text-muted-foreground">Draft</p>
            </div>
          </div>
        </Link>
        <Link to="/sph?status=final" className="stat-card hover:border-success/60 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{loading ? '…' : sphFinal}</p>
              <p className="text-xs text-muted-foreground">Final</p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── SPK Stats ──────────────────────────────────────────── */}
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Statistik SPK</p>
      <div className="grid grid-cols-3 gap-3 mb-8">
        <Link to="/spk" className="stat-card hover:border-purple-400/60 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{loading ? '…' : totalSPK}</p>
              <p className="text-xs text-muted-foreground">Total SPK</p>
            </div>
          </div>
        </Link>
        <Link to="/spk?status=draft" className="stat-card hover:border-warning/60 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{loading ? '…' : spkDraft}</p>
              <p className="text-xs text-muted-foreground">Draft</p>
            </div>
          </div>
        </Link>
        <Link to="/spk?status=final" className="stat-card hover:border-success/60 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{loading ? '…' : spkFinal}</p>
              <p className="text-xs text-muted-foreground">Final</p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── SPH Performance Chart ──────────────────────────────── */}
      <div className="bg-card rounded-xl border shadow-sm p-5 mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Kinerja Sales — SPH</h2>
            <p className="text-xs text-muted-foreground">Tingkat kesuksesan SPH (Final) per bulan/tahun</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={String(sphMonth)} onValueChange={v => setSphMonth(Number(v))}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNames.map((m, idx) => <SelectItem key={m} value={String(idx)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(sphYear)} onValueChange={v => setSphYear(Number(v))}>
              <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 mt-4">
          <div className="h-56 w-full">
            {sphSalesStats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Belum ada data pada periode ini.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sphSalesStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sales" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number, name) => name === 'successRate' ? `${value}%` : value} />
                  <Legend />
                  <Bar dataKey="final" name="Final" fill="#16a34a" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="Total" fill="#2563eb" radius={[4, 4, 0, 0]} opacity={0.6} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Overall success rate</p>
              <p className="text-3xl font-bold">{sphOverallRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">{sphFiltered.length} SPH pada periode ini</p>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {sphSalesStats.map(stat => (
                <div key={stat.sales} className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{stat.sales}</p>
                    <p className="text-xs text-muted-foreground">{stat.final}/{stat.total} final</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{stat.successRate}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── SPK Performance Chart ──────────────────────────────── */}
      <div className="bg-card rounded-xl border shadow-sm p-5 mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Kinerja Sales — SPK</h2>
            <p className="text-xs text-muted-foreground">Tingkat kesuksesan SPK (Final) per bulan/tahun</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={String(spkMonth)} onValueChange={v => setSpkMonth(Number(v))}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNames.map((m, idx) => <SelectItem key={m} value={String(idx)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(spkYear)} onValueChange={v => setSpkYear(Number(v))}>
              <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 mt-4">
          <div className="h-56 w-full">
            {spkSalesStats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Belum ada data pada periode ini.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={spkSalesStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sales" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number, name) => name === 'successRate' ? `${value}%` : value} />
                  <Legend />
                  <Bar dataKey="final" name="Final" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="Total" fill="#a78bfa" radius={[4, 4, 0, 0]} opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-3">
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-xs text-muted-foreground">Overall success rate</p>
              <p className="text-3xl font-bold">{spkOverallRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">{spkFiltered.length} SPK pada periode ini</p>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {spkSalesStats.map(stat => (
                <div key={stat.sales} className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{stat.sales}</p>
                    <p className="text-xs text-muted-foreground">{stat.final}/{stat.total} final</p>
                  </div>
                  <span className="text-sm font-semibold text-purple-600">{stat.successRate}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent SPH & SPK side by side ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent SPH */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="section-title">SPH Terbaru</h2>
            <Link to="/sph" className="text-xs text-primary hover:underline">Lihat semua</Link>
          </div>
          {loading ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Memuat data...</div>
          ) : recentSPH.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada SPH.</p>
              <Link to="/sph/new">
                <Button variant="outline" className="mt-3 gap-2 text-xs h-8">
                  <PlusCircle className="w-3.5 h-3.5" /> Buat SPH
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recentSPH.map(sph => (
                <Link key={sph.id} to={`/sph/${sph.id}`}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 mr-2">
                    <p className="text-sm font-medium text-foreground truncate">{sph.nomor_sph || sph.nomorSPH || sph.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground truncate">{sph.kepada} — {formatDate(sph.tanggal)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${sph.status === 'draft' ? 'badge-draft' : 'badge-final'}`}>
                    {sph.status === 'draft' ? 'Draft' : 'Final'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent SPK */}
        <div className="bg-card rounded-xl border shadow-sm">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="section-title">SPK Terbaru</h2>
            <Link to="/spk" className="text-xs text-primary hover:underline">Lihat semua</Link>
          </div>
          {loading ? (
            <div className="p-10 text-center text-muted-foreground text-sm">Memuat data...</div>
          ) : recentSPK.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Belum ada SPK.</p>
              <Link to="/spk/new">
                <Button variant="outline" className="mt-3 gap-2 text-xs h-8">
                  <PlusCircle className="w-3.5 h-3.5" /> Buat SPK
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {recentSPK.map(spk => (
                <Link key={spk.id} to={`/spk/${spk.id}/edit`}
                  className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 mr-2">
                    <p className="text-sm font-medium text-foreground truncate">{spk.nomor_sph || spk.nomorSPH || spk.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground truncate">{spk.kepada} — {formatDate(spk.tanggal)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${spk.status === 'draft' ? 'badge-draft' : 'badge-final'}`}>
                    {spk.status === 'draft' ? 'Draft' : 'Final'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
