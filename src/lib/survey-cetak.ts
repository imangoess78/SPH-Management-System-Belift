// ============================================================
//  CETAK & EKSPOR TEKS — Survey Sales, Final Survey, PO Pabrik
//
//  Kop, ukuran A4, dan gaya huruf disamakan dengan dokumen SPH/SPK
//  (src/lib/sph-generator.ts + printDocument di src/pages/SPHForm.tsx)
//  supaya seluruh dokumen Belift terlihat satu keluarga.
//
//  Mengganti teks dari fungsi template literal ke HTML, senyawa
//  ditulis lewat potongan variabel agar tidak salah kutip.
// ============================================================

import { DT_FIELDS, KELOMPOK_FIELD, KELOMPOK_EN, FIELD_WAJIB_KUNCI,
  hitungTravelling, hitungOverhead, hitungTotalHeight,
  type DataTeknis, type BarisDokumentasi, type PekerjaanTambahan,
  type ButirKesimpulan, type TtdSurvey, type AddOn, type Lantai, type TemuanDiff,
  type FotoDok, type PoRevisiRow } from './survey-types';
// Mesin cetak bersama (jendela baru + penyiapan gambar) ada di ./cetak supaya
// SPH, Survey, Lacak, dan PO memakai jalur yang sama persis.
import { cetakHtml } from './cetak';

export { gantiAlamatMedia } from './cetak';

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isi = (v: unknown): string => {
  const t = String(v ?? '').trim();
  return t ? esc(t) : '<span class="kosong">—</span>';
};

const fmtTgl = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? esc(s) : d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
};

const ALAMAT_KANTOR = 'Jl. Raya Kalimalang No. 12, Jakarta Timur, DKI Jakarta 13450';

// ── Gaya bersama untuk semua dokumen cetak ──────────────────
const GAYA = `
:root{--orange:#D95103;--burnt:#A63F04;--ink:#2B1B10;--muted:#7A6E66;--line:#DFD8D1}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:'Barlow',system-ui,sans-serif;background:#fff;color:#2B1B10;font-size:14px}
@page{size:A4;margin:0}
.page{width:210mm;min-height:297mm;background:#fff url('/corner-shape-bg.png') no-repeat left top;background-size:33.8mm auto;
  padding:18mm 17mm 16mm;position:relative;overflow:hidden;font-size:10.5pt;line-height:1.5;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.page .hex-bg{position:absolute;right:0;bottom:0;width:80mm;height:auto;pointer-events:none;z-index:0;display:block}
.lethead{display:flex;justify-content:space-between;align-items:flex-start;margin-left:5mm;gap:10mm}
.doctype{font-family:'Barlow',sans-serif;font-size:52pt;color:#da5d1a;letter-spacing:.02em;line-height:1;margin-top:14mm;font-weight:500}
.co{text-align:right;font-size:8.5pt;color:#4A3A2E;line-height:1.45;margin-top:2mm}
.co .mark-logo{height:10mm;width:auto;display:block;margin-left:auto}
.co .ent{font-size:11pt;color:#A63F04;font-weight:500;margin-bottom:1mm}
.docno{text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:19pt;font-weight:600;color:#D95103;letter-spacing:.08em;margin:9mm 0 6mm}
.subdocno{text-align:center;font-size:9pt;color:#7A6E66;margin-bottom:6mm}
h2{font-size:11pt;margin:6mm 0 2mm;font-weight:700;color:#A63F04;border-bottom:.7pt solid #DFD8D1;padding-bottom:1mm}
h3{font-size:10pt;margin:4mm 0 1.5mm;font-weight:700}
/* table-layout:fixed WAJIB. Dengan auto, browser mengabaikan lebar persen dan
   memeras kolom berisi teks panjang — dulu kolom Note menyusut jadi 7% (45px
   dari 665px) sehingga catatan teknis terpotong jadi satu kata per baris.
   Lebar tiap tabel sekarang dikunci lewat <colgroup> (lihat kolom()). */
table{width:100%;max-width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:3mm;table-layout:fixed}
/* Sel tabel dokumen cetak.
   white-space:nowrap DILARANG di sini — dengan table-layout:fixed lebar kolom
   sudah dikunci <colgroup>, jadi nowrap hanya membuat isi sel melebihi
   kolomnya (Note 320px di kolom 251px) dan menembus tepi kertas saat dicetak.
   JANGAN beri width/min-width:45px pada th/td: lebar persen di <colgroup>
   menjadi tidak terpakai dan semua kolom rata 45px.
   Aturannya:
   - min-width:0 + overflow-wrap:anywhere → kata panjang (1850x1900,
     https://…) patah di dalam sel, tidak melebarkan tabel;
   - hyphens:auto → kata panjang dipotong pakai tanda hubung, bukan dipaksa
     ke baris baru utuh;
   - word-break:normal → kata normal tidak dipatah di tengah (beda dengan
     break-all yang membuat "Parameter" jadi "Para-meter" tanpa alasan);
   - line-height ditekan supaya baris Note 2-3 lapis tetap ringkas di A4. */
th,td{min-width:0;border:.6pt solid #DFD8D1;padding:1.6mm 2.2mm;text-align:left;vertical-align:top;
  white-space:normal;overflow-wrap:anywhere;word-break:normal;hyphens:auto;line-height:1.32}
th{background:#F7F4F1;font-weight:600;line-height:1.25}
.kosong{color:#B9AFA6}
.kolom2{display:flex;gap:6mm}.kolom2>div{flex:1}
.sigbox{height:20mm;position:relative;margin-top:2mm}
.sig-nm{font-weight:700;border-top:.6pt solid #2B1B10;padding-top:1.5mm;display:inline-block;min-width:52mm}
.sig-jab{font-size:8.5pt;color:#7A6E66}
.pgnum{position:absolute;left:17mm;bottom:9mm;font-size:9pt;color:#7A6E66}
.paraf{position:absolute;right:17mm;bottom:9mm;font-size:8pt;color:#7A6E66}
.temuan{padding:2mm 2.5mm;border-left:2.5pt solid #DFD8D1;margin-bottom:2mm;font-size:9.5pt;background:#FAF8F6}
.temuan.kritis{border-left-color:#9C0006;background:#FDF3F3}
.temuan.perhatian{border-left-color:#B8860B;background:#FDFAF2}
.temuan strong{display:block;font-size:9.5pt}
.temuan .ubah{font-family:ui-monospace,monospace;font-size:9pt}
.kotak{border:.7pt solid #DFD8D1;padding:3mm;border-radius:1mm;background:#FAF8F6}
.galeri{display:flex;flex-wrap:wrap;gap:2mm}
.galeri figure{margin:0;width:46mm}
.galeri img{width:100%;height:32mm;object-fit:cover;border:.6pt solid #DFD8D1}
.galeri figcaption{font-size:7.5pt;color:#7A6E66;text-align:center;margin-top:.5mm}
.video{border:.7pt solid #DFD8D1;padding:2.5mm 3mm;border-radius:1mm;background:#FAF8F6;font-size:9pt}
.video a{color:#592203;word-break:break-all}
.video .ket{font-size:8pt;color:#7A6E66;margin-top:.8mm}
/* Tabel spesifikasi gaya spec sheet pabrik: No | Parameter | Value | Note.
   Lebar kolom diatur <colgroup>, bukan di sini. */
table.spek th.no{text-align:center}
/* Padding khusus kolom No. Padding sel normal 2,2mm × 2 = 16,6px, sementara
   "001" hanya butuh 20,5px — di kolom 6mm itu menyisakan 16,6px isi sehingga
   nomor patah dua baris. Padding 1,2mm di sini memberi 22,7 − 9,1 ≈ 13,6px
   isi; angka 8,5pt monospace tetap muat satu baris. */
table.spek th.no,table.spek td.no{padding-left:1.2mm;padding-right:1.2mm}
table.spek td.no{color:#7A6E66;font-size:8.5pt;text-align:center;font-family:ui-monospace,monospace;white-space:nowrap}
table.spek td.note{font-size:8.5pt;color:#4A3A2E}
.spekgbr{display:flex;flex-wrap:wrap;gap:2mm;margin:-1mm 0 3mm}
.spekgbr figure{margin:0;width:44mm}
.spekgbr img{width:100%;height:32mm;object-fit:contain;background:#fff;border:.6pt solid #DFD8D1}
.spekgbr figcaption{font-size:7pt;color:#7A6E66;text-align:center;margin-top:.4mm}
/* Baris panjang dipatah antar-halaman dengan bersih: header tabel diulang
   (thead sudah otomatis di thead), dan satu baris tidak pernah dibelah dua. */
tr{page-break-inside:avoid;break-inside:avoid}
/* Pengaman terakhir saat dicetak: apa pun yang tetap lebih lebar dari kolom
   dipotong di tepi sel, bukan menembus margin kertas. Hanya berlaku untuk
   media cetak supaya pratinjau di layar tetap menampilkan semua isi. */
@media print{
  table{max-width:100%}
  th,td{overflow:hidden}
}
`;

