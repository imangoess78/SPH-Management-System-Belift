/* Inti hitung Kalkulator Dinamis — Belift
 * ============================================================
 * Ditaruh di shared/ karena dipakai DUA sisi: halaman dashboard (src/) untuk
 * menghitung, dan functions/api/kalkulator.ts untuk memvalidasi serta
 * menyiapkan angka bawaan. Kalau keduanya punya salinan sendiri, angka di
 * layar bisa berbeda dari yang dianggap sah oleh server.
 *
 * Logika hitung DIANGKAT UTUH dari src/pages/Kalkulator.tsx
 * (yang merupakan port dari kalkulator_belift.xlsx). Bedanya cuma satu:
 * semua angka yang dulu tertanam di kode sekarang datang lewat parameter
 * `cfg`, sehingga admin bisa mengubahnya dari dashboard tanpa deploy.
 *
 * ATURAN PENTING: file ini fungsi murni. Tanpa akses jaringan, tanpa state,
 * tanpa efek samping. Itulah yang membuat hasilnya bisa diuji dan
 * dibandingkan angka-per-angka dengan kalkulator lama.
 *
 * Kalkulator lama di /kalkulator TIDAK memakai file ini dan tidak diubah
 * sama sekali — ia tetap jadi acuan selama masa peralihan.
 */

// ── Bentuk konfigurasi ───────────────────────────────────────
/** Opsi berbayar: satu baris = satu pilihan (kabin, pintu, lokasi, dll). */
export interface OpsiHarga {
  nama: string;
  /** Harga dalam satuan baris itu (USD untuk kabin/pintu, IDR untuk lokasi). */
  harga: number;
}

/** Saklar YA/TIDAK berbayar, mis. Handrail 45 USD. */
export interface SaklarHarga {
  nama: string;
  harga: number;
}

export interface KonfigKalkulator {
  /** Kurs USD → IDR dan faktor biaya masuk (bea/ongkos) di atasnya. */
  kurs: { usd_idr: number; faktor_biaya_masuk: number };
  /** Tarif PPN efektif dalam persen. */
  ppn_persen: number;

  /** Tabel harga unit dasar per kombinasi kapasitas & kecepatan. */
  unit_dasar: { kapasitas: number; kecepatan: number; usd: number }[];
  /** Harga USD per penambahan 1 lantai di atas lantai minimum. */
  usd_per_lantai_tambahan: number;

  kabin: OpsiHarga[];
  pintu: OpsiHarga[];
  bukaan: { nama: string; usd_dasar: number; usd_per_lantai_tambahan: number }[];
  lantai_kabin: { nama: string; usd: number }[];
  panel_cop_lop: { nama: string; usd_cop: number; usd_lop_per_lantai: number }[];

  shaft: { nama: string; usd_per_meter: number }[];
  /** Nama shaft yang berarti "tidak dikerjakan Belift" (murni teks, bukan harga). */
  shaft_oleh_pelanggan: string;
  /** Harga dinding kaca per meter bila dinding = "Include". */
  dinding_kaca: { nama_include: string; usd_per_meter: number };
  outdoor: { nama_ya: string; usd_per_lantai: number; idr_finishing_per_lantai: number };

  instalasi: {
    idr_per_lantai: number;
    /** Lantai di bawah angka ini dinaikkan dulu (input mustahil). */
    lantai_minimum_input: number;
    idr_per_lantai_shaft: number;
    idr_per_lantai_kaca: number;
  };

  addon: SaklarHarga[];

  lokasi: OpsiHarga[];
  /** Biaya tetap proyek (sebelumnya 7.000.000 + 25.000.000). */
  biaya_tetap_idr: number;

  /** Pembagi margin: harga jual = biaya / pembagi, jadi margin = 1 - pembagi. */
  margin: { pembagi_shaft_belift: number; pembagi_shaft_pelanggan: number };

  /** Opsi bawaan saat halaman dibuka. */
  bawaan: {
    kapasitas: number;
    kecepatan: number;
    lantai: number;
    tinggi_mm: number;
    kabin: string;
    pintu: string;
    bukaan: string;
    lantai_kabin: string;
    shaft: string;
    dinding: string;
    cop: string;
    lop: string;
    outdoor: string;
    handrail: string;
    ic_card: string;
    ac: string;
    knob: string;
    stabilizer: string;
    lokasi: string;
  };
}

