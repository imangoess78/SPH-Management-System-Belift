// ============================================================
// CRM LEADS — aturan bisnis terpusat
// Satu-satunya tempat aturan skoring didefinisikan.
// Ubah di sini kalau client minta revisi ambang batas.
// ============================================================

/** 5 kriteria kualifikasi. Tiap "Ya" = 20 poin. Maks 100. */
export const KRITERIA = [
  { key: 'butuh_jelas',    label: 'Butuh Jelas',       petunjuk: 'Kebutuhannya sudah jelas (jenis lift, jumlah lantai)' },
  { key: 'lokasi_siap',    label: 'Lokasi Siap',       petunjuk: 'Lokasi proyek sudah ada dan bisa disurvey' },
  { key: 'budget_masuk',   label: 'Budget Masuk',      petunjuk: 'Anggaran sudah tersedia / disetujui' },
  { key: 'rencana_6bulan', label: 'Rencana 6 Bulan',   petunjuk: 'Rencana pemasangan dalam 6 bulan ke depan' },
  { key: 'bicara_decider', label: 'Bicara Decider',    petunjuk: 'Sudah berbicara dengan pengambil keputusan' },
] as const;

export type KriteriaKey = typeof KRITERIA[number]['key'];
export const POIN_PER_KRITERIA = 20;
export const SKOR_MAKS = KRITERIA.length * POIN_PER_KRITERIA; // 100

/** Pilihan jawaban yang valid untuk tiap kriteria. */
export const PILIHAN_JAWABAN = ['Ya', 'Belum Jelas', 'Tidak'] as const;

/** Ambang batas kualifikasi. HOT = maksimal kehilangan 1 kriteria. */
export const AMBANG = { HOT: 80, WARM: 40 } as const;

export type Kualifikasi = 'HOT' | 'WARM' | 'COLD';

/** Hitung skor dari 5 kriteria. Hanya "Ya" yang memberi poin. */
export function hitungSkor(lead: Partial<Record<KriteriaKey, string | null>>): number {
  return KRITERIA.reduce(
    (total, k) => total + (lead[k.key] === 'Ya' ? POIN_PER_KRITERIA : 0),
    0,
  );
}

/** Terjemahkan skor jadi status kualifikasi. */
export function kualifikasiDariSkor(skor: number): Kualifikasi {
  if (skor >= AMBANG.HOT) return 'HOT';
  if (skor >= AMBANG.WARM) return 'WARM';
  return 'COLD';
}

/** Hitung skor + kualifikasi sekaligus. */
export function nilaiKualifikasi(lead: Partial<Record<KriteriaKey, string | null>>) {
  const skor = hitungSkor(lead);
  return { skor, kualifikasi: kualifikasiDariSkor(skor) };
}

// ── Tampilan ────────────────────────────────────────────────

export const KUALIFIKASI_STYLE: Record<Kualifikasi, { bg: string; text: string; border: string; dot: string; label: string }> = {
  HOT:  { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500',    label: 'HOT' },
  WARM: { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500',  label: 'WARM' },
  COLD: { bg: 'bg-slate-50',  text: 'text-slate-600',  border: 'border-slate-200',  dot: 'bg-slate-400',  label: 'COLD' },
};

/** Status yang dianggap sudah dapat penawaran (untuk konversi SPH). */
export const STATUS_SPH_KEATAS = [
  'SPH Terkirim', 'Negosiasi', 'Menunggu Approval Diskon',
  'Deal - Menunggu Dokumen', 'SPK Disusun', 'SPK Bernomor & Terkirim',
  'SPK Ditandatangani + DP', 'KOM Terjadwal', 'Selesai - Pindah ke File 00',
];

/** Status yang dianggap deal/SPK terbit (untuk konversi Deal & CAC). */
export const STATUS_DEAL_KEATAS = [
  'SPK Ditandatangani + DP', 'KOM Terjadwal', 'Selesai - Pindah ke File 00',
];

export function isSphTerkirim(status: string | null | undefined) {
  return !!status && STATUS_SPH_KEATAS.includes(status);
}
export function isDeal(status: string | null | undefined) {
  return !!status && STATUS_DEAL_KEATAS.includes(status);
}

/** Rupiah ringkas untuk kartu statistik. */
export function formatRupiah(n: number | null | undefined, ringkas = false): string {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (ringkas) {
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
    if (n >= 1_000_000)     return `Rp ${(n / 1_000_000).toFixed(1).replace('.', ',')} jt`;
    if (n >= 1_000)         return `Rp ${(n / 1_000).toFixed(0)} rb`;
  }
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

/** Label periode YYYY-MM -> "Agustus 2026" */
export function labelPeriode(periode: string): string {
  const [y, m] = periode.split('-');
  const bulan = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return `${bulan[Number(m) - 1] ?? m} ${y}`;
}

/** Kelompok kanal untuk pewarnaan. */
export const KELOMPOK_WARNA: Record<string, string> = {
  Paid:      'bg-blue-50 text-blue-700 border-blue-200',
  Organik:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  Affiliate: 'bg-purple-50 text-purple-700 border-purple-200',
  Offline:   'bg-orange-50 text-orange-700 border-orange-200',
  Lainnya:   'bg-slate-50 text-slate-600 border-slate-200',
};