/** Dekorasi sudut kanan-bawah, sama seperti dokumen SPH/SPK. */
const HEX_IMG = '<img class="hex-bg" src="/hexagon-outline-bg.png" alt="" aria-hidden="true">';

/** Bingkai halaman + kop, sama untuk semua jenis dokumen. */
export function bingkai(judulTab: string, jenisDok: string, nomor: string, sub: string, isiHtml: string): string {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(judulTab) + '</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700&family=Barlow+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">'
    + '<style>' + GAYA + '</style></head><body>'
    + '<div class="page">' + HEX_IMG
    + '<div class="lethead"><div class="doctype">' + esc(jenisDok) + '</div>'
    + '<div class="co"><img class="mark-logo" src="/logo.png" alt="Belift" style="height:10mm;width:auto;display:block;margin-left:auto">'
    + '<div class="ent">PT. BELIFT AMANAH INDONESIA</div>' + esc(ALAMAT_KANTOR) + '<br>info@belift.co.id</div></div>'
    + '<div class="docno">' + esc(nomor) + '</div>'
    + (sub ? '<div class="subdocno">' + esc(sub) + '</div>' : '')
    + isiHtml
    + '<div class="pgnum">Dokumen ini dicetak dari sistem Belift</div>'
    + '<div class="paraf">Halaman 1</div>'
    + '</div></body></html>';
}

// ── Bagian isi dokumen yang dipakai bersama ─────────────────

/**
 * Lebar kolom eksplisit. Dipakai bersama `table-layout:fixed` di GAYA supaya
 * persentase benar-benar dihormati browser. Tanpa ini, tabel berisi teks
 * panjang (Note, Keterangan, Alasan) akan menekan kolom lain sampai tak
 * terbaca — sudah dibuktikan lewat pengukuran Chromium.
 */
