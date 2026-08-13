import { Link } from 'react-router-dom';
import { FileText, PlusCircle, TrendingUp, Clock, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadDocumentList, formatDate } from '@/lib/sph-utils';
import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

// Same SPK filter as SPKList.tsx
function isSPK(doc: any): boolean {
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
  const specs: any[] = doc.specs || [];
  const ds = specs.find((s: any) => s.key === '__docstate');
  if (ds) {
    try {
      const parsed = JSON.parse(ds.value);
      return parsed.mode === 'SPH';
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
