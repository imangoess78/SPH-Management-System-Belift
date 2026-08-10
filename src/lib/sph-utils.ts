import { KatalogItem, TerminItem, ROMAN, BULAN_ID } from './sph-types';
import { supabase } from '@/integrations/supabase/client';

// ============================================================
//  NUMBER HELPERS
// ============================================================
export function num(v: unknown): number { return Number(v) || 0; }

export function rupiah(n: number): string {
  return 'Rp ' + Math.round(num(n)).toLocaleString('id-ID');
}

export function ribu(n: number): string {
  return Math.round(num(n)).toLocaleString('id-ID');
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

// ============================================================
//  TERBILANG (number → Indonesian words)
// ============================================================
const SATUAN = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];

export function terbilang(n: number): string {
  n = Math.floor(Math.abs(num(n)));
  if (n < 12)   return SATUAN[n] || 'nol';
  if (n < 20)   return terbilang(n - 10) + ' belas';
  if (n < 100)  return terbilang(Math.floor(n / 10)) + ' puluh' + (n % 10 ? ' ' + terbilang(n % 10) : '');
  if (n < 200)  return 'seratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 1000) return terbilang(Math.floor(n / 100)) + ' ratus' + (n % 100 ? ' ' + terbilang(n % 100) : '');
  if (n < 2000) return 'seribu' + (n % 1000 ? ' ' + terbilang(n % 1000) : '');
  if (n < 1e6)  return terbilang(Math.floor(n / 1e3)) + ' ribu' + (n % 1e3 ? ' ' + terbilang(n % 1e3) : '');
  if (n < 1e9)  return terbilang(Math.floor(n / 1e6)) + ' juta' + (n % 1e6 ? ' ' + terbilang(n % 1e6) : '');
  return terbilang(Math.floor(n / 1e9)) + ' miliar' + (n % 1e9 ? ' ' + terbilang(n % 1e9) : '');
}

export function terbilangRp(n: number): string {
  const t = terbilang(n).trim();
  return t.charAt(0).toUpperCase() + t.slice(1) + ' Rupiah';
}

