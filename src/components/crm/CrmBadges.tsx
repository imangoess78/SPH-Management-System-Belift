import { Badge } from '@/components/ui/badge';
import { KUALIFIKASI_STYLE, type Kualifikasi } from '@/lib/crm-utils';

/** Lencana HOT / WARM / COLD. */
export function KualifikasiBadge({ nilai, skor }: { nilai: string | null | undefined; skor?: number }) {
  const k = (nilai || 'COLD') as Kualifikasi;
  const s = KUALIFIKASI_STYLE[k] ?? KUALIFIKASI_STYLE.COLD;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-semibold ${s.bg} ${s.text} ${s.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
      {skor !== undefined && <span className="font-normal opacity-70">{skor}</span>}
    </span>
  );
}

const STATUS_STYLE: Record<string, string> = {
  'Lead Baru': 'bg-slate-50 text-slate-600 border-slate-200',
  'Kontak Pertama Dilakukan': 'bg-sky-50 text-sky-700 border-sky-200',
  'Survey Dijadwalkan': 'bg-sky-50 text-sky-700 border-sky-200',
  'Survey Selesai': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'Hitung Harga 3 Lingkup': 'bg-cyan-50 text-cyan-700 border-cyan-200',
  'SPH Terkirim': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Negosiasi': 'bg-violet-50 text-violet-700 border-violet-200',
  'Menunggu Approval Diskon': 'bg-amber-50 text-amber-700 border-amber-200',
  'Deal - Menunggu Dokumen': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'SPK Disusun': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'SPK Bernomor & Terkirim': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'SPK Ditandatangani + DP': 'bg-green-50 text-green-700 border-green-200',
  'KOM Terjadwal': 'bg-green-50 text-green-700 border-green-200',
  'Selesai - Pindah ke File 00': 'bg-green-100 text-green-800 border-green-300',
  'Gugur': 'bg-rose-50 text-rose-700 border-rose-200',
};

/** Lencana status tahap lead. */
export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status || 'Lead Baru';
  const style = STATUS_STYLE[s] || 'bg-slate-50 text-slate-600 border-slate-200';
  return <Badge variant="outline" className={`text-[11px] font-medium whitespace-nowrap ${style}`}>{s}</Badge>;
}

/** Lencana kelompok kanal (Paid / Organik / dst). */
export function KelompokBadge({ kelompok }: { kelompok: string }) {
  const style: Record<string, string> = {
    Paid: 'bg-blue-50 text-blue-700 border-blue-200',
    Organik: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Affiliate: 'bg-purple-50 text-purple-700 border-purple-200',
    Offline: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return <Badge variant="outline" className={`text-[11px] ${style[kelompok] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{kelompok}</Badge>;
}
