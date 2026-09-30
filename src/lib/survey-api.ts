// Pembungkus tipis untuk /api/survey dan /api/po.
// Satu tempat untuk seluruh panggilan modul Survey & PO.

import type {
  SurveyRowTerurai, RiwayatRow, ProyekRow, PoRow, PoRevisiRow,
  TemuanDiff, PerubahanField, DataTeknis,
} from './survey-types';

async function minta<T>(base: string, params: Record<string, string | number | undefined>, init?: RequestInit): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const r = await fetch(`${base}?${qs}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json', ...(init?.headers || {}) } : init?.headers,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Gagal memuat (${r.status})`);
  return data as T;
}

const S = '/api/survey';
const P = '/api/po';

// ── Tipe balikan server ─────────────────────────────────────

export interface BarisSurvey {
  id: string;
  id_lead: string;
  kode_proyek: string | null;
  jenis: 'sales' | 'final';
  no_survey: string | null;
  /** Server mengirim tgl_survey dua kali: apa adanya + AS tanggal. */
  tgl_survey: string | null;
  tanggal: string | null;
  disurvey_oleh: string | null;
  surveyor: string | null;
  terkunci: boolean;
  dikunci_oleh: string | null;
  dikunci_pada: string | null;
  status: string;
  updated_at: string;
  nama_prospek: string | null;
  kode_lead: string | null;
  kota: string | null;
  status_terakhir: string | null;
}

export interface BalikanLacak {
  proyek: ProyekRow | null;
  lead: Record<string, unknown>;
  survey_sales: SurveyRowTerurai | null;
  final_survey: SurveyRowTerurai | null;
  po: (PoRow & { revisi: PoRevisiRow[] }) | null;
  sph: Record<string, unknown> | null;
  riwayat: RiwayatRow[];
}

export interface BalikanPoDetail {
  data: PoRow & { nama_prospek?: string | null; kode_lead?: string | null; kota?: string | null };
  revisi: PoRevisiRow[];
  riwayat: RiwayatRow[];
  selisih_final_ke_po: PerubahanField[];
}

// ── API ─────────────────────────────────────────────────────

export const surveyApi = {
  // ── Survey ──
  daftar: (f: { jenis?: 'sales' | 'final'; id_lead?: string; terkunci?: 0 | 1; q?: string } = {}) =>
    minta<{ data: BarisSurvey[] }>(S, { resource: 'survey', ...f }),

  ambil: (id: string) =>
    minta<{ data: SurveyRowTerurai & Record<string, unknown>; riwayat: RiwayatRow[] }>(S, { resource: 'survey', id }),

  buat: (body: { id_lead: string; jenis: 'sales' | 'final'; tgl_survey?: string; disurvey_oleh?: string; surveyor?: string }) =>
    minta<{ ok: boolean; id: string; kode_proyek?: string; sudahAda?: boolean }>(S, { resource: 'survey' },
      { method: 'POST', body: JSON.stringify(body) }),

  ubah: (id: string, body: Record<string, unknown>) =>
    minta<{ ok: boolean; id: string }>(S, { resource: 'survey', id }, { method: 'PUT', body: JSON.stringify(body) }),

  hapus: (id: string) => minta<{ ok: boolean }>(S, { resource: 'survey', id }, { method: 'DELETE' }),

  kunci: (id: string, alasan?: string) =>
    minta<{ ok: boolean; terkunci: boolean; dikunci_oleh?: string; dikunci_pada?: string }>(S,
      { resource: 'kunci', id, aksi: 'kunci' }, { method: 'POST', body: JSON.stringify({ alasan }) }),

  bukaKunci: (id: string, alasan: string) =>
    minta<{ ok: boolean; terkunci: boolean }>(S, { resource: 'kunci', id, aksi: 'buka' },
      { method: 'POST', body: JSON.stringify({ alasan }) }),

  // ── Lacak & proyek ──
  lacak: (idLead: string) => minta<BalikanLacak>(S, { resource: 'lacak', id_lead: idLead }),
  proyek: () => minta<{ data: ProyekRow[] }>(S, { resource: 'proyek' }),
};

export const poApi = {
  daftar: (idLead?: string) => minta<{ data: (PoRow & { nama_prospek?: string | null; jml_revisi?: number })[] }>(P, { resource: 'po', id_lead: idLead }),
  ambil: (id: string) => minta<BalikanPoDetail>(P, { resource: 'po', id }),
  buat: (body: { id_lead: string; pabrik?: string; pic?: string; tgl_po?: string; catatan?: string }) =>
    minta<{ ok: boolean; id: string; no_po?: string; sudahAda?: boolean }>(P, { resource: 'po' },
      { method: 'POST', body: JSON.stringify(body) }),
  ubah: (id: string, body: Record<string, unknown>) =>
    minta<{ ok: boolean }>(P, { resource: 'po', id }, { method: 'PUT', body: JSON.stringify(body) }),
  hapus: (id: string) => minta<{ ok: boolean }>(P, { resource: 'po', id }, { method: 'DELETE' }),
  terbit: (id: string, alasan?: string) =>
    minta<{ ok: boolean; rev: number; jml_perubahan: number; perubahan: PerubahanField[] }>(P,
      { resource: 'terbit', id }, { method: 'POST', body: JSON.stringify({ alasan }) }),
  revisi: (id: string, alasan?: string) =>
    minta<{ ok: boolean; rev: number; jml_perubahan: number; perubahan: PerubahanField[] }>(P,
      { resource: 'revisi', id }, { method: 'POST', body: JSON.stringify({ alasan }) }),
};

