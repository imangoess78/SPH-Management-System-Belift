// ============================================================
//  SPH DOCUMENT HTML GENERATOR
//  Diekstrak dari SPHForm.tsx agar bisa diimport dari mana saja
//  (termasuk SPHPreview untuk regenerate dari docstate)
// ============================================================
import {
  KatalogItem, TerminItem, DesainPilihan, DesainOption,
  ASET, DESAIN, DESAIN_LABEL, KET_LABEL, KEL_LABEL, HARI_ID,
  normalizeStrukturItems, LantaiUnit, totalFloorToFloor, angkaMm,
} from './sph-types';
import {
  num, rupiah, ribu, terbilangRp, terbilang, capWords,
  parseDate, fmtID, noSuratSPH, noSuratSPK,
  totalKel, grandTotal, kelAktif,
} from './sph-utils';
import {
  BlokPasal, Pasal, ManualSpk,
  susunPasal, renderPasal, ORDINAL, TerminCetak,
  PengaturanCetak, normalCetak, cssCetak,
} from './spk-susun';
import { daftarPasal as pasalDariForm, bahanPasal } from './spk-pasal';
export type { ManualSpk, ManualPasal, Pasal, BlokPasal } from './spk-susun';

// ── Interface matching SPHForm S state ───────────────────────
export interface GenState {
  noUrut: string; tanggal: string; kota: string; alamatKantor: string; formatNoSPK: 'standar' | 'lama';
  sapaan: string; namaCustomer: string; namaPerusahaan: string; nikCustomer: string; alamatCustomer: string; kotaProyek: string;
  jenisLift: string; tipeKabin: string; kapasitas: string; penumpang: string; kecepatan: string; mpm: string; sfd: string;
  tipeMesin: string; traksi: string; dayaMesin: string; power: string; pintu: string; bukaanPintu: string;
  tinggiKabin: string; shaftSize: string; cabinSize: string; pitDepth: string; namaLantai: string; baseFloor: string;
  // Isian manual di bagian Unit lift & spesifikasi (opsional).
  lantai?: LantaiUnit[]; floorToFloor?: string; catatanUnit?: string;
  ppn: 'exclude' | 'include'; masaBerlaku: string; freeMtn: string; garSpare: string; garMesin: string;
  waktuPengadaan: string; waktuInstalasi: string;
  tampilTtd: boolean; tampilDesain: boolean;
  finishingStruktur: string;
  // Keterangan modifikasi bebas per kategori desain (opsional, hanya dicetak bila diisi)
  catatanDesain?: Record<string, string>;
  sales: string; jabatanTtd: string; direktur: string; rekening: string;
  /** Isian manual editor SPK (judul pasal, paragraf tambahan). Lihat spk-susun.ts. */
  manualSpk?: ManualSpk;
  /** Tanggal per termin per kategori: { PENGADAAN: ['2026-12-05', …] }. */
  tanggalTermin?: Record<string, (string | null | undefined)[]>;
  /** Pengaturan cetak SPK: ukuran kertas & margin (mm). */
  cetak?: CetakSpk;
}

export interface CetakSpk {
  kertas: 'A4' | 'A5' | 'Letter' | 'Legal';
  marginAtas: number; marginBawah: number; marginKiri: number; marginKanan: number;
}

export type ModeHarga = 'satuan' | 'lumpsum';
export type DocMode = 'SPH' | 'SPK';

// ── Helpers ──────────────────────────────────────────────────
export function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[<>"]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
}

// ── Inject hex-bg img into every .page div ──────────────────
const HEX_IMG = '<img class="hex-bg" src="/hexagon-outline-bg.png" alt="" aria-hidden="true">';
export function injectDeco(html: string): string {
  return html.replace(/(<div class="page(?:[^"]*)"[^>]*>)/g, '$1' + HEX_IMG);
}

/**
 * Sisipkan CSS pengaturan halaman tepat sebelum </style> pertama.
 * Diletakkan paling akhir supaya menimpa aturan `@page{size:A4}` bawaan —
 * CSS memakai urutan sumber untuk aturan yang sama spesifisitasnya.
 */
export function sisipCssCetak(html: string, c: PengaturanCetak): string {
  const css = cssCetak(c);
  if (html.includes('</style>')) return html.replace('</style>', css + '</style>');
  // Dokumen tanpa <style> (mis. dipanggil dari tes): buat sendiri.
  return html.replace(/<head([^>]*)>/i, '<head$1><style>' + css + '</style>');
}

