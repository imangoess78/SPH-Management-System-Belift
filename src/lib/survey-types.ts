// ============================================================
//  SURVEY TEKNIS — katalog field, opsi, dan tipe data
//  Sumber kebenaran: prototipe klien Data_Teknis_Terpadu_Belift.html
//  (Data Teknis 57 field + 20 add-on + tabel lantai).
//
//  Catatan penting soal ADD-ON:
//  prototipe menulis kode pabrik HRStndr, TBAKb, TBCF10, TBCD01.
//  Di SPH produksi kode pabrik yang dipakai adalah HR-Std, TB-Akb,
//  TB-CF10, TB-CD01. Untuk mencegah salah cetak, daftar di bawah
//  memakai kode versi PRODUKSI — dicocokkan lewat nama item.
// ============================================================

/** Kelompok field pada form Data Teknis (urut sesuai prototipe). */
export const KELOMPOK_FIELD = [
  'Spesifikasi Utama',
  'Shaft',
  'Pintu',
  'Cabin',
  'Finishing',
  'Mesin & Kelistrikan',
  'Keselamatan',
  'Lainnya',
] as const;
export type KelompokField = typeof KELOMPOK_FIELD[number];

/** Satu baris tabel add-on. Foto per add-on dicatat di `fotoLink`. */
export interface AddOn {
  kode: string;
  nama: string;
  idn: string;      // terjemahan Indonesia
  on: boolean;      // dipesan
  ada: boolean;     // sudah ada di lokasi
  fotoLink: string; // tautan foto (PRD 6C)
}

/** Satu baris tabel lantai. */
export interface Lantai {
  no: number;
  lantai: string;
  tinggi: string;      // tinggi lantai (mm)
  door: string;        // bukaan pintu
  finishing: string;
}

/** Foto dokumentasi dalam satu slot. */
export interface FotoDok {
  key: string;   // kunci R2 → /api/media?key=…
  nama: string;
}

export interface BarisDokumentasi {
  no: number;
  judul: string;
  ada: boolean;
  foto: FotoDok[];
}

export interface PekerjaanTambahan {
  nama: string;
  on: boolean;
  ket: string;
}

/** Satu butir kesimpulan di akhir form survey (prototipe: 11 pertanyaan). */
export interface ButirKesimpulan {
  q: string;
  jawab: string;
  alasan: string;
}

export interface TtdSurvey {
  sales: string;      // nama penanda tangan (dari sales)
  customer: string;
  surveyor: string;
}

/** Sisanya bebas — kunci field teknis mengikuti DT_FIELDS di bawah. */
export interface DataTeknis {
  [kunci: string]: string | Lantai[] | AddOn[];
}

// ── 57 field Data Teknis ─────────────────────────────────────
//  key      : kunci penyimpanan (JSON di kolom survey_teknis.dt)
//  label    : tulisan yang tercetak di dokumen
//  kel      : kelompok pada form
//  jenis    : 'teks' | 'angka' | 'pilih' | 'tanggal' | 'multi'
export interface FieldDef {
  key: string;
  label: string;
  kel: KelompokField;
  jenis: 'teks' | 'angka' | 'pilih' | 'tanggal' | 'multi';
  opsi?: string[];
  satuan?: string;
  hint?: string;
}