export function capWords(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================
//  DATE HELPERS
// ============================================================
export function parseDate(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

export function fmtID(d: Date): string {
  return d.getDate() + ' ' + BULAN_ID[d.getMonth() + 1] + ' ' + d.getFullYear();
}

export function formatDate(dateStr: string): string {
  return fmtID(parseDate(dateStr));
}

// ============================================================
//  NOMOR SURAT
// ============================================================
export function pad3(v: string | number): string {
  return String(v).replace(/\D/g, '').padStart(3, '0');
}

export function noSuratSPH(noUrut: string, tanggal: string): string {
  const d = parseDate(tanggal);
  return pad3(noUrut) + '/SPH/LIFT/BAI/' + ROMAN[d.getMonth() + 1] + '/' + d.getFullYear();
}

export function noSuratSPK(noUrut: string, tanggal: string, format: 'standar' | 'lama'): string {
  const d = parseDate(tanggal);
  const rom = ROMAN[d.getMonth() + 1], th = d.getFullYear(), n = pad3(noUrut);
  return format === 'standar'
    ? n + '/SPK/LIFT/BAI/' + rom + '/' + th
    : n + '/LIFT/BAI/' + rom + '/' + th;
}

// ============================================================
//  ITEM CALCULATION HELPERS
// ============================================================
export function subKel(items: KatalogItem[], kel: string, field: 'hp' | 'hi', mode: 'satuan' | 'lumpsum'): number {
  return items
    .filter(i => i.kel === kel && i.on && !i.inc)
    .reduce((a, i) => a + (mode === 'satuan' ? num(i[field]) * num(i.qty) : num(i[field])), 0);
}

export function totalKel(items: KatalogItem[], kel: string, mode: 'satuan' | 'lumpsum'): number {
  return subKel(items, kel, 'hp', mode) + subKel(items, kel, 'hi', mode);
}

export function grandTotal(items: KatalogItem[], mode: 'satuan' | 'lumpsum'): number {
  return totalKel(items, 'PENGADAAN', mode) + totalKel(items, 'INSTALASI', mode) + totalKel(items, 'SIPIL', mode);
}

export function kelAktif(items: KatalogItem[]): string[] {
  return ['PENGADAAN', 'INSTALASI', 'SIPIL'].filter(k => items.some(i => i.kel === k && i.on));
}

export function sumTermin(termin: TerminItem[] | Record<string, TerminItem[]>, kel?: string): number {
  const arr = (kel && !Array.isArray(termin))
    ? ((termin as Record<string, TerminItem[]>)[kel] || [])
    : (termin as TerminItem[]);
  return arr.reduce((a, t) => a + num(t.p), 0);
}

// ============================================================
//  SUPABASE PERSISTENCE (uses existing `sph` table)
//  The full generator state is stored as JSON in the `specs`
//  JSONB column, which already accepts arbitrary data.
// ============================================================
export async function getNextDocIncrement(): Promise<number> {
  const year = new Date().getFullYear();
  const { count } = await (supabase as any)
    .from('sph')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', year + '-01-01')
    .lte('created_at', year + '-12-31');
  return (count || 0) + 1;
}

/**
 * Returns the next available sequential number for a given doc type (SPH or SPK).
 * Reads all existing nomor_sph values, filters by type, parses the leading number,
 * and returns max + 1. Falls back to 1 if no docs exist yet.
 */
export async function getNextNoUrut(mode: 'SPH' | 'SPK'): Promise<number> {
  const { data, error } = await (supabase as any)
    .from('sph')
    .select('nomor_sph');
  if (error || !data) return 1;

  const typeSlug = mode === 'SPH' ? '/SPH/' : '/SPK/';
  let max = 0;
  (data as { nomor_sph: string }[]).forEach(row => {
    const n = row.nomor_sph || '';
    if (!n.includes(typeSlug)) return;
    const leading = parseInt(n.split('/')[0], 10);
    if (!isNaN(leading) && leading > max) max = leading;
  });
  return max + 1;
}

export async function saveDocument(doc: Record<string, unknown>, userId: string): Promise<boolean> {
  // Build nomor_sph from the full generator state
  const state = (doc.state as Record<string, unknown>) || doc;
  const noUrut = String(state.noUrut || doc.noUrut || '001');
  const tanggal = String(state.tanggal || doc.tanggal || new Date().toISOString().slice(0, 10));
  const mode = String(doc.mode || 'SPH');
  const formatNoSPK = (state.formatNoSPK || 'standar') as 'standar' | 'lama';
  const nomorSph = mode === 'SPH'
    ? noSuratSPH(noUrut, tanggal)
    : noSuratSPK(noUrut, tanggal, formatNoSPK);

  const row = {
    id: doc.id,
    user_id: userId,
    nomor_sph: nomorSph,
    tanggal: tanggal,
    kepada: String(doc.namaPerusahaan || doc.namaCustomer || ''),
    nama_pic: String(doc.namaCustomer || ''),
    alamat_proyek: String(doc.kotaProyek || ''),
    perihal: 'Generator ' + mode + ' — ' + String(doc.tipeKabin || ''),
    jenis_lift: String(doc.jenisLift || 'Passenger Lift'),
    status: String(doc.status || 'draft'),
    // Store full generator state + rendered HTML in specs JSONB
    specs: [
      { key: '__docstate', label: 'docstate', value: JSON.stringify(doc) },
      ...(doc.renderedHtml ? [{ key: '__html', label: 'html', value: String(doc.renderedHtml) }] : []),
    ],
    items: [],
    payments: [],
    terms: {},
    include_ppn: doc.ppn !== 'exclude',
  };
  const { error } = await (supabase as any).from('sph').upsert(row);
  if (error) { console.error('Error saving document:', error); return false; }
  return true;
}

export async function loadDocumentList(): Promise<any[]> {
  const { data, error } = await (supabase as any)
    .from('sph')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { console.error('Error loading documents:', error); return []; }
  return data || [];
}

export async function loadDocumentById(id: string): Promise<any | null> {
  const { data, error } = await (supabase as any)
    .from('sph')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  // Try to restore full docstate from specs
  const specs: any[] = data.specs || [];
  const docstateSpec = specs.find((s: any) => s.key === '__docstate');
  if (docstateSpec) {
    try {
      const parsed = JSON.parse(docstateSpec.value);
      // Preserve specs so SPHPreview can find __html
      parsed.specs = specs;
      return parsed;
    } catch { /* fall through */ }
  }
  return data;
}

export async function deleteDocument(id: string): Promise<boolean> {
  const { error } = await (supabase as any).from('sph').delete().eq('id', id);
  if (error) { console.error('Error deleting document:', error); return false; }
  return true;
}

// ============================================================
//  LEGACY HELPERS (for SPHList compatibility)
// ============================================================
export function generateNomorSPH(increment: number, date: Date = new Date()): string {
  const month = ROMAN[date.getMonth() + 1];
  return String(increment).padStart(3, '0') + '/SPH/LIFT/BAI/' + month + '/' + date.getFullYear();
}

export async function getNextIncrement(): Promise<number> {
  return getNextDocIncrement();
}

export function generateId(): string {
  return crypto.randomUUID();
}

// Legacy calc — kept for SPHPreview
export function calculateItemTotal({ items, includePPN = true }: { items: any[]; includePPN?: boolean; priceMode?: string; lumpSumTotal?: number }) {
  let subtotal = 0;
  items.forEach((item: any) => {
    if (item.checked && !item.isInclude) subtotal += (item.hargaPengadaan + item.hargaPemasangan) * item.qty;
    if (item.children) item.children.forEach((c: any) => {
      if (c.checked && !c.isInclude) subtotal += (c.hargaPengadaan + c.hargaPemasangan) * c.qty;
    });
  });
  const ppn = includePPN ? subtotal * 0.11 : 0;
  return { subtotal, ppn, grandTotal: subtotal + ppn };
}

export async function loadSPHList(): Promise<any[]> {
  return loadDocumentList();
}

export async function loadSPHById(id: string): Promise<any | null> {
  return loadDocumentById(id);
}

export async function saveSPH(sph: any, userId: string): Promise<boolean> {
  return saveDocument(sph, userId);
}

export async function deleteSPH(id: string): Promise<boolean> {
  return deleteDocument(id);
}