// ── Konfigurasi bawaan = salinan PERSIS angka kalkulator lama ─
/**
 * Jangan mengubah angka di sini untuk menyesuaikan harga. Ini titik nol
 * (baseline) yang menjamin hitungan baru identik dengan kalkulator lama;
 * perubahan harga dilakukan admin lewat dashboard, yang tersimpan di D1.
 */
export const KONFIG_BAWAAN: KonfigKalkulator = {
  kurs: { usd_idr: 17730, faktor_biaya_masuk: 1.145 },
  ppn_persen: 11,

  unit_dasar: [
    { kapasitas: 450, kecepatan: 0.4, usd: 6350 },
    { kapasitas: 450, kecepatan: 0.6, usd: 6580 },
    { kapasitas: 450, kecepatan: 1, usd: 6580 },
    { kapasitas: 630, kecepatan: 0.4, usd: 6580 },
    { kapasitas: 630, kecepatan: 0.6, usd: 6810 },
    { kapasitas: 630, kecepatan: 1, usd: 6810 },
  ],
  usd_per_lantai_tambahan: 450,

  kabin: [
    { nama: 'Standard Silver HSS', harga: 0 },
    { nama: 'Etched HSS', harga: 460 },
    { nama: 'HSS Panoramic', harga: 985 },
    { nama: 'HSS GOLD/BLACK TITANIUM', harga: 758 },
    { nama: 'Alumunium Panoramic', harga: 1402 },
    { nama: 'Panoramic with HSS GOLD/BLACK TITANIUM', harga: 1212 },
  ],
  pintu: [
    { nama: 'Standard HSS', harga: 0 },
    { nama: 'Standard GOLD/BLACK TITANIUM', harga: 91 },
    { nama: 'Glass HSS', harga: 197 },
    { nama: 'Glass HSS GOLD/BLACK TITANIUM', harga: 227 },
    { nama: 'Panoramic Alumunium Narrow', harga: 258 },
    { nama: 'Panoramic Frameless', harga: 265 },
  ],
  bukaan: [
    { nama: 'Center Opening', usd_dasar: 0, usd_per_lantai_tambahan: 0 },
    { nama: 'Side Opening', usd_dasar: 220, usd_per_lantai_tambahan: 50 },
  ],
  lantai_kabin: [
    { nama: 'PVC', usd: 0 },
    { nama: 'Non-PVC (marmer/granit)', usd: 250 },
  ],
  panel_cop_lop: [
    { nama: 'Standard', usd_cop: 0, usd_lop_per_lantai: 0 },
    { nama: 'GOLD/BLACK TI', usd_cop: 152, usd_lop_per_lantai: 23 },
  ],

  shaft: [
    { nama: 'None (by customer)', usd_per_meter: 0 },
    { nama: 'Alumunium Shaft', usd_per_meter: 294 },
    { nama: 'Steel Shaft', usd_per_meter: 175 },
  ],
  shaft_oleh_pelanggan: 'None (by customer)',
  dinding_kaca: {
    nama_include: 'Include',
    /** Harga kaca penuh per meter (USD), sudah termasuk rangka shaft-nya. */
    usd_per_meter: 415,
  },
  outdoor: { nama_ya: 'YES', usd_per_lantai: 305, idr_finishing_per_lantai: 1500000 },

  instalasi: {
    idr_per_lantai: 7500000,
    lantai_minimum_input: 2,
    idr_per_lantai_shaft: 1000000,
    idr_per_lantai_kaca: 1000000,
  },

  addon: [
    { nama: 'Handrail', harga: 45 },
    { nama: 'IC Card', harga: 220 },
    { nama: 'AC', harga: 555 },
    { nama: 'Knob', harga: 230 },
    { nama: 'Stabilizer', harga: 530 },
  ],

  lokasi: [
    { nama: 'Jabodetabek', harga: 0 },
    { nama: 'Jawa Barat', harga: 15000000 },
    { nama: 'Jawa Tengah & Yogyakarta', harga: 18000000 },
    { nama: 'Jawa Timur & Bali', harga: 19000000 },
    { nama: 'Kota Besar Sumatera', harga: 40000000 },
    { nama: 'Kota Besar Kalimantan', harga: 50000000 },
    { nama: 'Kota Besar Sulawesi', harga: 55000000 },
    { nama: 'Kota Kecil Indonesia Barat dan Tengah', harga: 70000000 },
    { nama: 'Indonesia Timur', harga: 90000000 },
  ],
  biaya_tetap_idr: 7000000 + 25000000,

  margin: { pembagi_shaft_belift: 0.8, pembagi_shaft_pelanggan: 0.75 },

  bawaan: {
    kapasitas: 450,
    kecepatan: 0.4,
    lantai: 2,
    tinggi_mm: 20000,
    kabin: 'Standard Silver HSS',
    pintu: 'Standard HSS',
    bukaan: 'Center Opening',
    lantai_kabin: 'PVC',
    shaft: 'None (by customer)',
    dinding: 'None (by customer)',
    cop: 'Standard',
    lop: 'Standard',
    outdoor: 'NO',
    handrail: 'NO',
    ic_card: 'NO',
    ac: 'NO',
    knob: 'NO',
    stabilizer: 'NO',
    lokasi: 'Jabodetabek',
  },
};