// ── Mesin selisih di sisi layar (dipakai untuk pratinjau sebelum simpan) ──
//  Server tetap menghitung ulang saat PO terbit; ini hanya untuk tampilan.

const LABEL_SISI: Record<string, string> = {
  jenisLift: 'Jenis Lift', kapasitas: 'Kapasitas', kecepatan: 'Kecepatan', sfd: 'Stops/Floors/Doors',
  shaftSize: 'Ukuran Shaft', pitDepth: 'Kedalaman Pit', overhead: 'Overhead', travelling: 'Travelling Height',
  tipePintu: 'Tipe Pintu', bukaanPintu: 'Bukaan Pintu', cabinSize: 'Ukuran Cabin',
  bahanCabin: 'Bahan Cabin', finishCabin: 'Finishing Cabin', dayaMesin: 'Daya Mesin',
  power: 'Power Supply', grounding: 'Grounding', ard: 'ARD / MCB', intercom: 'Intercom',
  aksesJalan: 'Akses Jalan ke Lokasi', listrikLokasi: 'Listrik di Lokasi', ruangKerja: 'Ruang Kerja',
};

const tampil = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? `${v.length} baris` : '—';
  return String(v);
};

/**
 * Bandingkan dua Data Teknis → daftar perubahan.
 * `arah` menentukan tingkat keparahan temuan (PRD 6E):
 *   kontrak→final : perubahan setelah kontrak = PERHATIAN
 *   final→po      : perubahan setelah Final Survey dikunci = KRITIS
 */
export function bandingkanDt(
  a: DataTeknis | null | undefined,
  b: DataTeknis | null | undefined,
  arah: 'kontrak→final' | 'final→po' | 'sales→final',
): TemuanDiff[] {
  const out: TemuanDiff[] = [];
  const kunci = Array.from(new Set(Object.keys(a || {}).concat(Object.keys(b || {}))));
  for (const k of kunci) {
    if (k === 'lantai' || k === 'addon') continue;
    const lama = tampil((a || {})[k]), baru = tampil((b || {})[k]);
    if (lama === baru) continue;
    out.push({
      jenis: 'perubahan',
      field: k,
      label: LABEL_SISI[k] || k,
      teks: `${lama} → ${baru}`,
      arah,
      tingkat: arah === 'final→po' ? 'kritis' : arah === 'kontrak→final' ? 'perhatian' : 'info',
    });
  }

  // Tabel lantai — bandingkan baris per baris
  const la = (a?.lantai as unknown as Record<string, unknown>[]) || [];
  const lb = (b?.lantai as unknown as Record<string, unknown>[]) || [];
  const n = Math.max(la.length, lb.length);
  for (let i = 0; i < n; i++) {
    const sa = la[i] ? [la[i].lantai, la[i].tinggi, la[i].door, la[i].finishing].map(tampil).join(' · ') : '—';
    const sb = lb[i] ? [lb[i].lantai, lb[i].tinggi, lb[i].door, lb[i].finishing].map(tampil).join(' · ') : '—';
    if (sa === sb) continue;
    out.push({
      jenis: 'perubahan', field: `lantai.${i}`, label: `Lantai ${i + 1}`,
      teks: `${sa} → ${sb}`, arah, tingkat: arah === 'final→po' ? 'kritis' : 'perhatian',
    });
  }

  // Add-on — dibandingkan lewat nama
  const aa = (a?.addon as unknown as Record<string, unknown>[]) || [];
  const ab = (b?.addon as unknown as Record<string, unknown>[]) || [];
  const semuaNama = Array.from(new Set(aa.map(x => String(x.nama)).concat(ab.map(x => String(x.nama)))));
  for (const nm of semuaNama) {
    const da = aa.find(x => String(x.nama) === nm), db = ab.find(x => String(x.nama) === nm);
    const ta = da ? (da.on ? 'Dipesan' : 'Tidak') : '—';
    const tb = db ? (db.on ? 'Dipesan' : 'Tidak') : '—';
    if (ta === tb) continue;
    out.push({
      jenis: 'perubahan', field: `addon.${nm}`, label: `Add-on: ${nm}`,
      teks: `${ta} → ${tb}`, arah, tingkat: arah === 'final→po' ? 'kritis' : 'perhatian',
    });
  }
  return out;
}

/** Kelengkapan data teknis: berapa field yang terisi dari 57. */
export function hitungKelengkapan(dt: DataTeknis | null | undefined, kunciWajib: string[] = []) {
  const semua = Object.entries(dt || {})
    .filter(([k]) => k !== 'lantai' && k !== 'addon');
  const terisi = semua.filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '').length;
  const wajibKosong = kunciWajib.filter(k => !String((dt || {})[k] ?? '').trim());
  return { terisi, total: 57, persen: Math.round((terisi / 57) * 100), wajibKosong };
}