/**
 * Rakit "Kepada Yth" dari sapaan + nama customer/perusahaan.
 *
 * Sapaan "PT" dan "CV" adalah **bentuk badan usaha**, bukan kata panggilan
 * orang. Jadi keduanya tidak diberi spasi terpisah seperti "Bapak Andi" —
 * "PT Sumber Jaya", bukan "PT PT Sumber Jaya". Bila nama perusahaan sudah
 * memuat "PT"/"CV" di depan, itu tidak digandakan lagi.
 */
function tujuan(s: GenState): string {
  const sapaan = s.sapaan && s.sapaan !== '—' ? s.sapaan : 'Bapak';
  const customer = (s.namaCustomer || '').trim();
  const perusahaan = (s.namaPerusahaan || '').trim();
  const badan = /^(pt|cv)\b/i.test(sapaan);
  // Nama resmi badan usaha lebih diutamakan daripada nama orang.
  const nama = (badan ? (perusahaan || customer) : (customer || perusahaan)) || '…';
  // "PT Sumber Jaya" + sapaan "PT" -> jangan ulangi jadi "PT PT Sumber Jaya".
  if (badan && new RegExp(`^${sapaan}\\b`, 'i').test(nama)) return nama;
  return `${sapaan} ${nama}`;
}

function namaDesain(k: string, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const list = (liveDesain && liveDesain[k]?.length ? liveDesain[k] : DESAIN[k]) || [];
  const o = list.find(x => x.kode === pilihDesain[k as keyof DesainPilihan]);
  return o ? o.nama : '';
}

// Keterangan desain terpilih — pakai `keterangan` dari Master Data bila diisi,
// kalau kosong pakai default: Struktur → warna (nama tanpa prefix "Struktur "),
// kategori lain (mis. Cabin) → nama desain itu sendiri (model).
function ketDesain(k: string, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const list = (liveDesain && liveDesain[k]?.length ? liveDesain[k] : DESAIN[k]) || [];
  const o = list.find(x => x.kode === pilihDesain[k as keyof DesainPilihan]);
  if (!o) return '';
  const manual = String(o.ket || '').trim();
  if (manual) return manual;
  if (k === 'struktur') return o.nama.replace(/^struktur\s+/i, '').trim();
  return o.nama;
}

// Nama desain untuk ditampilkan di dokumen. Untuk kategori Struktur, prefix
// "Struktur " dibuang karena label kategori sudah menuliskan "Struktur".
function namaTampil(k: string, o: DesainOption): string {
  if (k === 'struktur') return String(o.nama || '').replace(/^struktur\s+/i, '').trim() || o.nama;
  return o.nama;
}

// Status struktur dari Tabel harga → bagian Pekerjaan Sipil
function strukturStatus(items: KatalogItem[]): { steel: boolean; alu: boolean; ada: boolean; label: string } {
  const on = (id: string) => items.some(i => i.id === id && i.on);
  const steel = on('S1g'), alu = on('S1h');
  return {
    steel, alu, ada: steel || alu,
    label: steel && alu ? 'Struktur Steel & Aluminium' : alu ? 'Struktur Aluminium' : steel ? 'Struktur Steel' : '',
  };
}

// Split address into max 2 lines for the letterhead:
// 5+ segments -> 2 + rest | 3 segments -> 1 + 2 | <=2 -> single line
function alamat2Baris(alamat: string): string {
  const parts = String(alamat || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!parts.length) return '';
  const brk = parts.length <= 2 ? parts.length : parts.length === 3 ? 1 : 2;
  const first = parts.slice(0, brk).map(esc).join(', ');
  const rest = parts.slice(brk);
  return first + (rest.length ? '<br>' + rest.map(esc).join(', ') : '');
}

function kop(t: string, alamatKantor: string): string {
  return '<div class="lethead"><div class="doctype">' + t + '</div><div class="co">' +
'<img class="mark-logo" src="/logo.png" alt="Belift" style="height:10mm;width:auto;display:block;margin-left:auto">' +
    '<div class="ent">PT. BELIFT AMANAH INDONESIA</div>' +
    alamat2Baris(alamatKantor) + '<br>info@belift.co.id</div></div>';
}

