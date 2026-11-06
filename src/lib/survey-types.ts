// ============================================================
//  SURVEY TEKNIS — katalog field, opsi, dan tipe data
//  Sumber kebenaran: prototipe klien Data_Teknis_Terpadu_Belift.html
//  (Data Teknis + 20 add-on + tabel lantai).
//
//  REVISI KLIEN (6 Nov 2026) — Final Survey:
//   · Kapasitas → dropdown
//   · Tipe Lift → MR / MRL saja
//   · Travelling Height otomatis dari Floor to Floor (tanpa pit)
//   · Total Height (Pit → Overhead) otomatis
//   · Bahan Konstruksi Shaft → dropdown (Beton Bertulang, Baja WF,
//     Baja H Beam, Steel Alloy, Aluminium Alloy)
//   · Tebal Dinding DIHAPUS
//   · Posisi Hoistway → Indoor / Outdoor
//   · Tipe Pintu → "Tipe Bukaan Pintu" (4 opsi)
//   · Jumlah Pintu per Lantai + Sill Pintu DIHAPUS
//   · Bahan Pintu DIHAPUS, Finishing Pintu tetap
//   · + Jenis Cabin; Finishing Cabin → Bahan Cabin (Stainless/Aluminium)
//   · Plafon & Lantai Cabin: pilih GAMBAR dari Database Desain
//   · Finishing & Kebutuhan Kabel tidak wajib
//   · Setiap spec punya Note + boleh lampirkan gambar
//   · Format cetak: No | Parameter | Value | Note, label bahasa Inggris
//
//  CATATAN penting soal ADD-ON:
//  prototipe menulis kode pabrik HRStndr, TBAKb, TBCF10, TBCD01.
//  Di SPH produksi kode pabrik yang dipakai adalah HR-Std, TB-Akb,
//  TB-CF10, TB-CD01. Untuk mencegah salah cetak, daftar di bawah
//  memakai kode versi PRODUKSI — dicocokkan lewat nama item.
//
//  CATATAN soal field yang DIHAPUS klien: field lama tidak dibuang dari
//  katalog. Ditandai `sembunyi: true` — tidak muncul lagi di form, tetapi
//  TETAP tercetak bila dokumen lama menyimpan nilainya. Tanpa ini, Final
//  Survey yang sudah terkunci kehilangan isinya diam-diam.
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

/** Judul kelompok versi bahasa Inggris untuk dokumen cetak. */
export const KELOMPOK_EN: Record<KelompokField, string> = {
  'Spesifikasi Utama': 'Main Specifications',
  'Shaft': 'Shaft',
  'Pintu': 'Door',
  'Cabin': 'Cabin',
  'Finishing': 'Finishing',
  'Mesin & Kelistrikan': 'Machine & Electrical',
  'Keselamatan': 'Safety',
  'Lainnya': 'Others',
};

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

/**
 * Sisanya bebas — kunci field teknis mengikuti DT_FIELDS di bawah.
 * Selain nilai field, dt juga menyimpan:
 *   `note:<key>`       teks Note per spec
 *   `gambar:<key>`     FotoDok[] lampiran per spec / remark
 *   `imgdesain:<key>`  URL gambar pilihan (Plafon & Lantai Cabin)
 *   `remarks`          catatan bebas (editable) + gambar:remarks
 */
export interface DataTeknis {
  [kunci: string]: string | Lantai[] | AddOn[] | FotoDok[];
}

