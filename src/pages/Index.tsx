import { Link } from 'react-router-dom';
import { FileText, PlusCircle, TrendingUp, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadSPHList, formatDate } from '@/lib/sph-utils';
import { SPH } from '@/lib/sph-types';
import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const Index = () => {
  const [sphList, setSphList] = useState<SPH[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth());
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  useEffect(() => {
    loadSPHList().then(list => {
      setSphList(list);
      setLoading(false);
    });
  }, []);

  const totalSPH = sphList.length;
  const draftCount = sphList.filter(s => s.status === 'draft').length;
  const finalCount = sphList.filter(s => s.status === 'final').length;
  const recent = sphList.slice(0, 5);
  const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const filteredByPeriod = useMemo(() => sphList.filter(s => {
    const d = new Date(s.tanggal);
    return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
  }), [sphList, selectedMonth, selectedYear]);

  const salesStats = useMemo(() => {
    const map = new Map<string, { sales: string; total: number; final: number }>();
    filteredByPeriod.forEach(s => {
      const key = (s.namaSales || 'Tidak ada nama').trim() || 'Tidak ada nama';
      const row = map.get(key) || { sales: key, total: 0, final: 0 };
      row.total += 1;
      if (s.status === 'final') row.final += 1;
      map.set(key, row);
    });
    return Array.from(map.values()).map(r => ({
      ...r,
      successRate: r.total ? Math.round((r.final / r.total) * 100) : 0,
    }));
  }, [filteredByPeriod]);

  const overallRate = useMemo(() => {
    const total = filteredByPeriod.length;
    const finals = filteredByPeriod.filter(s => s.status === 'final').length;
    return total ? Math.round((finals / total) * 100) : 0;
  }, [filteredByPeriod]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Selamat datang di SPH Management System</p>
        </div>
        <Link to="/sph/new" className="w-full sm:w-auto">
          <Button className="gap-2 w-full sm:w-auto justify-center">
            <PlusCircle className="w-4 h-4" /> Buat SPH Baru
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? '...' : totalSPH}</p>
              <p className="text-xs text-muted-foreground">Total SPH</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? '...' : draftCount}</p>
              <p className="text-xs text-muted-foreground">Draft</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{loading ? '...' : finalCount}</p>
              <p className="text-xs text-muted-foreground">Final</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales performance */}
      <div className="bg-card rounded-xl border shadow-sm p-5 mb-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="section-title">Kinerja Sales</h2>
            <p className="text-xs text-muted-foreground">Tingkat kesuksesan SPH (Final) per bulan/tahun</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
              <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthNames.map((m, idx) => <SelectItem key={m} value={String(idx)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }).map((_, i) => {
                  const year = today.getFullYear() - 2 + i;
                  return <SelectItem key={year} value={String(year)}>{year}</SelectItem>;
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 mt-4">
          <div className="h-64 w-full">
            {salesStats.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Belum ada data pada periode ini.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesStats}>
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
              <p className="text-3xl font-bold">{overallRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">{filteredByPeriod.length} SPH pada periode ini</p>
            </div>
            <div className="space-y-2">
              {salesStats.map(stat => (
                <div key={stat.sales} className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{stat.sales}</p>
                    <p className="text-xs text-muted-foreground">{stat.final}/{stat.total} final</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{stat.successRate}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Recent SPH */}
      <div className="bg-card rounded-xl border shadow-sm">
        <div className="p-5 border-b">
          <h2 className="section-title">SPH Terbaru</h2>
        </div>
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">Memuat data...</div>
        ) : recent.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada SPH. Mulai buat SPH pertama Anda.</p>
            <Link to="/sph/new">
              <Button variant="outline" className="mt-4 gap-2">
                <PlusCircle className="w-4 h-4" /> Buat SPH
              </Button>
            </Link>
          </div>
        ) : (
          <div className="divide-y">
            {recent.map(sph => (
              <Link key={sph.id} to={`/sph/${sph.id}`} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground font-sans">{sph.nomorSPH}</p>
                  <p className="text-xs text-muted-foreground">{sph.kepada} — {formatDate(sph.tanggal)}</p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${sph.status === 'draft' ? 'badge-draft' : 'badge-final'}`}>
                  {sph.status === 'draft' ? 'Draft' : 'Final'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