/**
 * Lebar kolom "No" pada tabel Data Teknis.
 *
 * 6mm (≈22,7px) = angka "001" (20,5px) + padding kiri/kanan (2,2mm × 2 = 16,6px
 * ≈17,4px isi tersedia). Dulu 9mm ternyata hanya menyisakan 17,4px isi,
 * sedangkan teks "001" butuh 20,5px → membuat "001" patah jadi "00" / "1".
 * Tambahan ~0,7mm ini cukup untuk 999 baris (nomor 3 digit) tanpa memakan
 * ruang Parameter/Value, karena tabel memakai table-layout:fixed.
 */
export const LEBAR_NO = '6mm';

const kolom = (...lebar: string[]): string =>
  '<colgroup>' + lebar.map(w => '<col style="width:' + w + '">').join('') + '</colgroup>';

/**
 * URL tampil gambar lampiran (kunci R2 → /api/media).
 *
 * Nilai bisa berupa kunci mentah hasil unggah survey ATAU URL siap pakai dari
 * Master Data (`/api/media?key=…`). Yang sudah berupa URL dipakai apa adanya;
 * membungkusnya lagi akan menghasilkan alamat rusak.
 */
const urlGambar = (key: string): string =>
  (!key ? '' : (key.startsWith('/api/media') || /^(https?:)?\/\//.test(key))
    ? key
    : '/api/media?key=' + encodeURIComponent(key));

/**
 * Nilai satu field untuk cetak, sudah lengkap dengan satuan.
 * Field desain (Plafon/Lantai Cabin) memakai nama pilihan pengguna.
 */
function nilaiCetak(dt: DataTeknis, key: string, satuan?: string): string {
  const mentah = dt[key];
  let teks = mentah === null || mentah === undefined || Array.isArray(mentah) ? '' : String(mentah).trim();
  if (teks && satuan && !/kg|mm|m\/min|kW|orang|meter/i.test(teks)) teks += ' ' + satuan;
  return teks ? esc(teks) : '<span class="kosong">—</span>';
}

/**
 * Data Teknis — format spec sheet pabrik: No | Parameter | Value | Note.
 * Judul parameter & kelompok memakai bahasa Inggris (permintaan klien),
 * Note memakai catatan pengisi; bila kosong, dipakai catatan baku field.
 *
 * Baris yang dicetak = field yang ADA isinya (nilai / Note / gambar pilihan).
 * Mencetak seluruh 50+ parameter hanya akan menghasilkan dokumen penuh tanda
 * "—" dan menyulitkan pembaca pabrik; kelengkapan sudah tampil di Berkas.
 */
function tabelDt(dt: DataTeknis, hanyaWajib = false): string {
  // Dasar = SELURUH field, termasuk yang disembunyikan dari form. Baris hanya
  // dicetak bila ada isinya, jadi field lama (Sill Pintu, Finishing Cabin, …)
  // tetap muncul di dokumen yang sudah terlanjur menyimpannya — sedangkan
  // field yang kosong tidak ikut membanjiri halaman dengan tanda "—".
  const dasar = hanyaWajib
    ? DT_FIELDS.filter(f => FIELD_WAJIB_KUNCI.includes(f.key))
    : DT_FIELDS;

  // Travelling & Overhead berasal dari Tabel Lantai (sumber kebenaran).
  //
  // Dulu hanya diisi bila kosong. Akibatnya dokumen lama yang masih menyimpan
  // angka rumus LAMA (travelling 7000) bisa tercetak berbeda dengan Total
  // Height yang dihitung dari rumus baru. Sekarang, begitu tabel lantai
  // terisi, nilainya selalu dihitung ulang supaya konsisten satu dokumen.
  // Kalau tabel lantai kosong, nilai tersimpan/manual dipakai apa adanya.
  const dtEf: DataTeknis = { ...dt };
  const lantaiDt = dt.lantai as Lantai[] | undefined;
  const travelHitung = hitungTravelling(lantaiDt);
  if (travelHitung) dtEf.travelling = String(travelHitung);
  const ohHitung = hitungOverhead(lantaiDt);
  if (ohHitung) dtEf.overhead = String(ohHitung);
  if (!String(dtEf.totalHeight ?? '').trim() || travelHitung || ohHitung) {
    const t = hitungTotalHeight(dt);
    if (t) dtEf.totalHeight = String(t);
  }

  let nomor = 0;
  let html = '';

  for (const kel of KELOMPOK_FIELD) {
    const barisField = dasar.filter(f => {
      if (f.kel !== kel) return false;
      const nilai = dtEf[f.key];
      const ada = !(nilai === null || nilai === undefined || String(nilai).trim() === '');
      // Field sembunyi hanya dicetak kalau benar-benar berisi nilai — Note
      // sisa tidak boleh menghidupkan kembali parameter yang sudah dihapus.
      if (f.sembunyi) return ada;
      const note = dtEf['note:' + f.key];
      const img = dtEf['imgdesain:' + f.key];
      return ada || !!String(note ?? '').trim() || !!String(img ?? '').trim();
    });
    if (!barisField.length) continue;

    const gambarKel: string[] = [];
    const baris = barisField.map(f => {
      nomor += 1;
      const note = String(dtEf['note:' + f.key] ?? '').trim() || f.catatan || '';
      const imgDesain = String(dtEf['imgdesain:' + f.key] ?? '').trim();
      if (imgDesain) {
        // Wajib lewat urlGambar(): nilai dari Database Desain bisa berupa key
        // penyimpanan mentah ("recovery/.../x.png"), bukan URL siap pakai.
        // Tanpa ini, gambarnya dicetak sebagai alamat rusak alias tidak tampil.
        gambarKel.push('<figure><img src="' + esc(urlGambar(imgDesain)) + '" alt="' + esc(f.en) + '">'
          + '<figcaption>' + esc(f.en) + '</figcaption></figure>');
      }
      const lampiran = Array.isArray(dtEf['gambar:' + f.key]) ? (dtEf['gambar:' + f.key] as FotoDok[]) : [];
      lampiran.forEach((g, i) => {
        if (!g?.key) return;
        gambarKel.push('<figure><img src="' + esc(urlGambar(g.key)) + '" alt="' + esc(f.en) + '">'
          + '<figcaption>' + esc(f.en) + (lampiran.length > 1 ? ' ' + (i + 1) : '') + '</figcaption></figure>');
      });
      return '<tr><td class="no">' + String(nomor).padStart(3, '0') + '</td>'
        + '<td>' + esc(f.en) + '</td>'
        + '<td class="nilai">' + nilaiCetak(dtEf, f.key, f.satuan) + '</td>'
        + '<td class="note">' + (note ? esc(note) : '<span class="kosong">—</span>') + '</td></tr>';
    }).join('');

    html += '<h2>' + esc(KELOMPOK_EN[kel]) + '</h2>'
      + '<table class="spek">' + kolom(LEBAR_NO, '28%', '29%', '38%') + '<tr>'
      + '<th class="no">No</th><th class="par">Parameter</th><th class="val">Value</th><th class="note">Note</th>'
      + '</tr>' + baris + '</table>';
    if (gambarKel.length) html += '<div class="spekgbr">' + gambarKel.join('') + '</div>';
  }

  // Remarks: catatan bebas + gambar, tampil apa adanya (editable di form).
  const remarks = String(dt.remarks ?? '').trim();
  const gambarRemarks = Array.isArray(dt['gambar:remarks']) ? (dt['gambar:remarks'] as FotoDok[]) : [];
  if (remarks || gambarRemarks.length) {
    html += '<h2>Remarks</h2>';
    if (remarks) html += '<p style="white-space:pre-wrap">' + esc(remarks) + '</p>';
    if (gambarRemarks.length) {
      html += '<div class="spekgbr">' + gambarRemarks.map((g, i) => g?.key
        ? '<figure><img src="' + esc(urlGambar(g.key)) + '" alt="Remarks">'
          + '<figcaption>Remarks' + (gambarRemarks.length > 1 ? ' ' + (i + 1) : '') + '</figcaption></figure>'
        : '').join('') + '</div>';
    }
  }

  return html;
}

// Dipakai bersama oleh Final Survey dan PO, tetapi LABELNYA dibedakan:
//   · Final Survey = dokumen internal berbahasa Indonesia → label Indonesia
//   · PO            = dokumen ke pabrik, klien minta penuh Inggris
//     (permintaan 20 Nov 2026)
// Dulu satu fungsi dipakai keduanya, sehingga menerjemahkan label PO
// diam-diam ikut mengubah Final Survey. Parameter `inggris` memisahkannya.
function tabelLantai(lantai: Lantai[] | undefined, inggris = false): string {
  if (!lantai?.length) return '';
  // Kolom "No" sengaja tidak dicetak (permintaan klien 6 Nov 2026) — urutan
  // baris sudah menunjukkan nomor lantai.
  const baris = lantai.map(l => '<tr><td>' + isi(l.lantai) + '</td><td>'
    + isi(l.tinggi) + '</td><td>' + isi(l.door) + '</td><td>' + isi(l.finishing) + '</td></tr>').join('');
  const judul = inggris ? 'Floor Table' : 'Tabel Lantai';
  const k1 = inggris ? 'Floor' : 'Lantai';
  const k2 = inggris ? 'Height (mm)' : 'Tinggi (mm)';
  const k3 = inggris ? 'Door Opening' : 'Bukaan Pintu';
  const k4 = 'Finishing';
  return '<h2>' + judul + '</h2><table>' + kolom('20%', '24%', '28%', '28%')
    + '<tr><td><strong>' + k1 + '</strong></td><td><strong>' + k2 + '</strong></td>'
    + '<td><strong>' + k3 + '</strong></td><td><strong>' + k4 + '</strong></td></tr>'
    + baris + '</table>';
}

// Sama seperti tabelLantai: dipakai Final Survey & PO, label dibedakan
// lewat `inggris`. Nilai "Ya"/"Yes" ikut mengikuti bahasa dokumen.
function tabelAddon(addon: AddOn[] | undefined, inggris = false): string {
  const ada = (addon || []).filter(a => a.on || a.ada);
  if (!ada.length) return '';
  const ya = inggris ? 'Yes' : 'Ya';
  const baris = ada.map(a => '<tr><td>' + isi(a.kode) + '</td><td>' + esc(a.nama) + '</td>'
    + '<td>' + (a.on ? ya : '—') + '</td><td>' + (a.ada ? ya : '—') + '</td><td>'
    + (a.fotoLink ? esc(a.fotoLink) : '<span class="kosong">—</span>') + '</td></tr>').join('');
  const k = inggris
    ? ['Code', 'Name', 'Ordered', 'Available', 'Photo']
    : ['Kode', 'Nama', 'Dipesan', 'Sudah Ada', 'Foto'];
  return '<h2>Add-on</h2><table>' + kolom('12%', '28%', '11%', '11%', '38%')
    + '<tr><td><strong>' + k[0] + '</strong></td><td><strong>' + k[1] + '</strong></td>'
    + '<td><strong>' + k[2] + '</strong></td><td><strong>' + k[3] + '</strong></td>'
    + '<td><strong>' + k[4] + '</strong></td></tr>' + baris + '</table>';
}

function isiGaleri(dok: BarisDokumentasi[]): string {
  // Baris tanpa kolom `foto` (data lama / sebagian terisi) tidak boleh
  // menggagalkan seluruh dokumen cetak.
  const baris = Array.isArray(dok) ? dok : [];
  return baris.filter(d => d && Array.isArray(d.foto) && d.foto.length).flatMap(d =>
    d.foto.filter(f => f && f.key).map((f, i) => '<figure><img src="' + esc(urlGambar(f.key))
      + '" alt="' + esc(d.judul) + '"><figcaption>' + esc(d.judul)
      + (d.foto.length > 1 ? ' (' + (i + 1) + '/' + d.foto.length + ')' : '') + '</figcaption></figure>')).join('');
}

/** Tautan video: kalau user mengetik tanpa skema (youtube.com/…), tambahkan
 *  https:// supaya tetap bisa diklik. Teks yang bukan URL dicetak apa adanya. */
function urlVideo(v: string): string {
  const t = v.trim();
  if (!t) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : 'https://' + t.replace(/^\/+/, '');
}

/**
 * Bagian Dokumentasi — foto dan tautan video dalam SATU section.
 *
 * Dulu tautan video dicetak sebagai baris di tabel "Identitas Proyek" di
 * halaman pertama, sehingga tidak terbaca sebagai dokumentasi. Sekarang
 * keduanya menyatu: judul "Dokumentasi", isinya galeri foto lalu tautan video.
 * Kalau salah satu kosong, yang lain tetap tampil; kalau dua-duanya kosong,
 * section tidak dicetak sama sekali.
 */
function bagianDokumentasi(dok: BarisDokumentasi[], videoLink: string): string {
  const foto = isiGaleri(dok);
  const video = (typeof videoLink === 'string' ? videoLink : '').trim();
  if (!foto && !video) return '';
  return '<h2>Dokumentasi</h2>'
    + (foto ? '<div class="galeri">' + foto + '</div>' : '')
    + (video
      ? '<div class="video"' + (foto ? ' style="margin-top:3mm"' : '') + '>'
        + '<strong style="font-size:9pt">Video Dokumentasi</strong>'
        + '<div><a href="' + esc(urlVideo(video)) + '" target="_blank" rel="noopener">' + esc(video) + '</a></div>'
        + '<div class="ket">Klik / pindai tautan untuk membuka rekaman video survey.</div></div>'
      : '');
}

function tabelPekerjaan(p: PekerjaanTambahan[] | undefined): string {
  // Berjaga terhadap baris cacat / kolom lama: satu nilai yang bukan teks
  // cukup untuk mematikan seluruh dokumen cetak.
  const teks = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const ada = (Array.isArray(p) ? p : []).filter(x => x && teks(x.nama));
  if (!ada.length) return '';
  const baris = ada.map(x => '<tr><td>' + esc(x.nama) + '</td><td>' + (x.on ? 'Ya' : 'Tidak') + '</td><td>' + isi(x.ket) + '</td></tr>').join('');
  return '<h2>Pekerjaan Tambahan</h2><table>' + kolom('32%', '14%', '54%')
    + '<tr><td><strong>Pekerjaan</strong></td>'
    + '<td><strong>Dikerjakan</strong></td><td><strong>Keterangan</strong></td></tr>'
    + baris + '</table>';
}

function tabelKesimpulan(k: ButirKesimpulan[] | undefined): string {
  const ada = (Array.isArray(k) ? k : []).filter(x => x && x.jawab);
  if (!ada.length) return '';
  const baris = ada.map((x, i) => '<tr><td>' + (i + 1) + '. ' + esc(x.q) + '</td><td>'
    + esc(x.jawab) + '</td><td>' + isi(x.alasan) + '</td></tr>').join('');
  return '<h2>Kesimpulan</h2><table>' + kolom('38%', '18%', '44%')
    + '<tr><td><strong>Pertanyaan</strong></td>'
    + '<td><strong>Jawaban</strong></td><td><strong>Alasan</strong></td></tr>' + baris + '</table>';
}

function blokTtd(ttd: TtdSurvey, final: boolean): string {
  const orang = final
    ? [['Disurvey Oleh', ttd.sales], ['Surveyor', ttd.surveyor], ['Customer', ttd.customer]]
    : [['Disurvey Oleh', ttd.sales], ['Customer', ttd.customer]];
  return '<h2>Penanda Tangan</h2><div class="kolom2" style="margin-top:6mm">'
    + orang.map(([jab, nm]) => '<div><div class="sigbox"></div><span class="sig-nm">' + esc(nm || ' ')
      + '</span><div class="sig-jab">' + esc(jab) + '</div></div>').join('')
    + '</div>';
}

// ── 1. SURVEY (Sales / Final) ───────────────────────────────

export interface BahanCetakSurvey {
  jenis: 'sales' | 'final';
  judul: string;
  noSurvey: string;
  tgl: string;
  kodeProyek: string;
  namaProspek: string;
  kodeLead: string;
  surveyor: string;
  pjLapangan: string;
  pjTelp: string;
  jamKerja: string;
  dt: DataTeknis;
  dokumentasi: BarisDokumentasi[];
  pekerjaan: PekerjaanTambahan[];
  kesimpulan: ButirKesimpulan[];
  ttd: TtdSurvey;
  catatanLapangan: string;
  videoLink: string;
  dikunciOleh?: string | null;
  dikunciPada?: string | null;
}

/**
 * HTML dokumen Survey — dipisah dari cetakSurvey() supaya pratinjau di layar
 * (SurveyPreview) memakai isi yang SAMA PERSIS dengan hasil cetak.
 */
export function htmlSurvey(b: BahanCetakSurvey): string {
  const final = b.jenis === 'final';
  const kepala = '<h2>Identitas Proyek</h2><table>' + kolom('36%', '64%')
    + '<tr><th>Kode Proyek</th><td class="nilai"><strong>' + isi(b.kodeProyek) + '</strong></td></tr>'
    + '<tr><th>Kode Lead</th><td class="nilai">' + esc(b.kodeLead) + '</td></tr>'
    + '<tr><th>Nama Proyek / Customer</th><td class="nilai">' + esc(b.namaProspek) + '</td></tr>'
    + '<tr><th>Tanggal Survey</th><td class="nilai">' + fmtTgl(b.tgl) + '</td></tr>'
    + '<tr><th>' + (final ? 'Surveyor' : 'Disurvey Oleh') + '</th><td class="nilai">'
    + esc(final ? b.surveyor : b.ttd.sales) + '</td></tr>'
    + '<tr><th>PJ Lapangan</th><td class="nilai">' + isi(b.pjLapangan) + (b.pjTelp ? ' · ' + esc(b.pjTelp) : '') + '</td></tr>'
    + '<tr><th>Jam Kerja di Lokasi</th><td class="nilai">' + isi(b.jamKerja) + '</td></tr>'
    + (final && b.dikunciOleh ? '<tr><th>Dikunci Oleh</th><td class="nilai">' + esc(b.dikunciOleh)
      + ' · ' + fmtTgl(b.dikunciPada) + '</td></tr>' : '')
    + '</table>';

  const isiHtml = kepala
    + tabelDt(b.dt)
    + tabelLantai(b.dt.lantai as unknown as Lantai[])
    + tabelAddon(b.dt.addon as unknown as AddOn[])
    + tabelPekerjaan(b.pekerjaan)
    + tabelKesimpulan(b.kesimpulan)
    + bagianDokumentasi(b.dokumentasi, b.videoLink)
    + (b.catatanLapangan ? '<h2>Catatan Lapangan</h2><div class="kotak">' + esc(b.catatanLapangan).replace(/\n/g, '<br>') + '</div>' : '')
    + blokTtd(b.ttd, final);

  return bingkai(b.judul, final ? 'FINAL SURVEY' : 'SURVEY', b.noSurvey || '—',
    'Hasil Survey Teknis — ' + b.namaProspek, isiHtml);
}

/** Cetak Survey lewat pop-up (perilaku lama dipertahankan). */
export async function cetakSurvey(b: BahanCetakSurvey) {
  await cetakHtml(htmlSurvey(b), b.judul);
}

// ── 2. Ringkasan teks untuk aplikasi KOM ────────────────────
//  Mengikuti pola exportKOM() di prototipe klien: teks polos,
//  siap tempel, tanpa berkas yang diunduh.

export function teksRingkasSurvey(b: {
  jenis: 'sales' | 'final';
  noSurvey: string; tgl: string; kodeProyek: string; namaProspek: string;
  dt: DataTeknis; addon: AddOn[]; lantai: Lantai[];
}): string {
  const f = (k: string) => String(b.dt[k] ?? '').trim() || '-';
  const baris: string[] = [
    'Kode Proyek: ' + (b.kodeProyek || '-'),
    'No ' + (b.jenis === 'final' ? 'Final Survey' : 'Survey') + ': ' + (b.noSurvey || '-'),
    'Tanggal: ' + (b.tgl || '-'),
    'Nama Proyek: ' + (b.namaProspek || '-'),
    '',
    'Jenis lift: ' + f('jenisLift') + '   Model: ' + f('model'),
    'Kapasitas: ' + f('kapasitas') + ' kg   Penumpang: ' + f('penumpang'),
    'Kecepatan: ' + f('kecepatan') + '   Floors/Stops/Doors: ' + f('sfd'),
    'Tipe mesin: ' + f('tipeMesin'),
    'Ukuran shaft: ' + f('shaftSize') + '   Pit: ' + f('pitDepth') + '   Overhead: ' + f('overhead'),
    'Pintu: ' + f('tipePintu') + ' ' + f('bukaanPintu') + '   Sill: ' + f('sillPintu'),
    'Cabin: ' + f('cabinSize') + '   Bahan: ' + f('bahanCabin') + '   Warna: ' + f('warnaCabin'),
    'Power Supply: ' + f('power'),
    'Grounding: ' + f('grounding') + '   ARD: ' + f('ard'),
    'Akses jalan: ' + f('aksesJalan') + '   Ruang kerja: ' + f('ruangKerja'),
  ];

  const addonOn = (b.addon || []).filter(a => a.on);
  if (addonOn.length) {
    baris.push('');
    baris.push('Add-on (' + addonOn.length + '): ' + addonOn.map(a => a.kode || a.nama).join(', '));
  }
  if ((b.lantai || []).length) {
    baris.push('');
    baris.push('Lantai (' + b.lantai.length + '):');
    b.lantai.forEach((l, i) => baris.push('  ' + (i + 1) + '. ' + (l.lantai || '-')
      + ' — tinggi ' + (l.tinggi || '-') + ' mm, pintu ' + (l.door || '-') + ', ' + (l.finishing || '-')));
  }
  const kosong = DT_FIELDS.filter(x => !String(b.dt[x.key] ?? '').trim()).map(x => x.label);
  baris.push('');
  baris.push(kosong.length ? 'Field belum diisi: ' + kosong.join(', ') : 'Field belum diisi: (tidak ada)');
  return baris.join('\n');
}

export async function salinRingkasSurvey(b: Parameters<typeof teksRingkasSurvey>[0]): Promise<boolean> {
  const teks = teksRingkasSurvey(b);
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    // Fallback bila clipboard diblokir
    const ta = document.createElement('textarea');
    ta.value = teks;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const hasil = document.execCommand('copy');
    document.body.removeChild(ta);
    return hasil;
  }
}