// ── Masukan & hasil ─────────────────────────────────────────
export interface MasukanKalkulator {
  kapasitas: number;
  kecepatan: number;
  lantai: number;
  tinggi_mm: number;
  kabin: string;
  pintu: string;
  bukaan: string;
  lantai_kabin: string;
  shaft: string;
  dinding: string;
  cop: string;
  lop: string;
  outdoor: string;
  handrail: string;
  ic_card: string;
  ac: string;
  knob: string;
  stabilizer: string;
  lokasi: string;
  /**
   * Timpa kurs & PPN untuk satu perhitungan saja (simulasi "kalau kurs naik").
   * Kosongkan untuk memakai angka yang ditetapkan admin.
   */
  kurs?: number;
  ppn_persen?: number;
}

export interface BarisKomponen {
  nama: string;
  rincian: string;
  /** Harga jual komponen (sudah termasuk margin). */
  nilai: number;
}

export interface HasilKalkulator {
  komponen: BarisKomponen[];
  hargaJual: number;
  ppn: number;
  grandTotal: number;
  adaShaft: boolean;
  /** USD → IDR termasuk faktor biaya masuk, ditampilkan supaya bisa diperiksa. */
  kursEfektif: number;
  /** Biaya dasar (sebelum margin) tiap kelompok — dipakai layar admin. */
  biaya: {
    unit: number;
    struktur: number;
    instalasi: number;
    addon: number;
    pengiriman: number;
  };
}

const cariHarga = (daftar: OpsiHarga[], nama: string): number =>
  daftar.find((x) => x.nama === nama)?.harga ?? 0;

/** Harga unit dasar: cocokkan tepat; kalau tidak ada, pakai kombinasi terdekat. */
export function hargaUnitDasar(cfg: KonfigKalkulator, kapasitas: number, kecepatan: number): number {
  const tepat = cfg.unit_dasar.find(
    (u) => u.kapasitas === kapasitas && u.kecepatan === kecepatan,
  );
  if (tepat) return tepat.usd;

  // Cadangan: kapasitas sama dulu, baru kecepatan terdekat; kalau tidak ada
  // sama sekali, baris terakhir (perilaku `return 6810` di kalkulator lama).
  const seKapasitas = cfg.unit_dasar.filter((u) => u.kapasitas === kapasitas);
  const kandidat = seKapasitas.length ? seKapasitas : cfg.unit_dasar;
  if (!kandidat.length) return 0;
  return [...kandidat].sort(
    (a, b) => Math.abs(a.kecepatan - kecepatan) - Math.abs(b.kecepatan - kecepatan),
  )[0].usd;
}

