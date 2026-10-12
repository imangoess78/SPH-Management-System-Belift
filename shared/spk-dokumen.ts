// ============================================================
//  DOKUMEN SPK FINAL — dibaca sebagai sumber Final Survey
//
//  Latar: di lapangan, tim tidak selalu berjalan berurutan. Banyak yang
//  langsung membuat SPH, menaikkannya jadi SPK, lalu baru mengerjakan Final
//  Survey — tanpa Survey Sales lebih dulu. Karena itu Final Survey di sini
//  dijangkatkan pada SPK final, bukan pada Survey Sales.
//
//  Dokumen SPH/SPK tersimpan di tabel `sph`. Keadaannya ada di dalam kolom
//  `specs` (TEXT JSON) sebagai satu baris ber-key `__docstate` yang isinya
//  JSON string dari state form. Jadi untuk membaca mode/nama/kota dibutuhkan
//  dua kali parse.
//
//  Parsing SENGAJA tidak dilakukan di dalam SQL. `json_extract` akan
//  melempar galat `malformed JSON` dan menggagalkan SELURUH kueri bila ada
//  satu baris saja yang isinya rusak — dulu itu berarti daftar SPK kosong
//  total dan penyebabnya tak terlihat. Di JS, satu baris rusak cukup
//  dilewati.
//
//  Dipakai bersama oleh Cloudflare Pages Function (functions/) dan UI
//  (src/), jadi berkas ini wajib bebas dari API khusus runtime.
// ============================================================

/** Satu baris tabel `sph` yang sudah di-JSON.parse kolomnya oleh /api/data. */
export interface BarisSph {
  id: string;
  nomor_sph: string | null;
  tanggal: string | null;
  kepada: string | null;
  nama_pic: string | null;
  status: string | null;
  nama_sales: string | null;
  jenis_lift?: string | null;
  id_lead: string | null;
  specs: unknown;
}

/** SPK final yang sudah dirapikan, siap ditampilkan & dijadikan jangkar survey. */
export interface SpkFinal {
  /** id baris `sph`. */
  id: string;
  nomor_spk: string;
  tanggal: string;
  customer: string;
  kota: string;
  jenis_lift: string;
  kapasitas: string;
  tipe_kabin: string;
  sales: string;
  /** Isi `sph.id_lead` bila sudah pernah ditautkan. */
  id_lead: string | null;
}

type Rekaman = Record<string, unknown>;

function sebagaiObjek(v: unknown): Rekaman | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Rekaman;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    try {
      const u = JSON.parse(s);
      return u && typeof u === 'object' && !Array.isArray(u) ? (u as Rekaman) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * `specs` datang dalam dua bentuk tergantung jalur pembacaannya:
 *   - lewat /api/data → sudah di-JSON.parse menjadi array
 *   - langsung dari D1   → masih TEXT mentah
 * Keduanya harus diterima, kalau tidak daftar SPK akan kosong hanya karena
 * pembacanya berbeda.
 */
function sebagaiArray(v: unknown): unknown[] | null {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return null;
    try {
      const u = JSON.parse(s);
      return Array.isArray(u) ? u : null;
    } catch {
      return null;
    }
  }
  return null;
}

function teks(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

// ── Mesin cetak nama customer ───────────────────────────────
// Dipakai DUA sisi: server (membuat & mencocokkan lead) dan UI (menampilkan).
// Karena itu ia tinggal di sini, bukan di fungsi bantu masing-masing sisi —
// kalau ditulis dua kali, cepat atau lambat keduanya berbeda dan lead
// hasil pencocokan tidak lagi cocok dengan yang ditampilkan di layar.

/** Buang tanda baca + rapikan spasi ganda. */
export function rapikanNama(s: unknown): string {
  return teks(s)
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Nama customer dari record dokumen (level atas atau di dalam `state`).
 * Urutan: namaPerusahaan → namaCustomer → kepada → nama_pic.
 */
export function namaCustomerDokumen(rec: Rekaman): string {
  for (const k of ['namaPerusahaan', 'namaCustomer', 'kepada', 'nama_pic']) {
    const v = rapikanNama(rec[k]);
    if (v) return v;
  }
  return '';
}

// ── Pembacaan baris ─────────────────────────────────────────

/**
 * Ambil record dokumen dari sebuah baris `sph`.
 * Mengembalikan null bila baris itu bukan dokumen yang bisa dibaca.
 */
export function rekamanDokumen(baris: BarisSph): Rekaman | null {
  const specs = sebagaiArray(baris.specs);
  if (!specs) return null;
  for (const s of specs) {
    const o = sebagaiObjek(s);
    if (!o) continue;
    if (teks(o.key) !== '__docstate') continue;
    const nilai = sebagaiObjek(o.value);
    if (nilai) return nilai;
  }
  return null;
}

/** Mode dokumen: 'SPK' atau 'SPH'. Cadangan dari nomor bila docstate tak ada. */
export function modeDokumen(baris: BarisSph, rec: Rekaman | null): 'SPK' | 'SPH' {
  if (rec) {
    const m = teks(rec.mode).toUpperCase();
    if (m === 'SPK' || m === 'SPH') return m;
  }
  if (teks(baris.nomor_sph).toUpperCase().includes('/SPK/')) return 'SPK';
  return 'SPH';
}

/**
 * Ubah baris `sph` menjadi SpkFinal — atau null bila baris itu bukan
 * SPK yang sudah final. Penyaringan status & mode dilakukan di sini supaya
 * server dan UI memakai syarat yang persis sama.
 */
export function keSpkFinal(baris: BarisSph): SpkFinal | null {
  if (teks(baris.status).toLowerCase() !== 'final') return null;

  const rec = rekamanDokumen(baris);
  if (modeDokumen(baris, rec) !== 'SPK') return null;

  const state = sebagaiObjek(rec?.state) || rec || {};

  return {
    id: teks(baris.id),
    nomor_spk: teks(baris.nomor_sph),
    tanggal: teks(state.tanggal) || teks(baris.tanggal),
    customer: namaCustomerDokumen(rec || {}) || teks(baris.kepada),
    // Tabel `sph` tidak punya kolom `kota` — kota hanya ada di dalam state
    // dokumen, dengan dua penamaan berbeda antar versi formulir.
    kota: teks(state.kotaProyek) || teks(state.kota),
    jenis_lift: teks(state.jenisLift) || teks(baris.jenis_lift) || teks(rec?.jenisLift),
    kapasitas: teks(state.kapasitas) || teks(rec?.kapasitas),
    tipe_kabin: teks(state.tipeKabin) || teks(rec?.tipeKabin),
    sales: teks(state.sales) || teks(baris.nama_sales) || teks(rec?.sales),
    id_lead: teks(baris.id_lead) || null,
  };
}

/** Saring daftar baris `sph` menjadi SPK final saja, terbaru lebih dulu. */
export function daftarSpkFinal(baris: BarisSph[]): SpkFinal[] {
  const out: SpkFinal[] = [];
  for (const b of baris) {
    const spk = keSpkFinal(b);
    if (spk) out.push(spk);
  }
  return out.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
}