// ── 3. LACAK — lembar perbandingan data teknis ──────────────

export interface BahanCetakLacak {
  namaProspek: string;
  kodeLead: string;
  kodeProyek: string | null;
  titik: { label: string; sub: string }[];
  temuan: TemuanDiff[];
  sumber: string;
  pembanding: string;
}

export async function cetakLacak(b: BahanCetakLacak) {
  const temuan = Array.isArray(b.temuan) ? b.temuan : [];
  const kritis = temuan.filter(t => t.tingkat === 'kritis').length;
  const perhatian = temuan.filter(t => t.tingkat === 'perhatian').length;

  const kepala = '<h2>Proyek</h2><table>' + kolom('32%', '68%')
    + '<tr><th>Nama Proyek / Customer</th><td class="nilai">' + esc(b.namaProspek) + '</td></tr>'
    + '<tr><th>Kode Lead</th><td class="nilai">' + esc(b.kodeLead) + '</td></tr>'
    + '<tr><th>Kode Proyek</th><td class="nilai">' + isi(b.kodeProyek) + '</td></tr>'
    + '<tr><th>Dibandingkan</th><td class="nilai">' + esc(b.sumber) + ' &nbsp;→&nbsp; ' + esc(b.pembanding) + '</td></tr>'
    + '<tr><th>Tanggal Cetak</th><td class="nilai">' + fmtTgl(new Date().toISOString()) + '</td></tr>'
    + '</table>';

  const rantai = '<h2>Titik Data Kunci</h2><table>' + kolom('40%', '60%')
    + b.titik.map(t => '<tr><th>' + esc(t.label) + '</th><td class="nilai">' + esc(t.sub) + '</td></tr>').join('')
    + '</table>';

  const daftarTemuan = temuan.length === 0
    ? '<div class="kotak">Tidak ada perbedaan data teknis antara kedua titik yang dibandingkan.</div>'
    : temuan.map(t => '<div class="temuan ' + esc(t.tingkat) + '"><strong>' + esc(t.label) + '</strong>'
      + '<span class="ubah">' + esc(t.teks) + '</span></div>').join('');

  const isiHtml = kepala + rantai
    + '<h2>Hasil Perbandingan</h2>'
    + '<p style="font-size:9.5pt;margin:0 0 3mm">' + temuan.length + ' perbedaan — '
    + kritis + ' setelah Final Survey (kritis), ' + perhatian + ' setelah kontrak (perhatian).</p>'
    + daftarTemuan
    + '<h2>Tanda Tangan</h2><div class="kolom2" style="margin-top:6mm">'
    + '<div><div class="sigbox"></div><span class="sig-nm"> </span><div class="sig-jab">Surveyor</div></div>'
    + '<div><div class="sigbox"></div><span class="sig-nm"> </span><div class="sig-jab">Operasional / PIC PO</div></div>'
    + '</div>';

  await cetakHtml(
    bingkai('Lacak Data Teknis', 'LACAK', 'PERBANDINGAN DATA TEKNIS', 'Hasil Lacak — ' + b.namaProspek, isiHtml),
    'Lacak Data Teknis',
  );
}