// ── Katalog field Data Teknis ────────────────────────────────
//  key      : kunci penyimpanan (JSON di kolom survey_teknis.dt)
//  label    : tulisan di form (Indonesia)
//  en       : tulisan di dokumen cetak (Inggris / istilah pabrik)
//  kel      : kelompok pada form
//  jenis    : 'teks' | 'angka' | 'pilih' | 'desain' | 'hitung'
//  catatan  : Note baku yang tercetak bila pengisi tidak menulis Note
//  sembunyi : tidak tampil di form, tetapi tetap tercetak bila ada nilainya
export interface FieldDef {
  key: string;
  label: string;
  en: string;
  kel: KelompokField;
  jenis: 'teks' | 'angka' | 'pilih' | 'desain' | 'hitung';
  opsi?: string[];
  satuan?: string;
  hint?: string;
  catatan?: string;
  sembunyi?: boolean;
  /** Hanya untuk jenis 'desain': kategori di tabel design_items. */
  kategori?: 'Ceiling' | 'Floor';
}

/** Pilihan kapasitas (kg) — dropdown, bukan teks bebas. */
export const OPSI_KAPASITAS: string[] = [
  '100', '160', '200', '250', '320', '400', '450',
  '630', '800', '1000', '1250', '1600', '2000',
];

