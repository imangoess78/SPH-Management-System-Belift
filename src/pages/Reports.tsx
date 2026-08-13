import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, BarChart3, CheckCircle2, Clock3, FileText, Medal,
  ArrowRight, ClipboardList, TrendingUp, XCircle,
} from 'lucide-react';
import { loadDocumentList, formatDate, getDocumentSalesName } from '@/lib/sph-utils';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const VALIDITY_DAYS = 21;
const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function documentDate(doc: any): string {
  const value = doc.tanggal || doc.created_at;
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value).slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function periodKey(doc: any): string {
  return documentDate(doc).slice(0, 7);
}

function getMode(doc: any): 'SPH' | 'SPK' {
  const state = (doc.specs || []).find((item: any) => item?.key === '__docstate');
  if (state?.value) {
    try {
      const parsed = JSON.parse(state.value);
      if (parsed.mode === 'SPH' || parsed.mode === 'SPK') return parsed.mode;
    } catch { /* use legacy fallback */ }
  }
  return String(doc.perihal || '').toUpperCase().includes('SPK') ? 'SPK' : 'SPH';
}

function daysSince(date: string, now: Date): number {
  const created = new Date(`${date}T00:00:00`).getTime();
  return Number.isNaN(created) ? 0 : Math.floor((now.getTime() - created) / 86400000);
}

function displayNumber(value: number) {
  return new Intl.NumberFormat('id-ID').format(value);
}

function safeDate(value?: string) {
  if (!value) return 'Tanggal tidak tersedia';
  return formatDate(value);
}