// ── 4. PO PABRIK — pesanan resmi ke pabrik ──────────────────

export interface BahanCetakPo {
  no_po: string | null;
  tgl_po: string | null;
  kode_proyek: string | null;
  nama_prospek?: string | null;
  kode_lead?: string | null;
  pabrik: string | null;
  pic: string | null;
  catatan: string | null;
  rev_terakhir: number;
  status: string;
  dibuat_oleh: string | null;
}

/**
 * HTML dokumen PO Pabrik — DIPISAH dari cetakPo() supaya bisa dipakai dua
 * tempat: pratinjau di layar (PoPreview) dan cetak (window.print / pop-up).
 * Kalau isinya digandakan, pratinjau dan hasil cetak pasti akan berbeda.
 */
export function htmlPo(po: BahanCetakPo, revisi: PoRevisiRow[], pabrik?: string, pic?: string): string {
  const rev = revisi[0];
  const dt = (rev?.dt || null) as DataTeknis | null;
  const pakaiPabrik = pabrik || po.pabrik;

  const kepala = '<h2>Order Details</h2><table>' + kolom('36%', '64%')
    + '<tr><th>PO Number</th><td class="nilai"><strong>' + isi(po.no_po) + '</strong></td></tr>'
    + '<tr><th>PO Date</th><td class="nilai">' + fmtTgl(po.tgl_po) + '</td></tr>'
    + '<tr><th>Project Code</th><td class="nilai">' + isi(po.kode_proyek) + '</td></tr>'
    + '<tr><th>Project / Customer</th><td class="nilai">' + isi(po.nama_prospek) + '</td></tr>'
    + '<tr><th>Factory</th><td class="nilai">' + isi(pakaiPabrik) + '</td></tr>'
    + '<tr><th>Factory PIC</th><td class="nilai">' + isi(pic || po.pic) + '</td></tr>'
    + '<tr><th>Revision</th><td class="nilai">' + (po.rev_terakhir || 0) + (rev?.alasan ? ' — ' + esc(rev.alasan) : '') + '</td></tr>'
    + (po.catatan ? '<tr><th>Remarks</th><td class="nilai">' + esc(po.catatan) + '</td></tr>' : '')
    + '</table>';

  const isiHtml = kepala
    + '<h2>Technical Data — Factory Reference</h2>'
    + (dt
      ? '<p style="font-size:9.5pt;margin:0 0 2mm">This data is a copy of the <strong>locked Final Survey</strong>'
        + (rev && rev.rev > 1 ? ', revision ' + rev.rev : '') + '.</p>'
        + tabelDt(dt)
        + tabelLantai(dt.lantai as unknown as Lantai[], true)
        + tabelAddon(dt.addon as unknown as AddOn[], true)
      : '<div class="kotak">PO not yet issued — technical reference data is not locked.</div>')
    + (revisi.length > 1
      ? '<h2>Revision History</h2><table>' + kolom('10%', '20%', '18%', '52%')
        + '<tr><td><strong>Rev</strong></td>'
        + '<td><strong>Date</strong></td><td><strong>By</strong></td>'
        + '<td><strong>Reason / Change</strong></td></tr>'
        + revisi.map(r => '<tr><td>' + r.rev + '</td><td>' + fmtTgl(r.tgl_revisi) + '</td><td>' + isi(r.oleh)
          + '</td><td>' + isi(r.alasan) + (r.jml_perubahan ? ' · ' + r.jml_perubahan + ' changes' : '') + '</td></tr>').join('')
        + '</table>'
      : '')
    + '<h2>Authorization</h2><div class="kolom2" style="margin-top:6mm">'
    + ['Prepared — Operations', 'Checked — Manager', 'Approved — Director'].map(j =>
      '<div><div class="sigbox"></div><span class="sig-nm"> </span><div class="sig-jab">' + esc(j) + '</div></div>').join('')
    + '</div>';

  return bingkai('Purchase Order', 'PURCHASE ORDER', po.no_po || '—', '', isiHtml);
}