export const DT_FIELDS: FieldDef[] = [
  // ── Spesifikasi Utama ─────────────────────────────────────
  { key: 'jenisLift',  label: 'Jenis Lift',   en: 'Lift Type',      kel: 'Spesifikasi Utama', jenis: 'pilih',
    opsi: ['Home Lift', 'Passenger', 'Goods / Barang', 'Dumbwaiter', 'Car Lift', 'Bed Lift', 'Platform Lift'],
    catatan: 'Sesuai peruntukan bangunan.' },
  { key: 'model',      label: 'Model',        en: 'Model',          kel: 'Spesifikasi Utama', jenis: 'teks' },
  { key: 'kapasitas',  label: 'Kapasitas',    en: 'Capacity',       kel: 'Spesifikasi Utama', jenis: 'pilih',
    opsi: OPSI_KAPASITAS, satuan: 'kg', catatan: 'Rated load.' },
  { key: 'penumpang',  label: 'Penumpang',    en: 'Passengers',     kel: 'Spesifikasi Utama', jenis: 'angka', satuan: 'orang' },
  { key: 'kecepatan',  label: 'Kecepatan',    en: 'Speed',          kel: 'Spesifikasi Utama', jenis: 'teks', satuan: 'm/min' },
  { key: 'sfd',        label: 'Stops / Floors / Doors', en: 'Stops / Floors / Doors', kel: 'Spesifikasi Utama', jenis: 'teks',
    hint: 'mis. 4 / 4 / 4' },
  { key: 'tipeMesin',  label: 'Tipe Lift (MR / MRL)', en: 'Machine Type', kel: 'Spesifikasi Utama', jenis: 'pilih',
    opsi: ['MR', 'MRL'],
    catatan: 'MR = Machine Room; MRL = Machine Room Less.' },
  { key: 'drive',      label: 'Sistem Penggerak', en: 'Drive System', kel: 'Spesifikasi Utama', jenis: 'pilih',
    opsi: ['VVVF', 'AC-2', 'Hydraulic'] },

  // ── Shaft ────────────────────────────────────────────────
  { key: 'shaftSize',    label: 'Ukuran Shaft',  en: 'Shaft Size',   kel: 'Shaft', jenis: 'teks', satuan: 'mm', hint: 'P × L',
    catatan: 'Inside dimension.' },
  { key: 'pitDepth',     label: 'Kedalaman Pit', en: 'Pit Depth',    kel: 'Shaft', jenis: 'teks', satuan: 'mm' },
  { key: 'overhead',     label: 'Overhead',      en: 'Overhead',     kel: 'Shaft', jenis: 'teks', satuan: 'mm' },
  { key: 'travelling',   label: 'Travelling Height', en: 'Travelling Height', kel: 'Shaft', jenis: 'hitung', satuan: 'mm',
    catatan: 'Otomatis: jumlah tinggi antar-lantai (floor to floor), tanpa pit.' },
  { key: 'totalHeight',  label: 'Total Height',  en: 'Total Height (Pit to Overhead)', kel: 'Shaft', jenis: 'hitung', satuan: 'mm',
    catatan: 'Otomatis: Pit + Travelling Height + Overhead.' },
  { key: 'bahanShaft',   label: 'Bahan Konstruksi Shaft', en: 'Shaft Construction', kel: 'Shaft', jenis: 'pilih',
    opsi: ['Beton Bertulang', 'Baja WF', 'Baja H Beam', 'Steel Alloy', 'Aluminium Alloy'] },
  { key: 'posisiHoistway', label: 'Posisi Hoistway', en: 'Hoistway Position', kel: 'Shaft', jenis: 'pilih',
    opsi: ['Indoor', 'Outdoor'] },
  { key: 'dindingFinish',  label: 'Finishing Dinding Shaft', en: 'Shaft Wall Finishing', kel: 'Shaft', jenis: 'teks' },
  // Field lama yang dihapus klien — tetap tercetak bila dokumen lama memilikinya
  { key: 'tebalDinding', label: 'Tebal Dinding', en: 'Wall Thickness', kel: 'Shaft', jenis: 'teks',
    satuan: 'mm', sembunyi: true },

  // ── Pintu ────────────────────────────────────────────────
  { key: 'tipePintu',   label: 'Tipe Bukaan Pintu', en: 'Door Opening Type', kel: 'Pintu', jenis: 'pilih',
    opsi: ['Center Opening', 'Side Opening', 'Single Door', 'Automatical Double Swing Door'] },
  { key: 'bukaanPintu', label: 'Bukaan Pintu',  en: 'Door Opening Size', kel: 'Pintu', jenis: 'teks', satuan: 'mm' },
  { key: 'tinggiPintu', label: 'Tinggi Pintu',  en: 'Door Height',   kel: 'Pintu', jenis: 'teks', satuan: 'mm' },
  { key: 'lebarPintu',  label: 'Lebar Pintu',   en: 'Door Width',    kel: 'Pintu', jenis: 'teks', satuan: 'mm' },
  { key: 'finishPintu', label: 'Finishing Pintu', en: 'Door Finishing', kel: 'Pintu', jenis: 'pilih',
    opsi: ['Hairline SS', 'Mirror SS', 'Titanium', 'Powder Coating', 'Kayu'] },
  // Dihapus klien (Bahan Pintu ditukar dengan Finishing Pintu; jumlah & sill dibuang)
  { key: 'bahanPintu',  label: 'Bahan Pintu',   en: 'Door Material',  kel: 'Pintu', jenis: 'teks', sembunyi: true },
  { key: 'jumlahPintu', label: 'Jumlah Pintu per Lantai', en: 'Doors per Floor', kel: 'Pintu', jenis: 'teks', sembunyi: true },
  { key: 'sillPintu',   label: 'Sill Pintu',    en: 'Door Sill',      kel: 'Pintu', jenis: 'teks', sembunyi: true },

  // ── Cabin ────────────────────────────────────────────────
  { key: 'cabinSize',   label: 'Ukuran Cabin',  en: 'Cabin Size',   kel: 'Cabin', jenis: 'teks', satuan: 'mm', hint: 'P × L × T' },
  { key: 'tinggiCabin', label: 'Tinggi Cabin',  en: 'Cabin Height', kel: 'Cabin', jenis: 'teks', satuan: 'mm' },
  { key: 'jenisCabin',  label: 'Jenis Cabin',   en: 'Cabin Type',   kel: 'Cabin', jenis: 'pilih',
    opsi: ['Full Stainless', 'Premium', 'Luxury', 'Full Panoramic', 'Semi Panoramic', 'SS Glass Door'] },
  { key: 'bahanCabin',  label: 'Bahan Cabin',   en: 'Cabin Material', kel: 'Cabin', jenis: 'pilih',
    opsi: ['Stainless', 'Aluminium'] },
  { key: 'plafonCabin', label: 'Plafon Cabin',  en: 'Cabin Ceiling', kel: 'Cabin', jenis: 'desain',
    kategori: 'Ceiling', catatan: 'Sesuai gambar pilihan.' },
  { key: 'lantaiCabin', label: 'Lantai Cabin',  en: 'Cabin Floor',   kel: 'Cabin', jenis: 'desain',
    kategori: 'Floor', catatan: 'Sesuai gambar pilihan.' },
  { key: 'handrail',    label: 'Handrail',      en: 'Handrail',     kel: 'Cabin', jenis: 'teks' },
  // Diganti menjadi Bahan Cabin — tetap tercetak untuk dokumen lama
  { key: 'finishCabin', label: 'Finishing Cabin', en: 'Cabin Finishing', kel: 'Cabin', jenis: 'teks', sembunyi: true },

  // ── Finishing (tidak wajib diisi) ────────────────────────
  { key: 'finishLantai',     label: 'Finishing Lantai',     en: 'Floor Finishing',     kel: 'Finishing', jenis: 'teks' },
  { key: 'finishDinding',    label: 'Finishing Dinding',    en: 'Wall Finishing',      kel: 'Finishing', jenis: 'teks' },
  { key: 'finishPlafon',     label: 'Finishing Plafon',     en: 'Ceiling Finishing',   kel: 'Finishing', jenis: 'teks' },
  { key: 'finishPintuLantai',label: 'Finishing Pintu per Lantai', en: 'Landing Door Finishing', kel: 'Finishing', jenis: 'teks' },
  { key: 'warnaStruktur',    label: 'Warna Struktur',       en: 'Structure Colour',    kel: 'Finishing', jenis: 'teks' },
  { key: 'finishingStruktur',label: 'Finishing Struktur',   en: 'Structure Finishing', kel: 'Finishing', jenis: 'teks' },

  // ── Mesin & Kelistrikan ──────────────────────────────────
  { key: 'dayaMesin',    label: 'Daya Mesin',    en: 'Motor Power',    kel: 'Mesin & Kelistrikan', jenis: 'teks', satuan: 'kW' },
  { key: 'traksi',       label: 'Traction Ratio', en: 'Traction Ratio', kel: 'Mesin & Kelistrikan', jenis: 'teks' },
  { key: 'power',        label: 'Power Supply',  en: 'Power Supply',   kel: 'Mesin & Kelistrikan', jenis: 'teks',
    hint: 'mis. 220V 1Ph / 380V 3Ph' },
  { key: 'mesinMerk',    label: 'Merk Mesin',    en: 'Machine Brand',  kel: 'Mesin & Kelistrikan', jenis: 'teks' },
  { key: 'posisiMesin',  label: 'Posisi Mesin',  en: 'Machine Position', kel: 'Mesin & Kelistrikan', jenis: 'pilih',
    opsi: ['Atas (Machine Room)', 'Atas (MRL / Machine Room Less)', 'Bawah', 'Samping'] },
  { key: 'panelLokasi',  label: 'Lokasi Panel',  en: 'Panel Location', kel: 'Mesin & Kelistrikan', jenis: 'teks' },
  { key: 'kabelMeter',   label: 'Kebutuhan Kabel', en: 'Cable Requirement', kel: 'Mesin & Kelistrikan', jenis: 'teks', satuan: 'm' },
  { key: 'grounding',    label: 'Grounding',     en: 'Grounding',      kel: 'Mesin & Kelistrikan', jenis: 'pilih',
    opsi: ['Ada', 'Belum Ada', 'Perlu Dibuat'] },

  // ── Keselamatan ──────────────────────────────────────────
  { key: 'ard',            label: 'ARD / MCB',       en: 'ARD / MCB',      kel: 'Keselamatan', jenis: 'pilih',
    opsi: ['Ada', 'Belum Ada', 'Perlu Dibuat'] },
  { key: 'emergencyBell',  label: 'Emergency Bell',  en: 'Emergency Bell', kel: 'Keselamatan', jenis: 'pilih',
    opsi: ['Standar', 'Tambahan', 'Tidak Perlu'] },
  { key: 'intercom',       label: 'Intercom',        en: 'Intercom',       kel: 'Keselamatan', jenis: 'pilih',
    opsi: ['Ada', 'Belum Ada', 'Perlu Dibuat'] },
  { key: 'alarmSistem',    label: 'Sistem Alarm',    en: 'Alarm System',   kel: 'Keselamatan', jenis: 'teks' },
  { key: 'governor',       label: 'Governor',        en: 'Governor',       kel: 'Keselamatan', jenis: 'teks' },
  { key: 'safetyGear',     label: 'Safety Gear',     en: 'Safety Gear',    kel: 'Keselamatan', jenis: 'teks' },

  // ── Lainnya ──────────────────────────────────────────────
  { key: 'aksesJalan',     label: 'Akses Jalan ke Lokasi', en: 'Site Access',      kel: 'Lainnya', jenis: 'pilih',
    opsi: ['Bisa Truk', 'Hanya Kendaraan Kecil', 'Tidak Bisa Kendaraan', 'Perlu Angkat Manual'] },
  { key: 'ruangKerja',     label: 'Ruang Kerja',           en: 'Working Space',    kel: 'Lainnya', jenis: 'pilih',
    opsi: ['Cukup', 'Terbatas', 'Tidak Ada'] },
  { key: 'listrikLokasi',  label: 'Listrik di Lokasi',     en: 'Site Electricity', kel: 'Lainnya', jenis: 'pilih',
    opsi: ['Tersedia', 'Belum Tersedia', 'Perlu Tambahan'] },
  { key: 'airLokasi',      label: 'Air di Lokasi',         en: 'Site Water',       kel: 'Lainnya', jenis: 'pilih',
    opsi: ['Tersedia', 'Belum Tersedia'] },
  { key: 'cuaca',          label: 'Kondisi Cuaca Saat Survey', en: 'Weather Condition', kel: 'Lainnya', jenis: 'teks' },
  { key: 'lainLain',       label: 'Catatan Teknis Lain',   en: 'Other Technical Notes', kel: 'Lainnya', jenis: 'teks' },
];