// signatureUrl: bila diisi (dari DB sales), pakai itu; kalau tidak, fallback ke ASET.ttd
export function ttdBlok(nama: string, jabatan: string, pakaiCap: boolean, tampilTtd: boolean, signatureUrl?: string): string {
  const img = signatureUrl || ASET.ttd[nama] || '';
  const cap = (pakaiCap && ASET.capPerusahaan) ? '<img class="cap" src="' + ASET.capPerusahaan + '" alt="">' : '';
  const sig = img ? '<img class="ttd" src="' + img + '" alt="">' : '';
  return '<div class="sigbox">' + (tampilTtd ? cap + sig : '') + '</div>' +
    '<div class="sig-nm">' + esc(nama) + '</div><div>' + esc(jabatan) + '</div>';
}

/**
 * Overhead = tinggi lantai TERAKHIR pada Tabel Lantai (mm).
 * Kosong → "After Survey" seperti sebelumnya.
 */
function nilaiOverhead(s: GenState): string {
  const baris = (Array.isArray(s.lantai) ? s.lantai : [])
    .map(l => angkaMm(l?.tinggi))
    .filter(v => v > 0);
  if (!baris.length) return 'After Survey';
  return baris[baris.length - 1].toLocaleString('id-ID') + ' mm';
}

/**
 * Travelling Height = jumlah SELURUH tinggi lantai − tinggi lantai terakhir.
 *
 * Lantai terakhir dikeluarkan karena tingginya sudah dipakai sebagai Overhead.
 * Contoh 6 lantai 4300/3300/3100/3000/3000/3000 → 19.700 − 3.000 = 16.700 mm.
 * Butuh minimal 2 lantai terisi; kalau kurang → "(Custom)" seperti sebelumnya.
 */
function nilaiTravelling(s: GenState): string {
  const baris = (Array.isArray(s.lantai) ? s.lantai : [])
    .map(l => angkaMm(l?.tinggi))
    .filter(v => v > 0);
  if (baris.length < 2) return '(Custom)';
  const total = baris.reduce((a, b) => a + b, 0);
  const travel = Math.round(total - baris[baris.length - 1]);
  return travel.toLocaleString('id-ID') + ' mm';
}

function specRows(s: GenState, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>, adaStruktur = true): string {
  const ketCabin = ketDesain('cabin', pilihDesain, liveDesain);
  const ketStruktur = ketDesain('struktur', pilihDesain, liveDesain);
  // Nilai baris "Struktur" cukup warna/model — label barisnya sendiri sudah "Struktur"
  const namaStruktur = ketDesain('struktur', pilihDesain, liveDesain) || '—';
  const d: [string, string, boolean?][] = [
    ['Type', s.tipeMesin], ['Loading Capacity', s.kapasitas], ['Speed', s.kecepatan],
    ['Stops/Floors/Doors', s.sfd], ['Floor Name', s.namaLantai], ['Base Floor', s.baseFloor],
    ['Rate of Traction Machine', s.dayaMesin], ['Traction Ratio', s.traksi],
    ['Power Supply', s.power, true], ['Lighting Power', '220V 50HZ'],
    ['Shaft Size', s.shaftSize, true], ['Floor to Floor', nilaiFloorToFloor(s), true],
    ['Overhead', nilaiOverhead(s), true], ['Travelling Height', nilaiTravelling(s), true],
    ['Pit Depth', s.pitDepth, true], ['Door opening Type', s.pintu, true],
    ['Door opening Size', s.bukaanPintu, true], ['Cabin Size', s.cabinSize, true],
    ['Height of Cabin', s.tinggiKabin, true],
    ['Cabin decoration', namaDesain('cabin', pilihDesain, liveDesain) || 'As in pic'],
    ['Handrail', 'Yes'], ['Floor', namaDesain('floor', pilihDesain, liveDesain) || '—'],
    ['Ceiling', namaDesain('ceiling', pilihDesain, liveDesain) || 'As at Pict'],
    ['Door', namaDesain('door', pilihDesain, liveDesain) || 'As at Pict'],
    ['COP', namaDesain('cop', pilihDesain, liveDesain) || 'As at Pict'],
    ['LOP', namaDesain('lop', pilihDesain, liveDesain) || 'As at Pict'],
    ['Language', 'English'], ['Brand', 'BELIFT'],
  ];
  // Keterangan desain (model / warna) hanya ditampilkan jika menambah info
  const cabIdx = d.findIndex(([l]) => l === 'Cabin decoration');
  if (cabIdx >= 0 && ketCabin && !d[cabIdx][1].toLowerCase().includes(ketCabin.toLowerCase()))
    d.splice(cabIdx + 1, 0, ['Cabin model', ketCabin]);
  if (adaStruktur && pilihDesain.struktur) {
    d.splice(d.findIndex(([l]) => l === 'Language'), 0, ['Struktur', namaStruktur]);
    if (ketStruktur && !namaStruktur.toLowerCase().includes(ketStruktur.toLowerCase()))
      d.splice(d.findIndex(([l]) => l === 'Language'), 0, ['Struktur warna', ketStruktur]);
  }
  if (s.finishingStruktur)
    d.splice(d.findIndex(([l]) => l === 'Language'), 0, ['Struktur finishing', s.finishingStruktur]);
  return d.map((r, i) =>
    '<tr><td>' + String(i + 1).padStart(3, '0') + '</td><td>' + esc(r[0]) + '</td><td' + (r[2] ? ' class="hl"' : '') + '>' + esc(r[1]) + '</td></tr>'
  ).join('');
}

