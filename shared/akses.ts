// ============================================================
//  HAK AKSES — definisi tunggal, dipakai server DAN tampilan
//
//  Ditaruh di shared/ supaya Functions (server) dan src/ (tampilan)
//  membaca daftar yang sama. Kalau definisinya bercabang, tampilan bisa
//  menyembunyikan tombol yang sebenarnya masih bisa ditembus lewat API —
//  itu jenis lubang keamanan yang paling sulit terlihat.
//
//  PENTING: penyembunyian menu di tampilan BUKAN pengamanan. Pengamanan
//  sebenarnya ada di functions/lib/akses.ts yang memeriksa setiap permintaan.
// ============================================================

export const SEMUA = '*' as const;

/** Halaman yang bisa dibuka/ditutup per akun. */
export const HALAMAN = [
  { kunci: 'dashboard', label: 'Dashboard', grup: 'Halaman', keterangan: 'Ringkasan alur proyek dan statistik.' },
  { kunci: 'crm', label: 'CRM Sales', grup: 'Halaman', keterangan: 'Leads, Papan Kanban, Meja Dokumen, Efektivitas Iklan.' },
  { kunci: 'sph', label: 'SPH / SPK', grup: 'Halaman', keterangan: 'Membuat dan melihat dokumen penawaran serta kontrak.' },
  { kunci: 'survey_sales', label: 'Survey Sales', grup: 'Halaman', keterangan: 'Survey awal oleh sales.' },
  { kunci: 'survey_final', label: 'Final Survey', grup: 'Halaman', keterangan: 'Survey teknis akhir sebelum PO pabrik.' },
  { kunci: 'po', label: 'PO Pabrik', grup: 'Halaman', keterangan: 'Pesanan ke pabrik beserta revisinya.' },
  { kunci: 'laporan', label: 'Laporan', grup: 'Halaman', keterangan: 'Rekap kinerja per periode.' },
  { kunci: 'master', label: 'Master Data', grup: 'Halaman', keterangan: 'Data acuan: sales, kanal, diskon, status.' },
  { kunci: 'kalkulator', label: 'Kalkulator', grup: 'Halaman', keterangan: 'Hitung harga per komponen.' },
  { kunci: 'pengaturan', label: 'Pengaturan', grup: 'Halaman', keterangan: 'Pengaturan aplikasi.' },
  { kunci: 'akun', label: 'Manajemen Akun', grup: 'Halaman', keterangan: 'Mengelola akun dan hak akses pengguna lain.' },
  { kunci: 'backup', label: 'Emergency Backup', grup: 'Halaman', keterangan: 'Cadangan data darurat.' },
] as const;

/** Batasan data — menentukan data siapa yang boleh dilihat/diubah. */
export const BATASAN = [
  { kunci: 'lihat_sendiri', label: 'Lihat data sendiri', grup: 'Cakupan Data', keterangan: 'Hanya lead, SPH, survey, dan PO miliknya.' },
  { kunci: 'lihat_semua', label: 'Lihat data semua sales', grup: 'Cakupan Data', keterangan: 'Melihat data seluruh sales.' },
  { kunci: 'ubah_sendiri', label: 'Ubah data sendiri', grup: 'Cakupan Data', keterangan: 'Mengubah data miliknya saja.' },
  { kunci: 'ubah_semua', label: 'Ubah data semua sales', grup: 'Cakupan Data', keterangan: 'Mengubah data sales mana pun.' },
  { kunci: 'hapus_data', label: 'Hapus data', grup: 'Wewenang', keterangan: 'Menghapus lead, survey, dan PO.' },
  { kunci: 'approve_diskon', label: 'Setujui diskon', grup: 'Wewenang', keterangan: 'Menyetujui permintaan diskon di atas batas sales.' },
  { kunci: 'kunci_final', label: 'Kunci Final Survey', grup: 'Wewenang', keterangan: 'Mengunci Final Survey sebagai acuan PO.' },
  { kunci: 'reassign_lead', label: 'Pindahkan lead', grup: 'Wewenang', keterangan: 'Memindahkan lead ke sales lain.' },
] as const;

export type KunciHalaman = (typeof HALAMAN)[number]['kunci'];
export type KunciBatasan = (typeof BATASAN)[number]['kunci'];
export type KunciIzin = KunciHalaman | KunciBatasan;

export const SEMUA_KUNCI: KunciIzin[] = [
  ...HALAMAN.map(h => h.kunci),
  ...BATASAN.map(b => b.kunci),
] as KunciIzin[];

/** Semua izin, dikelompokkan untuk ditampilkan sebagai checklist. */
export const GRUP: { nama: string; izin: { kunci: KunciIzin; label: string; keterangan: string }[] }[] = [
  ...['Halaman', 'Cakupan Data', 'Wewenang'].map(grup => ({
    nama: grup === 'Halaman' ? 'Halaman yang boleh dibuka'
        : grup === 'Cakupan Data' ? 'Cakupan data'
        : 'Wewenang tambahan',
    izin: [...HALAMAN, ...BATASAN]
      .filter(x => x.grup === grup)
      .map(x => ({ kunci: x.kunci as KunciIzin, label: x.label, keterangan: x.keterangan })),
  })),
];

