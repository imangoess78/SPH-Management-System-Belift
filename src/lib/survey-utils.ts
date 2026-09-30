/**
 * Pembantu kecil untuk modul Survey & PO — format tanggal & label.
 */
import type { ProyekRow } from './survey-types';

export function fmtTglPendek(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtWaktu(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const TAHAP_LABEL: Record<string, string> = {
  SURVEY_SALES: 'Survey Sales',
  KONTRAK: 'Kontrak',
  FINAL_SURVEY: 'Final Survey',
  PO: 'PO Pabrik',
  KOM: 'KOM',
  SELESAI: 'Selesai',
};

export const tahapLabel = (t: string | null | undefined) => TAHAP_LABEL[t || ''] || (t || '—');

/** Urutan tahap untuk bilah kemajuan di halaman Lacak. */
export const TAHAP_URUT = ['SURVEY_SALES', 'KONTRAK', 'FINAL_SURVEY', 'PO'] as const;

export function posisiTahap(p: ProyekRow | null): number {
  const t = p?.tahap_sekarang || '';
  const i = TAHAP_URUT.indexOf(t as typeof TAHAP_URUT[number]);
  return i < 0 ? 0 : i;
}

export const warnaTingkat: Record<string, string> = {
  kritis: 'border-l-4 border-l-rose-500 bg-rose-50/60',
  perhatian: 'border-l-4 border-l-amber-500 bg-amber-50/60',
  info: 'border-l-4 border-l-sky-400 bg-sky-50/60',
};

export const lencanaTingkat: Record<string, string> = {
  kritis: 'bg-rose-100 text-rose-700 border-rose-200',
  perhatian: 'bg-amber-100 text-amber-700 border-amber-200',
  info: 'bg-sky-100 text-sky-700 border-sky-200',
};

export const labelTingkat: Record<string, string> = {
  kritis: 'Setelah Final Survey',
  perhatian: 'Setelah Kontrak',
  info: 'Perubahan',
};