/**
 * Catatan manual pada bagian Unit lift & spesifikasi.
 *
 * Ditulis bebas oleh sales (multi-baris) dan HANYA dicetak bila diisi, supaya
 * dokumen lama yang belum punya catatan tetap sama persis seperti sebelumnya.
 * Baris baru dipertahankan — catatan lapangan biasanya berupa daftar poin.
 */
function catatanUnitBlok(s: GenState): string {
  const isi = String(s.catatanUnit || '').trim();
  if (!isi) return '';
  const baris = isi.split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean)
    .map(x => esc(x))
    .join('<br>');
  return '<div class="cat-unit"><strong>Catatan Unit &amp; Spesifikasi:</strong><br>' + baris + '</div>';
}

/**
 * Nilai baris "Floor to Floor" pada tabel spesifikasi.
 *
 * Sumbernya Tabel Lantai: jumlah tinggi seluruh lantai yang diisi manual.
 * Bila tabel belum diisi, jatuh ke isian tunggal lama (`floorToFloor`), dan
 * bila itu pun kosong dokumen mencetak "After Survey" seperti sebelumnya.
 */
function nilaiFloorToFloor(s: GenState): string {
  const total = totalFloorToFloor(s.lantai);
  const terisi = (Array.isArray(s.lantai) ? s.lantai : []).filter(l => angkaMm(l?.tinggi) > 0).length;
  if (total > 0) return total.toLocaleString('id-ID') + ' mm' + (terisi > 1 ? ' (' + terisi + ' lantai)' : '');
  return String(s.floorToFloor || '').trim() || 'After Survey';
}

/** Tabel lantai: tinggi tiap lantai diisi manual (mm). */
function tabelLantaiUnit(s: GenState): string {
  const baris = (Array.isArray(s.lantai) ? s.lantai : []).filter(l => l && (String(l.lantai || '').trim() || angkaMm(l.tinggi) > 0));
  // Tanpa satu pun tinggi terisi, tabel hanya akan berisi tanda "—": tidak ada
  // informasi yang dibawa, jadi tidak dicetak sama sekali.
  if (!baris.length || totalFloorToFloor(s.lantai) <= 0) return '';
  const total = totalFloorToFloor(s.lantai);
  // Kolom "No" tidak dicetak (permintaan klien 6 Nov 2026).
  const isi = baris.map(l => '<tr><td>' + esc(l.lantai || '')
    + '</td><td>' + (angkaMm(l.tinggi) > 0 ? esc(String(l.tinggi).trim()) : '—') + '</td></tr>').join('');
  return '<table class="doc spec" style="margin-top:3mm"><tr><th class="head" colspan="2">Tabel Lantai (Floor to Floor)</th></tr>' +
    '<tr><td style="width:46%"><strong>Lantai</strong></td><td><strong>Tinggi (mm)</strong></td></tr>' +
    isi +
    '<tr><td style="text-align:right"><strong>Total Floor to Floor</strong></td><td><strong>' +
    (total > 0 ? total.toLocaleString('id-ID') + ' mm' : 'After Survey') + '</strong></td></tr></table>';
}