/**
 * Hitung harga. Rumusnya SAMA dengan kalkulator lama:
 *
 *   biaya USD × kurs × faktor biaya masuk  →  Rupiah
 *   tiap komponen dibagi pembagi margin    →  harga jual
 *   harga jual + PPN                       →  grand total
 *
 * Margin menempel proporsional di tiap komponen, jadi jumlah harga jual
 * tetap sama dengan total biaya ÷ pembagi — tidak ada selisih pembulatan.
 */
export function hitungKalkulator(cfg: KonfigKalkulator, m: MasukanKalkulator): HasilKalkulator {
  // Lantai di bawah minimum_input dinaikkan (input mustahil), sama seperti
  // `commitLantai` di kalkulator lama.
  const lantai = Math.max(
    cfg.instalasi.lantai_minimum_input,
    Math.floor(m.lantai) || cfg.instalasi.lantai_minimum_input,
  );
  const tinggiMeter = (Number(m.tinggi_mm) || 0) / 1000;
  const adaShaft = m.shaft !== cfg.shaft_oleh_pelanggan;
  const outdoor = m.outdoor === cfg.outdoor.nama_ya;
  const imp = (Number(m.kurs) || cfg.kurs.usd_idr) * cfg.kurs.faktor_biaya_masuk; // USD → IDR efektif

  const lantaiTambahan = Math.max(0, lantai - cfg.instalasi.lantai_minimum_input);

  /* 1. Unit lift */
  const usd1 =
    hargaUnitDasar(cfg, m.kapasitas, m.kecepatan) +
    lantaiTambahan * cfg.usd_per_lantai_tambahan +
    cariHarga(cfg.kabin, m.kabin) +
    cariHarga(cfg.pintu, m.pintu) * (lantai + 1) +
    (() => {
      const b = cfg.bukaan.find((x) => x.nama === m.bukaan);
      return b ? b.usd_dasar + lantaiTambahan * b.usd_per_lantai_tambahan : 0;
    })() +
    (cfg.panel_cop_lop.find((x) => x.nama === m.cop)?.usd_cop ?? 0) +
    (cfg.panel_cop_lop.find((x) => x.nama === m.lop)?.usd_lop_per_lantai ?? 0) * lantai +
    (cfg.lantai_kabin.find((x) => x.nama === m.lantai_kabin)?.usd ?? 0);

  /* 2. Struktur & finishing */
  const shaftInfo = cfg.shaft.find((x) => x.nama === m.shaft);
  const dindingInclude = m.dinding === cfg.dinding_kaca.nama_include;

  // Dinding kaca ditagih SELISIHNYA terhadap shaft yang benar-benar dipakai.
  //
  // Kalkulator lama selalu mengurangi tarif shaft ALUMUNIUM (294) dari harga
  // kaca (415), berapa pun shaft yang dipilih. Akibatnya:
  //   • shaft baja (175) + kaca  → 175 + (415−294) = 296/m  (kaca "diskon" 119)
  //   • shaft pelanggan + kaca   →       (415−294) = 121/m  (kaca dinilai 121
  //     saja padahal harganya 415 — kerugian besar)
  // Di sini pengurangnya adalah tarif shaft yang dipakai, sehingga
  // shaft + kaca selalu berjumlah tepat harga kaca penuh.
  const tarifShaft = adaShaft && shaftInfo ? shaftInfo.usd_per_meter : 0;
  const usdDinding = Math.max(
    0, cfg.dinding_kaca.usd_per_meter - tarifShaft,
  );
  const usd2 =
    (adaShaft ? tinggiMeter * tarifShaft : 0) +
    (dindingInclude ? tinggiMeter * usdDinding : 0) +
    (outdoor ? cfg.outdoor.usd_per_lantai * (lantai - 1) : 0);
  const idr2 = outdoor ? lantai * cfg.outdoor.idr_finishing_per_lantai : 0;

  /* 3. Instalasi lift, struktur, kaca */
  // Ditagih sesuai jumlah lantai sebenarnya. Kalkulator lama memakai
  // `lt === 2 ? 3 : lt`, sehingga gedung 2 lantai tetap dibebani ongkos
  // tenaga kerja 3 lantai. Itu bug hitung, bukan kebijakan harga, dan sudah
  // diperbaiki di kalkulator dinamis.
  const idr3 =
    lantai * cfg.instalasi.idr_per_lantai +
    (adaShaft ? lantai * cfg.instalasi.idr_per_lantai_shaft : 0) +
    (adaShaft ? lantai * cfg.instalasi.idr_per_lantai_kaca : 0);
  if (process.env.DEBUG_PARITAS) {
    console.log('  [produksi] lantai=', lantai, 'idr_per_lantai=', cfg.instalasi.idr_per_lantai, 'idr3=', idr3);
  }

  /* 4. Add-on lainnya */
  const nilaiAddon: Record<string, string> = {
    'Handrail': m.handrail,
    'IC Card': m.ic_card,
    'AC': m.ac,
    'Knob': m.knob,
    'Stabilizer': m.stabilizer,
  };
  // Dijumlahkan eksplisit, bukan `reduce`, supaya nilai yang tidak sah dari
  // hasil suntingan admin (string kosong, NaN) tidak merambat jadi NaN di
  // seluruh harga. Satu add-on rusak cukup dianggap 0.
  let usd4 = 0;
  for (const a of cfg.addon) {
    if (nilaiAddon[a.nama] === 'YES') usd4 += Number(a.harga) || 0;
  }

  /* 5. Pengiriman & biaya tetap */
  const idr5 = cariHarga(cfg.lokasi, m.lokasi) + cfg.biaya_tetap_idr;

  const pembagi = adaShaft ? cfg.margin.pembagi_shaft_belift : cfg.margin.pembagi_shaft_pelanggan;
  const biaya = {
    unit: usd1 * imp,
    struktur: usd2 * imp + idr2,
    instalasi: idr3,
    addon: usd4 * imp,
    pengiriman: idr5,
  };

  const mentah: BarisKomponen[] = [
    { nama: 'Harga unit lift', rincian: 'Mesin, kabin, pintu, COP & LOP', nilai: biaya.unit / pembagi },
    {
      nama: 'Struktur & finishing',
      rincian: adaShaft
        ? m.shaft + (dindingInclude ? ' + dinding kaca' : '')
        : 'Shaft oleh pelanggan',
      nilai: biaya.struktur / pembagi,
    },
    { nama: 'Instalasi lift, struktur & kaca', rincian: 'Tenaga kerja pemasangan di lokasi', nilai: biaya.instalasi / pembagi },
    { nama: 'Add-on lainnya', rincian: 'Handrail, IC card, AC, knob, stabilizer', nilai: biaya.addon / pembagi },
    { nama: 'Pengiriman & biaya tetap', rincian: m.lokasi, nilai: biaya.pengiriman / pembagi },
  ];

  const hargaJual = mentah.reduce((a, b) => a + b.nilai, 0);
  const ppnPersen = Number.isFinite(m.ppn_persen) ? Number(m.ppn_persen) : cfg.ppn_persen;
  const ppn = hargaJual * (ppnPersen / 100);

  return {
    komponen: mentah,
    hargaJual,
    ppn,
    grandTotal: hargaJual + ppn,
    adaShaft,
    kursEfektif: imp,
    biaya,
  };
}