export const IZIN: Record<string, { label: string; keterangan: string }> = Object.fromEntries(
  [...HALAMAN, ...BATASAN].map(x => [x.kunci, { label: x.label, keterangan: x.keterangan }]),
);

export function labelIzin(kunci: string): string {
  return IZIN[kunci]?.label || kunci;
}

/** Peran yang dikenali. `staff` dipertahankan agar akun lama tetap sah. */
export const PERAN = ['admin', 'direktur', 'manager', 'sales', 'staff'] as const;
export type Peran = (typeof PERAN)[number];

export const LABEL_PERAN: Record<Peran, string> = {
  admin: 'Admin',
  direktur: 'Direktur',
  manager: 'Manager',
  sales: 'Sales',
  staff: 'Staff',
};

export function labelPeran(p?: string | null): string {
  return LABEL_PERAN[normalisasiPeran(p)];
}

/**
 * Bawaan izin per peran. Dipakai saat akun belum punya izin khusus, dan
 * sebagai titik awal saat admin memilih peran di Manajemen Akun.
 *
 * Catatan: `admin` memakai tanda bintang, jadi peran ini selalu punya
 * seluruh izin — termasuk izin baru yang ditambahkan di kemudian hari.
 * Tanpa itu, admin bisa terkunci dari fitur baru hanya karena daftarnya
 * belum diperbarui.
 */
export const IZIN_PER_PERAN: Record<Peran, KunciIzin[] | typeof SEMUA> = {
  admin: SEMUA,

  // Direktur: melihat seluruh data dan menyetujui diskon, tetapi tidak
  // mengubah data operasional dan tidak mengelola akun.
  direktur: [
    'dashboard', 'crm', 'sph', 'survey_sales', 'survey_final', 'po',
    'laporan', 'master', 'kalkulator',
    'lihat_sendiri', 'lihat_semua', 'ubah_sendiri',
    'approve_diskon', 'kunci_final',
  ],

  // Manager: mengelola tim dan seluruh data, kecuali pengaturan sistem.
  manager: [
    'dashboard', 'crm', 'sph', 'survey_sales', 'survey_final', 'po',
    'laporan', 'master', 'kalkulator',
    'lihat_sendiri', 'lihat_semua', 'ubah_sendiri', 'ubah_semua',
    'approve_diskon', 'kunci_final', 'reassign_lead',
  ],

  // Sales: hanya data sendiri, dan tidak boleh membuka Laporan / Akun.
  sales: [
    'dashboard', 'crm', 'sph', 'survey_sales',
    'lihat_sendiri', 'ubah_sendiri',
  ],

  // Staff: admin kantor — memproses dokumen seluruh sales, tanpa wewenang
  // menyetujui diskon atau mengelola akun.
  staff: [
    'dashboard', 'sph', 'survey_sales', 'survey_final', 'po',
    'master', 'kalkulator',
    'lihat_sendiri', 'lihat_semua', 'ubah_sendiri', 'ubah_semua',
    'kunci_final',
  ],
};

/** Normalisasi peran dari database; apa pun yang tak dikenal jadi `staff`. */
export function normalisasiPeran(role?: string | null): Peran {
  const r = String(role || '').toLowerCase();
  return (PERAN as readonly string[]).includes(r) ? (r as Peran) : 'staff';
}

/**
 * Daftar izin efektif seorang pengguna.
 * Izin khusus (`permissions`) menang atas bawaan peran. Array kosong
 * berarti benar-benar tanpa izin — itu pilihan yang sah, bukan "pakai bawaan".
 */
export function izinEfektif(role?: string | null, permissions?: string | null | string[]): string[] {
  let khusus: string[] | null = null;
  if (Array.isArray(permissions)) khusus = permissions;
  else if (typeof permissions === 'string' && permissions.trim()) {
    try {
      const p = JSON.parse(permissions);
      if (Array.isArray(p)) khusus = p;
    } catch { /* pakai bawaan peran */ }
  }
  if (khusus) return khusus;

  const bawaan = IZIN_PER_PERAN[normalisasiPeran(role)];
  return bawaan === SEMUA ? [...SEMUA_KUNCI] : [...bawaan];
}

/** Apakah pemakai punya izin tertentu. `admin` selalu ya. */
export function boleh(izin: string[], kunci: KunciIzin): boolean {
  return izin.includes(SEMUA) || izin.includes(kunci);
}

/** Cakupan data efektif: `semua` bila punya lihat_semua, selain itu `sendiri`. */
export function cakupanLihat(izin: string[]): 'semua' | 'sendiri' {
  return boleh(izin, 'lihat_semua') ? 'semua' : 'sendiri';
}

export function cakupanUbah(izin: string[]): 'semua' | 'sendiri' | 'tidak' {
  if (boleh(izin, 'ubah_semua')) return 'semua';
  if (boleh(izin, 'ubah_sendiri')) return 'sendiri';
  return 'tidak';
}