function tabelHargaDoc(items: KatalogItem[], modeH: ModeHarga): string {
  const aktif = kelAktif(items);
  if (!aktif.length) return '';
  const q = modeH === 'satuan';
  let rows = '', no = 0;
  aktif.forEach(kel => {
    rows += '<tr class="grp2"><td colspan="' + (q ? 6 : 5) + '">' + KEL_LABEL[kel] + '</td></tr>';
    items.filter(i => i.kel === kel && i.on).forEach(it => {
      const sub = it.par ? 'subrow' : '';
      if (it.inc) {
        rows += '<tr class="' + sub + '"><td class="c">' + (it.par ? '' : ++no) + '</td><td>' + it.nama + '</td>' +
          (q ? '<td class="c">' + it.qty + ' ' + it.sat + '</td>' : '') + '<td class="inc" colspan="3">Include</td></tr>';
      } else {
        const tp = q ? num(it.hp) * num(it.qty) : num(it.hp);
        const ti = q ? num(it.hi) * num(it.qty) : num(it.hi);
        rows += '<tr class="' + sub + '"><td class="c">' + (it.par ? '' : ++no) + '</td><td>' + it.nama + '</td>' +
          (q ? '<td class="c">' + it.qty + ' ' + it.sat + '</td>' : '') +
          '<td class="n">' + (tp ? ribu(tp) : '—') + '</td><td class="n">' + (ti ? ribu(ti) : '—') + '</td>' +
          '<td class="n">' + ribu(tp + ti) + '</td></tr>';
      }
    });
    rows += '<tr><td colspan="' + (q ? 5 : 4) + '" class="rt" style="font-weight:600">Sub Total ' +
      KEL_LABEL[kel] + '</td><td class="n" style="font-weight:600">' + ribu(totalKel(items, kel, modeH)) + '</td></tr>';
  });
  return '<table class="doc"><thead><tr><th style="width:9mm">No</th><th>Item Pekerjaan</th>' +
    (q ? '<th style="width:18mm">Qty</th>' : '') +
    '<th style="width:26mm">Pengadaan (Rp)</th><th style="width:26mm">Pemasangan (Rp)</th>' +
    '<th style="width:28mm">Total (Rp)</th></tr></thead><tbody>' + rows +
    '<tr class="total"><td colspan="' + (q ? 5 : 4) + '" class="rt">TOTAL PRICE</td><td class="n">' +
    ribu(grandTotal(items, modeH)) + '</td></tr></tbody></table>';
}

function terminDoc(items: KatalogItem[], termin: Record<string, TerminItem[]>, modeH: ModeHarga): string {
  return kelAktif(items).filter(k => totalKel(items, k, modeH) > 0).map(kel => {
    const dasar = totalKel(items, kel, modeH);
    return '<h4>' + KEL_LABEL[kel] + ' — ' + rupiah(dasar) + '</h4><ul class="ul">' +
      termin[kel].map((t, i) =>
        '<li>Angsuran ke-' + (i + 1) + ' : <strong>' + t.p + '%</strong> (' + rupiah(dasar * num(t.p) / 100) + ') ' + t.s + '</li>'
      ).join('') + '</ul>';
  }).join('');
}

function desainDoc(s: GenState, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>, adaStruktur = true): string {
  const dipilih = Object.keys(DESAIN_LABEL).filter(k => {
    if (!pilihDesain[k as keyof DesainPilihan]) return false;
    // Struktur pada halaman desain hanya muncul bila bagian Sipil memilih Struktur Aluminium
    if (k === 'struktur' && !adaStruktur) return false;
    return true;
  });
  if (!s.tampilDesain || !dipilih.length) return '';
  const cards = dipilih.map(k => {
    const src = (liveDesain && liveDesain[k]?.length ? liveDesain[k] : DESAIN[k]) || [];
    const o = src.find(x => x.kode === pilihDesain[k as keyof DesainPilihan]);
    if (!o) return '';
    const ket = ketDesain(k, pilihDesain, liveDesain);
    const nm = namaTampil(k, o);
    let ketTxt = '';
    if (ket && ket.toLowerCase() !== nm.toLowerCase())
      ketTxt = '<span class="cap-sub">' + (KET_LABEL[k] || 'Keterangan') + ': ' + esc(ket) + '</span>';
    // Keterangan modifikasi manual — opsional, hanya muncul bila diisi.
    const cat = String((s.catatanDesain || {})[k] || '').trim();
    const catTxt = cat ? '<span class="cap-note"><b>Modifikasi:</b> ' + esc(cat) + '</span>' : '';
    return '<div class="dcard"><div class="box">' +
      (o.img ? '<img src="' + o.img + '" alt="' + esc(nm) + '" crossorigin="anonymous">' : '<div class="ph">Gambar ' + DESAIN_LABEL[k] + '<br>' + esc(o.kode) + '</div>') +
      '</div><div class="cap"><b>' + DESAIN_LABEL[k] + '</b>' + esc(nm) + ketTxt + catTxt + '</div></div>';
  }).join('');
  // Halaman Opsi Desain berdiri sendiri: WAJIB pecah halaman sebelum & sesudahnya.
  // Sebelumnya kelasnya `page cont` — tanpa `spk-body` dan bukan `:last-child`,
  // jadi rantai rule print pecah dan halaman ini mengalir naik menimpa halaman
  // tanda tangan Pasal 10 (bug: Opsi Desain ikut ke halaman kontrak).
  return '<div class="page cont page-desain"><h3 class="secttl">Opsi Desain — ' + esc(s.tipeKabin) + '</h3>' +
    '<div class="dgrid">' + cards + '</div>' +
    '<p style="margin-top:6mm;font-size:9pt;font-style:italic">Gambar bersifat ilustrasi. Warna dan tekstur final ' +
    'mengikuti sampel material yang disetujui saat survey final.</p><div class="pgnum">·</div></div>';
}