export const DT_FIELDS: FieldDef[] = [
  // ── Spesifikasi Utama (8) ──────────────────────────────────
  { key: 'jenisLift',  label: 'Jenis Lift',        kel: 'Spesifikasi Utama', jenis: 'pilih',
    opsi: ['Home Lift', 'Passenger', 'Goods / Barang', 'Dumbwaiter', 'Car Lift', 'Bed Lift', 'Platform Lift'] },
  { key: 'model',      label: 'Model',             kel: 'Spesifikasi Utama', jenis: 'teks' },
  { key: 'kapasitas',  label: 'Kapasitas',         kel: 'Spesifikasi Utama', jenis: 'teks', satuan: 'kg' },
  { key: 'penumpang',  label: 'Penumpang',         kel: 'Spesifikasi Utama', jenis: 'angka', satuan: 'orang' },
  { key: 'kecepatan',  label: 'Kecepatan',         kel: 'Spesifikasi Utama', jenis: 'teks', satuan: 'm/min' },
  { key: 'sfd',        label: 'Stops / Floors / Doors', kel: 'Spesifikasi Utama', jenis: 'teks', hint: 'mis. 4 / 4 / 4' },
  { key: 'tipeMesin',  label: 'Tipe Mesin',        kel: 'Spesifikasi Utama', jenis: 'pilih',
    opsi: ['Geared Traction', 'Gearless Traction', 'Hydraulic', 'MRL Gearless'] },
  { key: 'drive',      label: 'Sistem Penggerak',  kel: 'Spesifikasi Utama', jenis: 'pilih',
    opsi: ['VVVF', 'AC-2', 'Hydraulic'] },

  // ── Shaft (8) ──────────────────────────────────────────────
  { key: 'shaftSize',   label: 'Ukuran Shaft',       kel: 'Shaft', jenis: 'teks', satuan: 'mm', hint: 'P × L' },
  { key: 'pitDepth',    label: 'Kedalaman Pit',      kel: 'Shaft', jenis: 'teks', satuan: 'mm' },
  { key: 'overhead',    label: 'Overhead',           kel: 'Shaft', jenis: 'teks', satuan: 'mm' },
  { key: 'travelling',  label: 'Travelling Height',  kel: 'Shaft', jenis: 'teks', satuan: 'mm' },
  { key: 'bahanShaft',  label: 'Bahan Konstruksi Shaft', kel: 'Shaft', jenis: 'pilih',
    opsi: ['Beton Bertulang', 'Baja', 'Pasangan Bata', 'Beton + Baja'] },
  { key: 'tebalDinding',label: 'Tebal Dinding',      kel: 'Shaft', jenis: 'teks', satuan: 'mm' },
  { key: 'posisiHoistway', label: 'Posisi Hoistway', kel: 'Shaft', jenis: 'pilih',
    opsi: ['Di dalam bangunan', 'Menempel dinding luar', 'Menonjol ke luar', 'Di luar bangunan'] },
  { key: 'dindingFinish',  label: 'Finishing Dinding Shaft', kel: 'Shaft', jenis: 'teks' },

  // ── Pintu (8) ──────────────────────────────────────────────
  { key: 'tipePintu',     label: 'Tipe Pintu',        kel: 'Pintu', jenis: 'pilih',
    opsi: ['Center Opening', 'Side Opening', 'Manual', 'Semi Automatic'] },
  { key: 'bukaanPintu',   label: 'Bukaan Pintu',      kel: 'Pintu', jenis: 'teks', satuan: 'mm' },
  { key: 'tinggiPintu',   label: 'Tinggi Pintu',      kel: 'Pintu', jenis: 'teks', satuan: 'mm' },
  { key: 'lebarPintu',    label: 'Lebar Pintu',       kel: 'Pintu', jenis: 'teks', satuan: 'mm' },
  { key: 'jumlahPintu',   label: 'Jumlah Pintu per Lantai', kel: 'Pintu', jenis: 'angka' },
  { key: 'bahanPintu',    label: 'Bahan Pintu',       kel: 'Pintu', jenis: 'pilih',
    opsi: ['Stainless Steel', 'Mild Steel + Powder Coating', 'Kaca', 'Kombinasi SS + Kaca'] },
  { key: 'finishPintu',   label: 'Finishing Pintu',   kel: 'Pintu', jenis: 'pilih',
    opsi: ['Hairline SS', 'Mirror SS', 'Titanium', 'Powder Coating', 'Kayu'] },
  { key: 'sillPintu',     label: 'Sill Pintu',        kel: 'Pintu', jenis: 'teks' },

  // ── Cabin (7) ──────────────────────────────────────────────
  { key: 'cabinSize',     label: 'Ukuran Cabin',      kel: 'Cabin', jenis: 'teks', satuan: 'mm', hint: 'P × L × T' },
  { key: 'tinggiCabin',   label: 'Tinggi Cabin',      kel: 'Cabin', jenis: 'teks', satuan: 'mm' },
  { key: 'bahanCabin',    label: 'Bahan Cabin',       kel: 'Cabin', jenis: 'pilih',
    opsi: ['Stainless Steel', 'Mild Steel + Powder Coating', 'Kaca', 'Kombinasi SS + Kaca'] },
  { key: 'finishCabin',   label: 'Finishing Cabin',   kel: 'Cabin', jenis: 'pilih',
    opsi: ['Hairline SS', 'Mirror SS', 'Titanium', 'Powder Coating', 'Kayu', 'Kombinasi'] },
  { key: 'plafonCabin',   label: 'Plafon Cabin',      kel: 'Cabin', jenis: 'teks' },
  { key: 'lantaiCabin',   label: 'Lantai Cabin',      kel: 'Cabin', jenis: 'teks' },
  { key: 'handrail',      label: 'Handrail',          kel: 'Cabin', jenis: 'teks' },

  // ── Finishing (6) ──────────────────────────────────────────
  { key: 'finishLantai',     label: 'Finishing Lantai',     kel: 'Finishing', jenis: 'teks' },
  { key: 'finishDinding',    label: 'Finishing Dinding',    kel: 'Finishing', jenis: 'teks' },
  { key: 'finishPlafon',     label: 'Finishing Plafon',     kel: 'Finishing', jenis: 'teks' },
  { key: 'finishPintuLantai',label: 'Finishing Pintu per Lantai', kel: 'Finishing', jenis: 'teks' },
  { key: 'warnaStruktur',    label: 'Warna Struktur',       kel: 'Finishing', jenis: 'teks' },
  { key: 'finishingStruktur',label: 'Finishing Struktur',   kel: 'Finishing', jenis: 'teks' },

  // ── Mesin & Kelistrikan (8) ────────────────────────────────
  { key: 'dayaMesin',    label: 'Daya Mesin',         kel: 'Mesin & Kelistrikan', jenis: 'teks', satuan: 'kW' },
  { key: 'traksi',       label: 'Traction Ratio',     kel: 'Mesin & Kelistrikan', jenis: 'teks' },
  { key: 'power',        label: 'Power Supply',       kel: 'Mesin & Kelistrikan', jenis: 'teks', hint: 'mis. 220V 1Ph / 380V 3Ph' },
  { key: 'mesinMerk',    label: 'Merk Mesin',         kel: 'Mesin & Kelistrikan', jenis: 'teks' },
  { key: 'posisiMesin',  label: 'Posisi Mesin',       kel: 'Mesin & Kelistrikan', jenis: 'pilih',
    opsi: ['Atas (Machine Room)', 'Atas (MRL / Machine Room Less)', 'Bawah', 'Samping'] },
  { key: 'panelLokasi',  label: 'Lokasi Panel',       kel: 'Mesin & Kelistrikan', jenis: 'teks' },
  { key: 'kabelMeter',   label: 'Kebutuhan Kabel',    kel: 'Mesin & Kelistrikan', jenis: 'teks', satuan: 'm' },
  { key: 'grounding',    label: 'Grounding',          kel: 'Mesin & Kelistrikan', jenis: 'pilih',
    opsi: ['Ada', 'Belum Ada', 'Perlu Dibuat'] },

  // ── Keselamatan (6) ────────────────────────────────────────
  { key: 'ard',            label: 'ARD / MCB',            kel: 'Keselamatan', jenis: 'pilih',
    opsi: ['Ada', 'Belum Ada', 'Perlu Dibuat'] },
  { key: 'emergencyBell',  label: 'Emergency Bell',       kel: 'Keselamatan', jenis: 'pilih',
    opsi: ['Standar', 'Tambahan', 'Tidak Perlu'] },
  { key: 'intercom',       label: 'Intercom',             kel: 'Keselamatan', jenis: 'pilih',
    opsi: ['Ada', 'Belum Ada', 'Perlu Dibuat'] },
  { key: 'alarmSistem',    label: 'Sistem Alarm',         kel: 'Keselamatan', jenis: 'teks' },
  { key: 'governor',       label: 'Governor',             kel: 'Keselamatan', jenis: 'teks' },
  { key: 'safetyGear',     label: 'Safety Gear',          kel: 'Keselamatan', jenis: 'teks' },

  // ── Lainnya (6) ────────────────────────────────────────────
  { key: 'aksesJalan',     label: 'Akses Jalan ke Lokasi', kel: 'Lainnya', jenis: 'pilih',
    opsi: ['Bisa Truk', 'Hanya Kendaraan Kecil', 'Tidak Bisa Kendaraan', 'Perlu Angkat Manual'] },
  { key: 'ruangKerja',     label: 'Ruang Kerja',           kel: 'Lainnya', jenis: 'pilih',
    opsi: ['Cukup', 'Terbatas', 'Tidak Ada'] },
  { key: 'listrikLokasi',  label: 'Listrik di Lokasi',     kel: 'Lainnya', jenis: 'pilih',
    opsi: ['Tersedia', 'Belum Tersedia', 'Perlu Tambahan'] },
  { key: 'airLokasi',      label: 'Air di Lokasi',         kel: 'Lainnya', jenis: 'pilih',
    opsi: ['Tersedia', 'Belum Tersedia'] },
  { key: 'cuaca',          label: 'Kondisi Cuaca Saat Survey', kel: 'Lainnya', jenis: 'teks' },
  { key: 'lainLain',       label: 'Catatan Teknis Lain',   kel: 'Lainnya', jenis: 'teks' },
];