// ── Bantuan tampilan ────────────────────────────────────────
export const rp = (n: number) => Math.round(n).toLocaleString('id-ID');

// ── Pembanding konfigurasi (untuk riwayat harga) ────────────
export interface Perubahan {
  jalur: string;
  dari: unknown;
  ke: unknown;
}

/**
 * Ubah dua dokumen konfigurasi jadi daftar perubahan datar (jalur → dari/ke).
 *
 * Dipakai untuk riwayat harga. Tanpa ini riwayat hanya berbunyi "ada yang
 * menyimpan", yang tidak menjawab pertanyaan sebenarnya: HARGA APA yang berubah.
 */
export function bedakan(lama: unknown, baru: unknown, jalur = ''): Perubahan[] {
  const hasil: Perubahan[] = [];

  // `undefined` disamakan dengan `null` — keduanya berarti "tidak ada".
  // Tanpa ini, opsi yang baru ditambahkan tercatat sebagai "seluruh objek
  // berubah" alih-alih satu harga spesifik, dan `bedakan(undefined, {a:1})`
  // salah melaporkan jalur '(akar)'.
  const kosong = (v: unknown) => v === undefined || v === null;
  if (kosong(lama) && kosong(baru)) return hasil;
  if (kosong(lama)) {
    if (typeof baru === 'object') return bedakan({}, baru, jalur);
    hasil.push({ jalur: jalur || '(akar)', dari: null, ke: baru });
    return hasil;
  }
  if (kosong(baru)) {
    if (typeof lama === 'object') return bedakan(lama, {}, jalur);
    hasil.push({ jalur: jalur || '(akar)', dari: lama, ke: null });
    return hasil;
  }

  const objek = (v: unknown) => v !== null && typeof v === 'object';

  if (Array.isArray(lama) || Array.isArray(baru)) {
    const a = Array.isArray(lama) ? lama : [];
    const b = Array.isArray(baru) ? baru : [];
    const panjang = Math.max(a.length, b.length);
    for (let i = 0; i < panjang; i++) {
      // Baris opsi dikenali lewat `nama` supaya riwayat berbunyi
      // "kabin.HSS Panoramic" dan bukan "kabin.3" — nomor urut berubah
      // setiap kali admin menambah atau menghapus opsi.
      const label = (b[i] ?? a[i]) as { nama?: unknown } | undefined;
      const bagian = label && typeof label.nama === 'string' ? label.nama : String(i);
      hasil.push(...bedakan(a[i], b[i], jalur ? `${jalur}.${bagian}` : bagian));
    }
    return hasil;
  }

  if (objek(lama) && objek(baru)) {
    const a = lama as Record<string, unknown>;
    const b = baru as Record<string, unknown>;
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      // `nama` dipakai sebagai LABEL di jalur, jadi ia identitas opsi, bukan
      // isinya. Kalau ikut dibandingkan, menambah opsi "Bali" menghasilkan
      // dua baris — `lokasi.Bali.nama` dan `lokasi.Bali.harga` — dan yang
      // pertama berbunyi "opsi Bali kehilangan namanya", padahal justru baru
      // ditambahkan.
      if (k === 'nama' && typeof a[k] === 'string' && a[k] === b[k]) continue;
      if (k === 'nama' && (a[k] === undefined || b[k] === undefined)) continue;
      hasil.push(...bedakan(a[k], b[k], jalur ? `${jalur}.${k}` : k));
    }
    return hasil;
  }

  // Angka dibandingkan sebagai angka: JSON menyimpan 11 dan 11.0 sama, tapi
  // hasil suntingan form bisa datang sebagai string "11".
  const samakan = (v: unknown) => {
    if (v === undefined || v === null) return '';
    const n = Number(v);
    return Number.isFinite(n) && String(v).trim() !== '' ? n : String(v);
  };
  if (samakan(lama) !== samakan(baru)) {
    hasil.push({ jalur: jalur || '(akar)', dari: lama ?? null, ke: baru ?? null });
  }
  return hasil;
}