/** Field yang tampil di form (menyembunyikan field yang dihapus klien). */
export const DT_FIELDS_TAMPIL: FieldDef[] = DT_FIELDS.filter(f => !f.sembunyi);

/** Cari definisi field berdasarkan kunci. */
export const fieldDari = (key: string): FieldDef | undefined => DT_FIELDS.find(f => f.key === key);

// ── Hitungan otomatis (travelling & total height) ───────────

/** Ambil angka pertama dari teks bebas: "3.500 mm" → 3500, "2,2" → 2.2 */
export const angkaDari = (v: unknown): number => {
  const s = String(v ?? '').replace(/\./g, '').replace(',', '.');
  const m = s.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : 0;
};

/**
 * Travelling Height = jumlah tinggi antar-lantai (floor to floor).
 * Lantai dasar tidak dihitung karena tidak ada perjalanan di atasnya —
 * pit TIDAK ikut, sesuai revisi klien.
 */
export function hitungTravelling(lantai: Lantai[] | undefined): number {
  const t = (Array.isArray(lantai) ? lantai : []).map(l => angkaDari(l?.tinggi));
  return Math.round(t.slice(1).reduce((a, b) => a + b, 0));
}

/** Total Height = Pit + Travelling Height + Overhead. */
export function hitungTotalHeight(dt: DataTeknis): number {
  const pit = angkaDari(dt.pitDepth);
  const oh = angkaDari(dt.overhead);
  const travel = hitungTravelling(dt.lantai as Lantai[] | undefined);
  return Math.round(pit + travel + oh);
}

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
  'cabinSize', 'bahanCabin',
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