// ── Main generators ─────────────────────────────────────────
export function pageSPH(s: GenState, items: KatalogItem[], termin: Record<string, TerminItem[]>, modeH: ModeHarga, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>, signatureUrl?: string): string {
  // Dokumen lama menyimpan Struktur Steel sebagai `I1c` di INSTALASI. Normalisasi di sini
  // supaya hasil cetak SPH sama dengan yang tampil di form (dan centangnya tidak hilang).
  items = normalizeStrukturItems(items);
  const d = parseDate(s.tanggal);
  const hariMap: Record<string, number> = { '2 Minggu': 14, '3 Minggu': 21, '1 Bulan': 31, '2 Bulan': 61 };
  const berlaku = new Date(d.getTime() + (hariMap[s.masaBerlaku] || 21) * 864e5);
  const adaSipil = kelAktif(items).includes('SIPIL') || totalKel(items, 'SIPIL', modeH) > 0;
  const st = strukturStatus(items);
  const stRow = st.label
    ? '<strong>' + esc(st.label) + '</strong>' + (s.finishingStruktur ? ' dengan <strong>' + esc(s.finishingStruktur) + '</strong>' : '')
    : (s.finishingStruktur ? '<strong>' + esc(s.finishingStruktur) + '</strong>' : '');
  const gt = grandTotal(items, modeH);
  const raw = '' +
    '<div class="page">' + kop('INQUIRY', s.alamatKantor) +
    '<div class="docno">' + noSuratSPH(s.noUrut, s.tanggal) + '</div>' +
    '<div class="place">' + esc(s.kota) + ', ' + fmtID(d) + '</div>' +
    '<div class="to">Kepada Yth:<br><strong>' + esc(tujuan(s)) + '</strong><br>di ' + esc(s.kotaProyek) + '</div>' +
    '<div class="subject">Hal: Penawaran Harga Pengadaan &amp; Pemasangan 1 unit ' + esc(s.tipeKabin) + ' ' + esc(s.jenisLift) + ' di ' + esc(s.kotaProyek) + '</div>' +
    '<div class="body ind"><p>Dengan hormat,<br>Berdasarkan data yang kami terima, bersama ini kami sampaikan ' +
    'penawaran harga pekerjaan (pengadaan &amp; pemasangan Elevator merk <strong>BELIFT</strong>) untuk proyek ' +
    'tersebut di atas dengan ruang lingkup sebagai berikut:</p>' +
    '<h4>1. Pengadaan ' + esc(s.jenisLift) + '</h4><p>Harga pengadaan material Elevator dan transportasi sampai di ' +
    'lokasi proyek 1 (satu) unit <strong>Lift Elevator-' + esc(s.kapasitas) + '</strong> / ' + esc(s.penumpang) +
    ' – ' + esc(s.mpm) + ' – Floors/Stops/Doors ' + esc(s.sfd) + '.</p>' +
    '<h4>2. Pemasangan</h4><p>Biaya pemasangan termasuk Mobilisasi, Test-Commissioning, Mob-demobilisasi, ' +
    '<strong>Free Maintenance ' + esc(s.freeMtn) + ', Garansi Spare Part ' + esc(s.garSpare) + ', Garansi Mesin ' + esc(s.garMesin) + '</strong>.</p>' +
    (adaSipil ? '<h4>3. Pekerjaan Sipil</h4><p>Pekerjaan sipil' + (stRow ? ' termasuk ' + stRow : '') + ' dikerjakan oleh PT Belift Amanah Indonesia berdasarkan SPK tersendiri.</p>' : '') +
    '<p><strong>*</strong> Semua Harga <strong>' + (s.ppn === 'exclude' ? 'Exclude' : 'Include') + '</strong> PPN 11%</p>' +
    '<h4>Waktu Pelaksanaan:</h4><p>Maksimal 3,5 Bulan sudah test commissioning sejak Kontrak ditanda tangani dan pembayaran pertama diterima.</p></div><div class="pgnum">1</div></div>' +

    '<div class="page cont"><h3 class="secttl">Rincian Harga Pekerjaan</h3>' + tabelHargaDoc(items, modeH) +
    '<div class="terbilang">' + terbilangRp(gt) + '</div>' +
    '<p style="font-size:9.5pt"><strong>*</strong> Harga <strong>' + (s.ppn === 'exclude' ? 'Exclude' : 'Include') +
    '</strong> PPN 11%. Baris bertanda <em>Include</em> sudah tercakup dalam harga item induknya.</p>' +
    '<div class="pgnum">2</div></div>' +

    desainDoc(s, pilihDesain, liveDesain, st.ada) +

    '<div class="page cont"><table class="doc spec"><tr><th class="head" colspan="3">Elevator ' + esc(s.tipeKabin) +
    ' With Traction Description</th></tr>' + specRows(s, pilihDesain, liveDesain, st.ada) + '</table>' +
    tabelLantaiUnit(s) + catatanUnitBlok(s) + '<div class="pgnum">·</div></div>' +

    '<div class="page cont"><p style="font-weight:700;text-decoration:underline;margin-bottom:5mm">Syarat dan Kondisi Penawaran :</p>' +
    '<ol class="ol">' +
    '<li>Penawaran berlaku sampai dengan <strong>' + fmtID(berlaku) + '</strong> (' + esc(s.masaBerlaku) + ').</li>' +
    (adaSipil
      ? '<li><strong>Termasuk</strong> pekerjaan sipil sesuai rincian.</li>'
      : '<li><strong>Tidak termasuk</strong> dalam penawaran yaitu, <strong>Struktur dan pekerjaan sipil</strong>, instalasi dan daya listrik ke ruang mesin elevator.</li>') +
    '<li><strong>Masa pemeliharaan cuma-cuma berlaku selama ' + esc(s.freeMtn) + ' sejak Serah Terima Pekerjaan.</strong></li>' +
    '<li><strong>Garansi peralatan dan pemasangan berlaku ' + esc(s.garSpare) + ' sejak Serah Terima Pekerjaan</strong>.</li>' +
    '<li><strong>Garansi Motor Mesin berlaku ' + esc(s.garMesin) + ' sejak Serah Terima Pekerjaan.</strong></li>' +
    '<li>Cara pembayaran:' + terminDoc(items, termin, modeH) + '</li></ol>' +
    '<p>Demikian penawaran ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>' +
    '<div style="display:flex;justify-content:flex-end;margin-top:8mm"><div style="width:74mm;text-align:center">' +
'<img src="/logo.png" alt="Belift" style="height:10mm;width:auto;display:block;margin:0 auto 2mm">'+
    ttdBlok(s.sales, s.jabatanTtd, true, s.tampilTtd, signatureUrl) + '</div></div><div class="pgnum">·</div></div>';
  return injectDeco(raw);
}