/**
 * Gabungkan konfigurasi tersimpan dengan bawaan.
 *
 * Data dari D1 bisa saja belum lengkap (kolom baru, baris hasil suntingan
 * manual). Yang tidak ada di data tersimpan diambil dari bawaan, supaya
 * kalkulator tidak pernah menampilkan Rp 0 hanya karena satu kunci hilang.
 */
export function gabungKonfig(sebagian: unknown): KonfigKalkulator {
  if (!sebagian || typeof sebagian !== 'object') return KONFIG_BAWAAN;
  const s = sebagian as Partial<KonfigKalkulator>;

  return {
    kurs: { ...KONFIG_BAWAAN.kurs, ...(s.kurs || {}) },
    ppn_persen: Number(s.ppn_persen ?? KONFIG_BAWAAN.ppn_persen),
    unit_dasar: Array.isArray(s.unit_dasar) && s.unit_dasar.length ? s.unit_dasar : KONFIG_BAWAAN.unit_dasar,
    usd_per_lantai_tambahan: Number(s.usd_per_lantai_tambahan ?? KONFIG_BAWAAN.usd_per_lantai_tambahan),
    kabin: Array.isArray(s.kabin) && s.kabin.length ? s.kabin : KONFIG_BAWAAN.kabin,
    pintu: Array.isArray(s.pintu) && s.pintu.length ? s.pintu : KONFIG_BAWAAN.pintu,
    bukaan: Array.isArray(s.bukaan) && s.bukaan.length ? s.bukaan : KONFIG_BAWAAN.bukaan,
    lantai_kabin: Array.isArray(s.lantai_kabin) && s.lantai_kabin.length ? s.lantai_kabin : KONFIG_BAWAAN.lantai_kabin,
    panel_cop_lop: Array.isArray(s.panel_cop_lop) && s.panel_cop_lop.length ? s.panel_cop_lop : KONFIG_BAWAAN.panel_cop_lop,
    shaft: Array.isArray(s.shaft) && s.shaft.length ? s.shaft : KONFIG_BAWAAN.shaft,
    shaft_oleh_pelanggan: String(s.shaft_oleh_pelanggan ?? KONFIG_BAWAAN.shaft_oleh_pelanggan),
    dinding_kaca: { ...KONFIG_BAWAAN.dinding_kaca, ...(s.dinding_kaca || {}) },
    outdoor: { ...KONFIG_BAWAAN.outdoor, ...(s.outdoor || {}) },
    instalasi: { ...KONFIG_BAWAAN.instalasi, ...(s.instalasi || {}) },
    addon: Array.isArray(s.addon) && s.addon.length ? s.addon : KONFIG_BAWAAN.addon,
    lokasi: Array.isArray(s.lokasi) && s.lokasi.length ? s.lokasi : KONFIG_BAWAAN.lokasi,
    biaya_tetap_idr: Number(s.biaya_tetap_idr ?? KONFIG_BAWAAN.biaya_tetap_idr),
    margin: { ...KONFIG_BAWAAN.margin, ...(s.margin || {}) },
    bawaan: { ...KONFIG_BAWAAN.bawaan, ...(s.bawaan || {}) },
  };
}