/** 20 add-on — kode = kode pabrik versi PRODUKSI (lihat catatan header). */
export const DAFTAR_ADDON: AddOn[] = [
  { kode: 'HR-Std',  nama: 'Handrail',        idn: 'Pegangan tangan',  on: false, ada: false, fotoLink: '' },
  { kode: 'TB-Akb',  nama: 'Cabin AC',        idn: 'AC kabin',         on: false, ada: false, fotoLink: '' },
  { kode: 'TB-CF10', nama: 'Cabin fan',       idn: 'Kipas kabin',      on: false, ada: false, fotoLink: '' },
  { kode: 'TB-CD01', nama: 'Access card',     idn: 'Akses kartu',      on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'RGB lighting',    idn: 'Lampu RGB',        on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Cabin CCTV',      idn: 'CCTV kabin',       on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Voice announcer', idn: 'Suara pengumuman', on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Cabin mirror',    idn: 'Cermin kabin',     on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Folding seat',    idn: 'Kursi lipat',      on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Emergency light', idn: 'Lampu darurat',    on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Fireman switch',  idn: 'Saklar pemadam',   on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Overload alarm',  idn: 'Alarm beban lebih',on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'UPS backup',      idn: 'Cadangan UPS',     on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Card reader',     idn: 'Pembaca kartu',    on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Door sensor',     idn: 'Sensor pintu',     on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Floor display',   idn: 'Tampilan lantai',  on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Auto door',       idn: 'Pintu otomatis',   on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Panic button',    idn: 'Tombol panik',     on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Ventilation',     idn: 'Ventilasi',        on: false, ada: false, fotoLink: '' },
  { kode: '',        nama: 'Other',           idn: 'Lainnya',          on: false, ada: false, fotoLink: '' },
];

/** 24 slot dokumentasi (urut sesuai form survey klien). */
export const JUDUL_DOKUMENTASI: string[] = [
  'Tampak depan gedung',
  'Tampak samping gedung',
  'Pintu masuk',
  'Lokasi hoistway / shaft',
  'Ukuran shaft — tampak atas',
  'Ukuran shaft — kedalaman pit',
  'Ukuran overhead',
  'Pit (kondisi & kebersihan)',
  'Kondisi dinding shaft',
  'Kondisi lantai dasar',
  'Panel listrik utama',
  'Mcb / arde',
  'Grounding',
  'Akses jalan masuk',
  'Ruang kerja / area pemasangan',
  'Kondisi sekitar lantai atas',
  'Rangkaian lantai (tiap lantai)',
  'Titik lampu / penerangan',
  'Kondisi air & drainase',
  'Ketinggian tiap lantai',
  'Kesiapan struktur (bila ada)',
  'Foto lokasi titik mesin',
  'Foto jalan masuk material',
  'Lain-lain / kondisi khusus',
];

/** 11 butir kesimpulan (prototipe: blok Kesimpulan). */
export const PERTANYAAN_KESIMPULAN: string[] = [
  'Apakah lokasi siap untuk pemasangan?',
  'Apakah ukuran shaft sesuai standar?',
  'Apakah pit & overhead mencukupi?',
  'Apakah daya listrik mencukupi?',
  'Apakah akses jalan memadai?',
  'Apakah ruang kerja mencukupi?',
  'Apakah struktur benar-benar siap?',
  'Apakah perlu pekerjaan sipil tambahan?',
  'Apakah perlu pekerjaan tambahan lain?',
  'Apakah customer memahami lingkup pekerjaan?',
  'Apakah data sudah cukup untuk PO pabrik?',
];

export const OPSI_JAWAB = ['Ya', 'Tidak', 'Perlu Konfirmasi', 'Belum Diperiksa'];

/** Kelengkapan minimum sebelum Final Survey boleh dikunci (PRD S6). */
export const FIELD_WAJIB_KUNCI: string[] = [
  'jenisLift', 'kapasitas', 'kecepatan', 'sfd',
  'shaftSize', 'pitDepth', 'overhead',
  'tipePintu', 'bukaanPintu',
  'cabinSize', 'bahanCabin', 'finishCabin',
  'dayaMesin', 'power',
];

// ── Tipe baris DB ─────────────────────────────────────────────

export interface SurveyRow {
  id: string;
  id_lead: string;
  kode_proyek: string | null;
  jenis: 'sales' | 'final';
  no_survey: string | null;
  tgl_survey: string | null;
  surveyor: string | null;
  disurvey_oleh: string | null;
  pj_lapangan: string | null;
  pj_telp: string | null;
  jam_kerja: string | null;
  dt: string | null;                // JSON DataTeknis — diurai oleh api
  dokumentasi: string | null;
  video_link: string | null;
  pekerjaan_tambahan: string | null;
  catatan_lapangan: string | null;
  catatan_desain: string | null;
  kesimpulan: string | null;
  ttd: string | null;
  terkunci: number;
  dikunci_oleh: string | null;
  dikunci_pada: string | null;
  status: string;
  dibuat_oleh: string | null;
  diubah_oleh: string | null;
  created_at: string;
  updated_at: string;
}

/** SurveyRow yang kolom JSON-nya sudah diurai (dipakai di sisi layar). */
export interface SurveyRowTerurai extends Omit<SurveyRow,
  'dt' | 'dokumentasi' | 'pekerjaan_tambahan' | 'kesimpulan' | 'ttd'> {
  dt: DataTeknis;
  dokumentasi: BarisDokumentasi[];
  pekerjaan_tambahan: PekerjaanTambahan[];
  kesimpulan: ButirKesimpulan[];
  ttd: TtdSurvey;
}

export interface PerubahanField {
  key: string;
  label: string;
  lama: string;
  baru: string;
}

/** Satu baris temuan di mesin diff (PRD D2 + 6E). */
export interface TemuanDiff {
  jenis: 'perubahan' | 'kesenjangan' | 'kritis' | 'catatan';
  field: string;
  label: string;
  teks: string;
  arah: 'sales→final' | 'final→po' | 'kontrak→final' | 'final';
  tingkat: 'info' | 'perhatian' | 'kritis';
}

export interface SurveyTersimpan {
  id: string;
  kode_proyek: string | null;
  jenis: 'sales' | 'final';
  no_survey: string | null;
  tanggal: string | null;
  disurvey_oleh: string | null;
  surveyor: string | null;
  terkunci: boolean;
  dikunci_oleh: string | null;
  dikunci_pada: string | null;
  status: string;
  jml_field_terisi: number;
  jml_field_total: number;
  kelengkapan_persen: number;
  updated_at: string;
}

export interface ProyekRow {
  id: string;
  kode_proyek: string | null;
  id_lead: string;
  nama_proyek: string | null;
  customer: string | null;
  kota: string | null;
  status_terakhir: string | null;
  tahap_sekarang: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiwayatRow {
  id: string;
  jenis: string;
  id_ref: string;
  aksi: string;
  oleh: string | null;
  alasan: string | null;
  catatan: string | null;
  waktu: string;
}

export interface PoRow {
  id: string;
  id_lead: string;
  kode_proyek: string | null;
  no_po: string | null;
  tgl_po: string | null;
  pabrik: string | null;
  pic: string | null;
  rev_terakhir: number;
  status: string;
  catatan: string | null;
  dibuat_oleh: string | null;
  created_at: string;
  updated_at: string;
}

export interface PoRevisiRow {
  id: string;
  id_po: string;
  rev: number;
  tgl_revisi: string | null;
  oleh: string | null;
  alasan: string | null;
  dt: DataTeknis | null;
  perubahan: PerubahanField[];
  jml_perubahan: number;
  perubahan_setelah_final: number;
  created_at: string;
}

/** Batas revisi PO (PRD aturan PO4). */
export const MAKS_REVISI_TANPA_APPROVAL = 3;