/**
 * Pengaturan cetak terakhir per dokumen. `pageSPK` mengembalikan potongan BODY
 * (CSS disuntik pemanggil saat mencetak), jadi nilainya perlu dioper lewat sini.
 * Kunci = id dokumen, supaya pratinjau satu dokumen tidak terbawa ke dokumen lain.
 */
const cetakTerakhir = new Map<string, PengaturanCetak>();

/** Ambil pengaturan cetak yang terakhir dipakai untuk sebuah dokumen. */
export function cetakUntuk(id: string | null | undefined): PengaturanCetak {
  return normalCetak(id ? cetakTerakhir.get(id) : undefined);
}

/** CSS pengaturan halaman untuk sebuah dokumen ('' bila belum pernah disetel). */
export function cssCetakUntuk(id: string | null | undefined): string {
  return id && cetakTerakhir.has(id) ? cssCetak(cetakTerakhir.get(id)!) : '';
}

export function pageSPK(s: GenState, items: KatalogItem[], termin: Record<string, TerminItem[]>, modeH: ModeHarga, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  // Catat pengaturan cetak dokumen ini (dipakai pemanggil saat mencetak).
  if (s.cetak) cetakTerakhir.set(String(s.noUrut), normalCetak(s.cetak));
  // Sama seperti pageSPH: dokumen lama menyimpan Struktur Steel sebagai `I1c`
  // (INSTALASI). Tanpa normalisasi, klausul "Pemasangan Struktur" hilang dari SPK.
  items = normalizeStrukturItems(items);
  const d = parseDate(s.tanggal);
  const hari = HARI_ID[d.getDay()];
  const gt = grandTotal(items, modeH);
  const st = strukturStatus(items);
  // Bahan pasal (tanda tangan, termin, nilai) disusun di spk-pasal.ts supaya
  // panel Editor SPK memakai angka yang PERSIS SAMA dengan dokumen cetak.
  // SELURUH teks pasal juga tinggal di sana — satu sumber, dua pemakai.
  const daftarPasal = pasalDariForm(s, bahanPasal(s, st, items, termin, modeH));

  // Isian manual pengguna digabung DI SINI — saat cetak, bukan saat simpan.
  const pasalJadi = susunPasal(daftarPasal, s.manualSpk);

  const raw = '' +
    // ── Halaman 1: Pembukaan ──────────────────────────────────
    '<div class="page">' + kop('CONTRACT', s.alamatKantor) +
    '<div class="docno">' + noSuratSPK(s.noUrut, s.tanggal, s.formatNoSPK) + '</div>' +
    '<p>Pada hari ini, <strong>' + hari + '</strong> tanggal <strong>' + capWords(terbilang(d.getDate())) + '</strong> bulan ' +
    '<strong>' + fmtID(d).split(' ')[1] + '</strong> tahun <strong>' + capWords(terbilang(d.getFullYear())) + '</strong>, ' +
    'kami yang bertanda tangan dibawah ini :</p>' +
    '<table style="margin:4mm 0 4mm 10mm"><tr><td style="width:24mm;vertical-align:top">Nama</td><td style="vertical-align:top">:</td><td>&nbsp;<strong>' + esc(s.namaCustomer || '…') + '</strong></td></tr>' +
    '<tr><td style="vertical-align:top">NIK</td><td style="vertical-align:top">:</td><td>&nbsp;' + esc(s.nikCustomer || '…') + '</td></tr>' +
    '<tr><td style="vertical-align:top">Alamat</td><td style="vertical-align:top">:</td><td>&nbsp;' + esc(s.alamatCustomer || '…') + '</td></tr></table>' +
    '<p>Dalam hal ini bertindak untuk dan atas nama <strong>' + esc(s.namaPerusahaan || s.namaCustomer || '…') + '</strong> ' +
    'untuk selanjutnya disebut <strong>PIHAK PERTAMA</strong></p>' +
    '<table style="margin:4mm 0 4mm 10mm"><tr><td style="width:24mm;vertical-align:top">Nama</td><td style="vertical-align:top">:</td><td>&nbsp;<strong>' + esc(s.direktur) + '</strong></td></tr>' +
    '<tr><td>Jabatan</td><td>:</td><td>&nbsp;Direktur PT Belift Amanah Indonesia</td></tr>' +
    '<tr><td style="vertical-align:top">Alamat</td><td style="vertical-align:top">:</td><td>&nbsp;' + esc(s.alamatKantor) + '</td></tr></table>' +
    '<p>Dalam hal ini bertindak untuk dan atas nama <strong>PT.Belift Amanah Indonesia</strong> untuk selanjutnya ' +
    'disebut sebagai <strong>PIHAK KEDUA</strong></p>' +
    '<p>Selanjutnya kedua belah pihak mengadakan Surat Perjanjian Kerja sebagai berikut :</p>' +
    '<div class="pgnum">1</div><div class="paraf">_______ Paraf _______</div></div>' +

    // ── Semua Pasal dalam satu halaman kontinu (mengalir, tanpa page-break per pasal) ──
    '<div class="page cont spk-body"><div class="paraf">_______ Paraf _______</div>' +

    // Semua pasal dirender dari daftar terstruktur (isian manual sudah digabung).
    pasalJadi.map(renderPasal).join('') +

    '</div>' + // tutup .spk-body

    // ── Desain + Spesifikasi ──────────────────────────────────
    desainDoc(s, pilihDesain, liveDesain, st.ada) +

    '<div class="page cont"><table class="doc spec"><tr><th class="head" colspan="3">Elevator ' + esc(s.tipeKabin) +
    ' With Traction Description</th></tr>' + specRows(s, pilihDesain, liveDesain, st.ada) + '</table>' +
    tabelLantaiUnit(s) +
    catatanUnitBlok(s) +
    '<p style="font-weight:700;margin-top:4mm">NOTES: Spesifikasi FINAL SETELAH SURVEY FINAL</p>' +
    '<div class="pgnum">·</div><div class="paraf">_______ Paraf _______</div></div>';
  return injectDeco(raw);
}