/** Cetak PO lewat pop-up (perilaku lama dipertahankan). */
export async function cetakPo(po: BahanCetakPo, revisi: PoRevisiRow[], pabrik?: string, pic?: string) {
  await cetakHtml(htmlPo(po, revisi, pabrik, pic), 'PO Pabrik');
}

/** Ringkasan teks PO untuk ditempel ke surel / aplikasi lain. */
export function teksRingkasPo(po: BahanCetakPo, revisi: PoRevisiRow[]): string {
  const rev = revisi[0];
  const dt = (rev?.dt || {}) as DataTeknis;
  const f = (k: string) => String(dt[k] ?? '').trim() || '-';
  const baris = [
    'Nomor PO: ' + (po.no_po || '-'),
    'Tanggal: ' + (po.tgl_po ? String(po.tgl_po).slice(0, 10) : '-'),
    'Kode Proyek: ' + (po.kode_proyek || '-'),
    'Nama Proyek: ' + (po.nama_prospek || '-'),
    'Pabrik: ' + (po.pabrik || '-'),
    'PIC: ' + (po.pic || '-'),
    'Revisi: ' + (po.rev_terakhir || 0),
    '',
    'DATA TEKNIS ACUAN',
    'Jenis lift: ' + f('jenisLift') + '   Kapasitas: ' + f('kapasitas') + ' kg',
    'Kecepatan: ' + f('kecepatan') + '   Floors/Stops/Doors: ' + f('sfd'),
    'Ukuran shaft: ' + f('shaftSize') + '   Pit: ' + f('pitDepth') + '   Overhead: ' + f('overhead'),
    'Pintu: ' + f('tipePintu') + ' ' + f('bukaanPintu') + '   Sill: ' + f('sillPintu'),
    'Cabin: ' + f('cabinSize') + '   Bahan: ' + f('bahanCabin') + '   Warna: ' + f('warnaCabin'),
    'Power Supply: ' + f('power'),
  ];
  const addonOn = ((dt.addon as unknown as AddOn[]) || []).filter(a => a.on);
  if (addonOn.length) {
    baris.push('');
    baris.push('Add-on (' + addonOn.length + '): ' + addonOn.map(a => a.kode || a.nama).join(', '));
  }
  const lantai = (dt.lantai as unknown as Lantai[]) || [];
  if (lantai.length) {
    baris.push('');
    baris.push('Lantai (' + lantai.length + '): ' + lantai.map((l, i) =>
      (i + 1) + '. ' + (l.lantai || '-') + ' — ' + (l.tinggi || '-') + 'mm').join('; '));
  }
  if (po.catatan) { baris.push(''); baris.push('Catatan: ' + po.catatan); }
  if (revisi.length > 1) {
    baris.push('');
    baris.push('RIWAYAT REVISI');
    revisi.forEach(r => baris.push('  Rev ' + r.rev + ' — ' + (r.tgl_revisi ? String(r.tgl_revisi).slice(0, 10) : '-')
      + ' — ' + (r.alasan || 'tanpa alasan') + (r.jml_perubahan ? ' (' + r.jml_perubahan + ' perubahan)' : '')));
  }
  return baris.join('\n');
}

export async function salinRingkasPo(po: BahanCetakPo, revisi: PoRevisiRow[]): Promise<boolean> {
  const teks = teksRingkasPo(po, revisi);
  try {
    await navigator.clipboard.writeText(teks);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = teks;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const hasil = document.execCommand('copy');
    document.body.removeChild(ta);
    return hasil;
  }
}
