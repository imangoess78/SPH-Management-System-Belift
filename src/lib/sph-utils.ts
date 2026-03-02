import { SPH, SPHItem } from './sph-types';
import { supabase } from '@/integrations/supabase/client';

const ROMAN_MONTHS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

export function generateNomorSPH(increment: number, date: Date = new Date()): string {
  const month = ROMAN_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${String(increment).padStart(3, '0')}/SPH/LIFT/BAI/${month}/${year}`;
}

export async function getNextIncrement(): Promise<number> {
  const currentYear = new Date().getFullYear();
  const startOfYear = `${currentYear}-01-01`;
  const endOfYear = `${currentYear}-12-31`;
  
  const { count } = await supabase
    .from('sph')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', startOfYear)
    .lte('created_at', endOfYear);
  
  return (count || 0) + 1;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function calculateItemTotal(items: SPHItem[], includePPN: boolean = true): { subtotal: number; ppn: number; grandTotal: number } {
  let subtotal = 0;
  items.forEach(item => {
    if (item.checked && !item.isInclude) {
      subtotal += (item.hargaPengadaan + item.hargaPemasangan) * item.qty;
    }
    if (item.children) {
      item.children.forEach(child => {
        if (child.checked && !child.isInclude) {
          subtotal += (child.hargaPengadaan + child.hargaPemasangan) * child.qty;
        }
      });
    }
  });
  const ppn = includePPN ? subtotal * 0.11 : 0;
  return { subtotal, ppn, grandTotal: subtotal + ppn };
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Convert SPH object to DB row format
function sphToRow(sph: SPH, userId: string) {
  return {
    id: sph.id,
    user_id: userId,
    nomor_sph: sph.nomorSPH,
    tanggal: sph.tanggal,
    kepada: sph.kepada,
    nama_pic: sph.namaPIC,
    alamat_proyek: sph.alamatProyek,
    perihal: sph.perihal,
    jenis_lift: sph.jenisLift,
    kapasitas: sph.kapasitas,
    floors: sph.floors,
    stops: sph.stops,
    doors: sph.doors,
    waktu_pelaksanaan: sph.waktuPelaksanaan,
    items: sph.items as any,
    specs: sph.specs as any,
    terms: sph.terms as any,
    payments: sph.payments as any,
    include_ppn: sph.includePPN,
    status: sph.status,
    designs: sph.designs as any,
  };
}

// Convert DB row to SPH object
function rowToSPH(row: any): SPH {
  return {
    id: row.id,
    nomorSPH: row.nomor_sph,
    tanggal: row.tanggal,
    kepada: row.kepada,
    namaPIC: row.nama_pic,
    alamatProyek: row.alamat_proyek,
    perihal: row.perihal,
    jenisLift: row.jenis_lift,
    kapasitas: row.kapasitas,
    floors: row.floors,
    stops: row.stops,
    doors: row.doors,
    waktuPelaksanaan: row.waktu_pelaksanaan,
    items: row.items as SPHItem[],
    specs: row.specs,
    terms: row.terms,
    payments: row.payments,
    includePPN: row.include_ppn,
    designs: row.designs || {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadSPHList(): Promise<SPH[]> {
  const { data, error } = await supabase
    .from('sph')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error loading SPH:', error);
    return [];
  }
  return (data || []).map(rowToSPH);
}

export async function loadSPHById(id: string): Promise<SPH | null> {
  const { data, error } = await supabase
    .from('sph')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error || !data) return null;
  return rowToSPH(data);
}

export async function saveSPH(sph: SPH, userId: string): Promise<boolean> {
  const row = sphToRow(sph, userId);
  const { error } = await supabase
    .from('sph')
    .upsert(row);
  
  if (error) {
    console.error('Error saving SPH:', error);
    return false;
  }
  return true;
}

export async function deleteSPH(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('sph')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting SPH:', error);
    return false;
  }
  return true;
}

export function generateId(): string {
  return crypto.randomUUID();
}