export default function Reports() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const now = useMemo(() => new Date(), []);
  const period = yearFilter === 'all' ? 'all' : monthFilter === 'all' ? yearFilter : `${yearFilter}-${monthFilter}`;

  useEffect(() => {
    loadDocumentList().then(setDocuments).finally(() => setLoading(false));
  }, []);

  const report = useMemo(() => {
    const periodDocuments = period === 'all'
      ? documents
      : documents.filter(doc => periodKey(doc).startsWith(period));
    const sph = periodDocuments.filter(doc => getMode(doc) === 'SPH');
    const spk = periodDocuments.filter(doc => getMode(doc) === 'SPK');
    const enriched = sph.map(doc => {
      const age = daysSince(doc.tanggal || doc.created_at?.slice(0, 10), now);
      return { ...doc, age, daysLeft: VALIDITY_DAYS - age };
    });
    const salesMap = new Map<string, { name: string; total: number; final: number; expired: number }>();
    sph.forEach(doc => {
      const name = getDocumentSalesName(doc);
      const row = salesMap.get(name) || { name, total: 0, final: 0, expired: 0 };
      row.total += 1;
      if (doc.status === 'final') row.final += 1;
      if (doc.status !== 'final' && daysSince(doc.tanggal || doc.created_at?.slice(0, 10), now) >= VALIDITY_DAYS) row.expired += 1;
      salesMap.set(name, row);
    });
    return {
      sph, spk, enriched,
      draft: sph.filter(doc => doc.status === 'draft'),
      final: sph.filter(doc => doc.status === 'final'),
      nearing: enriched.filter(doc => doc.status !== 'final' && doc.daysLeft >= 0 && doc.daysLeft <= 7).sort((a, b) => a.daysLeft - b.daysLeft),
      expired: enriched.filter(doc => doc.status !== 'final' && doc.daysLeft < 0).sort((a, b) => b.age - a.age),
      sales: Array.from(salesMap.values()).sort((a, b) => (b.final / b.total) - (a.final / a.total) || b.final - a.final || b.total - a.total),
    };
  }, [documents, now, period]);

  const availableYears = useMemo(() => {
    const values = new Set(documents.map(documentDate).filter(Boolean).map(value => value.slice(0, 4)));
    values.add(String(now.getFullYear()));
    return Array.from(values).sort().reverse();
  }, [documents, now]);

  const availableMonths = useMemo(() => {
    if (yearFilter === 'all') return [];
    const values = new Set(documents.filter(doc => documentDate(doc).startsWith(`${yearFilter}-`)).map(documentDate).map(value => value.slice(5, 7)));
    return Array.from(values).sort();
  }, [documents, yearFilter]);

  const periodLabel = period === 'all' ? 'Semua periode / global' : monthFilter === 'all'
    ? `Tahun ${yearFilter}`
    : `${monthNames[Number(monthFilter) - 1]} ${yearFilter}`;

  const monthlyBreakdown = useMemo(() => {
    const map = new Map<string, { month: string; sph: number; final: number; spk: number; expired: number }>();
    documents.forEach(doc => {
      const key = periodKey(doc);
      if (!key) return;
      const row = map.get(key) || { month: key, sph: 0, final: 0, spk: 0, expired: 0 };
      if (getMode(doc) === 'SPH') {
        row.sph += 1;
        if (doc.status === 'final') row.final += 1;
        const age = daysSince(documentDate(doc), now);
        if (doc.status !== 'final' && age >= VALIDITY_DAYS) row.expired += 1;
      } else row.spk += 1;
      map.set(key, row);
    });
    return Array.from(map.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [documents, now]);

  const conversion = report.sph.length ? Math.round((report.spk.length / report.sph.length) * 100) : 0;
  const finalRate = report.sph.length ? Math.round((report.final.length / report.sph.length) * 100) : 0;

  const Stat = ({ icon: Icon, label, value, note, tone = 'primary' }: any) => {
    const toneClasses: Record<string, string> = {
      primary: 'bg-primary/10 text-primary',
      'purple-500': 'bg-purple-500/10 text-purple-500',
      success: 'bg-success/10 text-success',
      warning: 'bg-warning/10 text-warning',
    };
    return (
    <div className="stat-card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClasses[tone] || toneClasses.primary}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div><p className="text-2xl font-bold">{loading ? '…' : typeof value === 'number' ? displayNumber(value) : value}</p><p className="text-xs text-muted-foreground">{label}</p><p className="text-[11px] text-muted-foreground mt-1">{note}</p></div>
    </div>
    );
  };

  const DocumentRow = ({ doc, expired = false }: { doc: any; expired?: boolean }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background">
      <div className="min-w-0">
        <Link to={`/sph/${doc.id}/preview`} className="font-medium text-sm text-primary hover:underline">{doc.nomor_sph || doc.nomorSPH || doc.id?.slice(0, 8)}</Link>
        <p className="text-xs text-muted-foreground truncate">{doc.kepada || doc.nama_perusahaan || 'Tanpa nama pelanggan'} · {safeDate(doc.tanggal || doc.created_at?.slice(0, 10))}</p>
      </div>
      <span className={`shrink-0 text-xs font-semibold ${expired ? 'text-destructive' : 'text-warning'}`}>
        {expired ? `${doc.age - VALIDITY_DAYS} hari lewat` : `${doc.daysLeft} hari lagi`}
      </span>
    </div>
  );

  return <div>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-8">
      <div><h1 className="text-2xl font-bold">Laporan</h1><p className="text-sm text-muted-foreground mt-1">Evaluasi efektivitas SPH hingga beranjak ke SPK</p></div>
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center"><Select value={yearFilter} onValueChange={value => { setYearFilter(value); setMonthFilter('all'); }}><SelectTrigger className="w-full sm:w-32"><SelectValue placeholder="Tahun" /></SelectTrigger><SelectContent><SelectItem value="all">Semua tahun</SelectItem>{availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent></Select><Select value={monthFilter} onValueChange={setMonthFilter} disabled={yearFilter === 'all'}><SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Bulan" /></SelectTrigger><SelectContent><SelectItem value="all">Semua bulan</SelectItem>{availableMonths.map(month => <SelectItem key={month} value={month}>{monthNames[Number(month) - 1]}</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground whitespace-nowrap">Masa berlaku: <strong>21 hari</strong></p></div>
    </div>

    <section className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div><p className="text-xs uppercase tracking-wider font-semibold text-primary">Periode laporan</p><h2 className="text-lg font-bold mt-1">{periodLabel}</h2><p className="text-xs text-muted-foreground mt-1">{period === 'all' ? 'Data seluruh periode yang tersedia di sistem.' : monthFilter === 'all' ? 'Data seluruh bulan pada tahun terpilih.' : 'Data dokumen yang dibuat pada bulan terpilih.'}</p></div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center"><div><p className="text-lg font-bold">{report.sph.length}</p><p className="text-[11px] text-muted-foreground">SPH</p></div><div><p className="text-lg font-bold">{report.draft.length}</p><p className="text-[11px] text-muted-foreground">Draft</p></div><div><p className="text-lg font-bold">{report.final.length}</p><p className="text-[11px] text-muted-foreground">Final</p></div><div><p className="text-lg font-bold">{report.spk.length}</p><p className="text-[11px] text-muted-foreground">SPK</p></div></div>
      </div>
    </section>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      <Stat icon={FileText} label="Total SPH" value={report.sph.length} note={`${report.draft.length} draft · ${report.final.length} final`} />
      <Stat icon={ClipboardList} label="Total SPK" value={report.spk.length} note="Dokumen lanjutan" tone="purple-500" />
      <Stat icon={TrendingUp} label="Rasio SPH → SPK" value={`${conversion}%`} note={`${report.spk.length} dari ${report.sph.length} SPH`} tone="success" />
      <Stat icon={CheckCircle2} label="Tingkat finalisasi SPH" value={`${finalRate}%`} note="Draft menjadi final" tone="warning" />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-6">
      <section className="bg-card rounded-xl border shadow-sm p-5">
        <div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-primary" /><div><h2 className="section-title">Funnel dokumen</h2><p className="text-xs text-muted-foreground">Perbandingan tahapan proses penjualan</p></div></div>
        <div className="space-y-4">
          {[{ label: 'SPH dibuat', value: report.sph.length, color: 'bg-primary' }, { label: 'SPH final', value: report.final.length, color: 'bg-success' }, { label: 'Beranjak ke SPK', value: report.spk.length, color: 'bg-purple-500' }].map(item => (
            <div key={item.label}><div className="flex justify-between text-sm mb-1"><span>{item.label}</span><strong>{displayNumber(item.value)}</strong></div><Progress value={report.sph.length ? (item.value / report.sph.length) * 100 : 0} className="h-2" indicatorClassName={item.color} /></div>
          ))}
        </div>
        <div className="mt-5 p-3 rounded-lg bg-muted/40 text-xs text-muted-foreground flex gap-2"><ArrowRight className="w-4 h-4 shrink-0 text-primary" />Rasio SPH ke SPK membantu melihat seberapa banyak penawaran yang berkembang menjadi perjanjian kerja.</div>
      </section>

      <section className="bg-card rounded-xl border shadow-sm p-5"><div className="flex items-center gap-2 mb-4"><Medal className="w-5 h-5 text-warning" /><div><h2 className="section-title">Leaderboard sales</h2><p className="text-xs text-muted-foreground">Peringkat berdasarkan tingkat finalisasi SPH</p></div></div>
        {report.sales.length === 0 ? <p className="text-sm text-muted-foreground py-8 text-center">Belum ada data SPH.</p> : <div className="space-y-2">{report.sales.slice(0, 10).map((row, index) => { const rank = index + 1; const rate = Math.round((row.final / row.total) * 100); return <div key={row.name} className="flex items-center gap-3 rounded-lg border p-3 bg-background"><div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ${rank === 1 ? 'bg-warning/20 text-warning' : rank === 2 ? 'bg-muted text-foreground' : rank === 3 ? 'bg-orange-500/15 text-orange-600' : 'bg-muted/50 text-muted-foreground'}`}>{rank <= 3 ? <Medal className="w-4 h-4" /> : rank}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2 text-sm mb-1"><span className="truncate font-medium">{row.name}</span><span className="font-bold text-primary shrink-0">{rate}%</span></div><Progress value={rate} className="h-2" /><p className="text-[11px] text-muted-foreground mt-1">{row.final} final dari {row.total} SPH</p></div></div>; })}</div>}
      </section>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <section className="bg-card rounded-xl border shadow-sm p-5"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-warning" /><div><h2 className="section-title">Mendekati tenggat</h2><p className="text-xs text-muted-foreground">Draft dengan sisa waktu maksimal 7 hari</p></div></div><span className="badge-draft text-xs px-2 py-1 rounded-full">{report.nearing.length}</span></div>{report.nearing.length ? <div className="space-y-2">{report.nearing.map(doc => <DocumentRow key={doc.id} doc={doc} />)}</div> : <p className="text-sm text-muted-foreground py-6 text-center"><Clock3 className="w-7 h-7 mx-auto mb-2 opacity-40" />Tidak ada SPH yang mendekati tenggat.</p>}</section>
      <section className="bg-card rounded-xl border shadow-sm p-5"><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-2"><XCircle className="w-5 h-5 text-destructive" /><div><h2 className="section-title">SPH sudah expired</h2><p className="text-xs text-muted-foreground">Draft melewati masa berlaku 21 hari</p></div></div><span className="text-xs px-2 py-1 rounded-full bg-destructive/10 text-destructive font-semibold">{report.expired.length}</span></div>{report.expired.length ? <div className="space-y-2">{report.expired.slice(0, 8).map(doc => <DocumentRow key={doc.id} doc={doc} expired />)}</div> : <p className="text-sm text-muted-foreground py-6 text-center"><CheckCircle2 className="w-7 h-7 mx-auto mb-2 text-success opacity-60" />Tidak ada SPH expired.</p>}</section>
    </div>

    {period === 'all' && <section className="bg-card rounded-xl border shadow-sm p-5 mt-6"><div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-primary" /><div><h2 className="section-title">Breakdown per bulan</h2><p className="text-xs text-muted-foreground">Perbandingan SPH, finalisasi, SPK, dan expired berdasarkan bulan pembuatan</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr className="border-b bg-muted/50"><th className="text-left p-3 font-medium text-muted-foreground">Bulan</th><th className="text-right p-3 font-medium text-muted-foreground">SPH</th><th className="text-right p-3 font-medium text-muted-foreground">Final</th><th className="text-right p-3 font-medium text-muted-foreground">SPK</th><th className="text-right p-3 font-medium text-muted-foreground">Expired</th><th className="text-right p-3 font-medium text-muted-foreground">Finalisasi</th></tr></thead><tbody className="divide-y">{monthlyBreakdown.map(row => { const [year, month] = row.month.split('-'); const rate = row.sph ? Math.round((row.final / row.sph) * 100) : 0; return <tr key={row.month}><td className="p-3 font-medium">{monthNames[Number(month) - 1]} {year}</td><td className="p-3 text-right">{row.sph}</td><td className="p-3 text-right text-success font-medium">{row.final}</td><td className="p-3 text-right text-purple-500 font-medium">{row.spk}</td><td className="p-3 text-right text-destructive font-medium">{row.expired}</td><td className="p-3 text-right">{rate}%</td></tr>; })}</tbody></table></div></section>}
  </div>;
}