/** Masukan awal dari opsi bawaan, dengan penjagaan bila nama opsi berubah. */
export function masukanBawaan(cfg: KonfigKalkulator): MasukanKalkulator {
  const b = cfg.bawaan;
  const pilih = (nilai: string, daftarNama: string[]) =>
    daftarNama.includes(nilai) ? nilai : daftarNama[0] ?? nilai;

  const unit = cfg.unit_dasar.find((u) => u.kapasitas === b.kapasitas && u.kecepatan === b.kecepatan)
    ?? cfg.unit_dasar[0];

  return {
    kapasitas: unit?.kapasitas ?? b.kapasitas,
    kecepatan: unit?.kecepatan ?? b.kecepatan,
    lantai: b.lantai,
    tinggi_mm: b.tinggi_mm,
    kabin: pilih(b.kabin, cfg.kabin.map((x) => x.nama)),
    pintu: pilih(b.pintu, cfg.pintu.map((x) => x.nama)),
    bukaan: pilih(b.bukaan, cfg.bukaan.map((x) => x.nama)),
    lantai_kabin: pilih(b.lantai_kabin, cfg.lantai_kabin.map((x) => x.nama)),
    shaft: pilih(b.shaft, cfg.shaft.map((x) => x.nama)),
    dinding: pilih(b.dinding, [cfg.shaft_oleh_pelanggan, cfg.dinding_kaca.nama_include]),
    cop: pilih(b.cop, cfg.panel_cop_lop.map((x) => x.nama)),
    lop: pilih(b.lop, cfg.panel_cop_lop.map((x) => x.nama)),
    outdoor: pilih(b.outdoor, ['NO', cfg.outdoor.nama_ya]),
    handrail: pilih(b.handrail, ['NO', 'YES']),
    ic_card: pilih(b.ic_card, ['NO', 'YES']),
    ac: pilih(b.ac, ['NO', 'YES']),
    knob: pilih(b.knob, ['NO', 'YES']),
    stabilizer: pilih(b.stabilizer, ['NO', 'YES']),
    lokasi: pilih(b.lokasi, cfg.lokasi.map((x) => x.nama)),
  };
}
