// Pembungkus tipis untuk /api/crm — satu tempat untuk semua panggilan CRM.

const BASE = '/api/crm';

async function minta<T>(params: Record<string, string | number | undefined>, init?: RequestInit): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const r = await fetch(`${BASE}?${qs}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'content-type': 'application/json', ...(init?.headers || {}) } : init?.headers,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `Gagal memuat (${r.status})`);
  return data as T;
}

// ── Tipe data ───────────────────────────────────────────────

export interface Lead {
  id: string;
  kode_lead: string | null;
  waktu_masuk: string | null;
  kode_kanal: string | null;
  nama_prospek: string;
  no_hp: string | null;
  kota: string | null;
  kebutuhan: string | null;
  sales: string | null;
  metode_assign: string | null;
  butuh_jelas: string | null;
  lokasi_siap: string | null;
  budget_masuk: string | null;
  rencana_6bulan: string | null;
  bicara_decider: string | null;
  skor: number;
  kualifikasi: string | null;
  waktu_kontak_pertama: string | null;
  respons_jam: number | null;
  status_terakhir: string | null;
  no_sph: string | null;
  tgl_sph: string | null;
  nilai_sph: number | null;
  diskon_diminta: number | null;
  alasan_diskon: string | null;
  approver_wajib: string | null;
  status_approval: string | null;
  tgl_approval: string | null;
  no_spk: string | null;
  tgl_spk: string | null;
  alasan_gugur: string | null;
  foto_lokasi: { key: string; nama?: string }[];
  lokasi_gps: string | null;
  catatan: string | null;
  diubah_oleh: string | null;
  waktu_diubah: string | null;
  created_at: string;
}

export interface RefKanal { kode: string; kelompok: string; kanal: string; keterangan: string | null; aktif: number; urutan: number }
export interface RefSales { id: string; nama: string; email: string | null; peran: string; status: string; wilayah: string | null; bobot: number; kuota_aktif: number; catatan: string | null }
export interface RefDiskon { id: string; batas_bawah: number; batas_atas: number; approver: string; email_approver: string | null; catatan: string | null }
export interface RefStatus { status: string; urutan: number; pemilik: string | null; keterangan: string | null }
export interface BiayaIklan { id: string; periode: string; kode_kanal: string; biaya: number; catatan: string | null }

export interface BarisKanal {
  kode_kanal: string; nama_kanal: string; kelompok: string;
  jml_lead: number; jml_hot: number; jml_warm: number; jml_cold: number; jml_gugur: number;
  jml_sph: number; jml_deal: number; biaya: number;
  cpl: number | null; cac: number | null;
  konversi_sph: number | null; konversi_deal: number | null;
  nilai_penawaran: number; nilai_deal: number; roas: number | null;
}

export interface RingkasanIklan {
  total_biaya: number; total_lead: number; total_sph: number; total_deal: number;
  cpl: number | null; cac: number | null;
  konversi_sph: number | null; konversi_deal: number | null;
  nilai_deal: number; roas: number | null; lead_tanpa_nilai: number;
}

export interface DokumenRow {
  id: string; id_lead: string; jenis_dokumen: string | null; masuk_meja: string | null;
  sla_jam: number | null; target_selesai: string | null; selesai: string | null;
  lama_jam: number | null; status_sla: string | null; pic_admin: string | null;
  no_dokumen_terbit: string | null; catatan: string | null;
  nama_prospek?: string | null; kode_lead?: string | null; sales?: string | null; kode_kanal?: string | null;
}

export interface Meta {
  kanal: RefKanal[]; sales: RefSales[]; diskon: RefDiskon[]; status: RefStatus[];
}

// ── Leads ───────────────────────────────────────────────────

export const api = {
  meta: () => minta<Meta>({ resource: 'meta' }),

  listLeads: (f: { status?: string; sales?: string; kode_kanal?: string; kualifikasi?: string; q?: string; dari?: string; sampai?: string; page?: number; limit?: number } = {}) =>
    minta<{ data: Lead[]; total: number; page: number; limit: number }>({ resource: 'leads', ...f }),

  getLead: (id: string) =>
    minta<{ data: Lead; riwayat: { id: string; waktu: string; dari_status: string | null; ke_status: string; oleh: string | null; catatan: string | null }[]; dokumen: DokumenRow[] }>({ resource: 'leads', id }),

  createLead: (body: Partial<Lead>) =>
    minta<{ ok: boolean; id: string; kode_lead: string; skor: number; kualifikasi: string }>({ resource: 'leads' }, { method: 'POST', body: JSON.stringify(body) }),

  updateLead: (id: string, body: Partial<Lead> & { catatan_riwayat?: string }) =>
    minta<{ ok: boolean; skor: number; kualifikasi: string }>({ resource: 'leads', id }, { method: 'PUT', body: JSON.stringify(body) }),

  deleteLead: (id: string) => minta<{ ok: boolean }>({ resource: 'leads', id }, { method: 'DELETE' }),

  kanban: (f: { sales?: string; kode_kanal?: string } = {}) =>
    minta<{ kolom: { status: string; urutan: number; pemilik: string | null; leads: Lead[] }[]; total: number }>({ resource: 'kanban', ...f }),

  dashboard: (periode: string) =>
    minta<{ periode: string; ringkasan: RingkasanIklan; per_kanal: BarisKanal[] }>({ resource: 'dashboard', periode }),

  // ── Dokumen ──
  listDokumen: () => minta<{ data: DokumenRow[] }>({ resource: 'dokumen' }),
  createDokumen: (body: Partial<DokumenRow>) => minta<{ ok: boolean }>({ resource: 'dokumen' }, { method: 'POST', body: JSON.stringify(body) }),
  updateDokumen: (id: string, body: Partial<DokumenRow>) => minta<{ ok: boolean }>({ resource: 'dokumen', id }, { method: 'PUT', body: JSON.stringify(body) }),
  deleteDokumen: (id: string) => minta<{ ok: boolean }>({ resource: 'dokumen', id }, { method: 'DELETE' }),

  // ── Master / referensi ──
  listRef: <T,>(resource: 'ref_kanal' | 'ref_sales' | 'ref_diskon' | 'ref_status' | 'biaya_iklan', f: Record<string, string> = {}) =>
    minta<{ data: T[] }>({ resource, ...f }),
  createRef: (resource: string, body: Record<string, unknown>) =>
    minta<{ ok: boolean; id?: string }>({ resource }, { method: 'POST', body: JSON.stringify(body) }),
  updateRef: (resource: string, id: string, body: Record<string, unknown>) =>
    minta<{ ok: boolean }>({ resource, id }, { method: 'PUT', body: JSON.stringify(body) }),
  deleteRef: (resource: string, id: string) =>
    minta<{ ok: boolean }>({ resource, id }, { method: 'DELETE' }),
};
