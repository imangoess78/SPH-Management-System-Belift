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

import { DT_FIELDS, type DataTeknis, type BarisDokumentasi, type PekerjaanTambahan,
  type ButirKesimpulan, type TtdSurvey, type AddOn, type Lantai, type TemuanDiff,
  type PoRevisiRow } from './survey-types';

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
.page::before{content:"";position:absolute;left:0;top:0;width:34mm;height:24mm;background:#D95103;border-bottom-right-radius:9mm}
.page::after{content:"";position:absolute;left:6mm;top:0;width:26mm;height:20mm;border:.7pt solid #fff;border-top:0;border-bottom-right-radius:8mm}
.lethead{display:flex;justify-content:space-between;align-items:flex-start;margin-left:5mm;gap:10mm}
.doctype{font-size:46pt;color:#da5d1a;letter-spacing:.02em;line-height:1;margin-top:14mm;font-weight:500}
.co{text-align:right;font-size:8.5pt;color:#4A3A2E;line-height:1.45;margin-top:2mm}
.co .mark-logo{height:10mm;width:auto;display:block;margin-left:auto}
.co .ent{font-size:11pt;color:#A63F04;font-weight:500;margin-bottom:1mm}
.docno{text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:17pt;font-weight:600;color:#2B1B10;margin:6mm 0 1mm}
.subdocno{text-align:center;font-size:9pt;color:#7A6E66;margin-bottom:6mm}
h2{font-size:11pt;margin:6mm 0 2mm;font-weight:700;color:#A63F04;border-bottom:.7pt solid #DFD8D1;padding-bottom:1mm}
h3{font-size:10pt;margin:4mm 0 1.5mm;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:3mm}
th,td{border:.6pt solid #DFD8D1;padding:1.6mm 2.2mm;text-align:left;vertical-align:top}
th{background:#F7F4F1;font-weight:600;width:38%}
td.nilai{width:62%}
.kosong{color:#B9AFA6}
.kolom2{display:flex;gap:6mm}.kolom2>div{flex:1}
.sigbox{height:20mm;position:relative;margin-top:2mm}
.sig-nm{font-weight:700;border-top:.6pt solid #2B1B10;padding-top:1.5mm;display:inline-block;min-width:52mm}
.sig-jab{font-size:8.5pt;color:#7A6E66}
.pgnum{position:absolute;left:17mm;bottom:9mm;font-size:8.5pt;color:#7A6E66}
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
`;

/** Bingkai halaman + kop, sama untuk semua jenis dokumen. */
export function bingkai(judulTab: string, jenisDok: string, nomor: string, sub: string, isiHtml: string): string {
  return '<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">'
    + '<meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(judulTab) + '</title>'
    + '<link rel="preconnect" href="https://fonts.googleapis.com">'
    + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    + '<link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700&family=Barlow+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">'
    + '<style>' + GAYA + '</style></head><body>'
    + '<div class="page">'
    + '<div class="lethead"><div class="doctype">' + esc(jenisDok) + '</div>'
    + '<div class="co"><img class="mark-logo" src="/logo.png" alt="Belift">'
    + '<div class="ent">PT. BELIFT AMANAH INDONESIA</div>' + esc(ALAMAT_KANTOR) + '<br>info@belift.co.id</div></div>'
    + '<div class="docno">' + esc(nomor) + '</div>'
    + (sub ? '<div class="subdocno">' + esc(sub) + '</div>' : '')
    + isiHtml
    + '<div class="pgnum">Dokumen ini dicetak dari sistem Belift</div>'
    + '<div class="paraf">Halaman 1</div>'
    + '</div></body></html>';
}

/** Buka jendela baru lalu cetak. Sama polanya dengan SPHForm. */
export function cetakHtml(html: string, judul: string) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { window.alert('Pop-up diblokir. Izinkan pop-up untuk mencetak.'); return; }
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── Bagian isi dokumen yang dipakai bersama ─────────────────

function tabelDt(dt: DataTeknis, hanyaWajib = false): string {
  const field = hanyaWajib
    ? DT_FIELDS.filter(f => ['jenisLift','kapasitas','kecepatan','sfd','shaftSize','pitDepth','overhead','tipePintu','bukaanPintu','cabinSize','bahanCabin','finishCabin','dayaMesin','power'].includes(f.key))
    : DT_FIELDS;
  return field.map(f => '<tr><th>' + esc(f.label) + (f.satuan ? ' (' + esc(f.satuan) + ')' : '')
    + '</th><td class="nilai">' + isi(dt[f.key]) + '</td></tr>').join('');
}

function tabelLantai(lantai: Lantai[] | undefined): string {
  if (!lantai?.length) return '';
  const baris = lantai.map((l, i) => '<tr><td>' + (i + 1) + '</td><td>' + isi(l.lantai) + '</td><td>'
    + isi(l.tinggi) + '</td><td>' + isi(l.door) + '</td><td>' + isi(l.finishing) + '</td></tr>').join('');
  return '<h2>Tabel Lantai</h2><table><tr><td style="width:8%"><strong>No</strong></td>'
    + '<td style="width:20%"><strong>Lantai</strong></td><td style="width:22%"><strong>Tinggi (mm)</strong></td>'
    + '<td style="width:25%"><strong>Bukaan Pintu</strong></td><td style="width:25%"><strong>Finishing</strong></td></tr>'
    + baris + '</table>';
}

function tabelAddon(addon: AddOn[] | undefined): string {
  const ada = (addon || []).filter(a => a.on || a.ada);
  if (!ada.length) return '';
  const baris = ada.map(a => '<tr><td>' + isi(a.kode) + '</td><td>' + esc(a.nama) + '</td>'
    + '<td>' + (a.on ? 'Ya' : '—') + '</td><td>' + (a.ada ? 'Ya' : '—') + '</td><td>'
    + (a.fotoLink ? esc(a.fotoLink) : '<span class="kosong">—</span>') + '</td></tr>').join('');
  return '<h2>Add-on</h2><table><tr><td style="width:18%"><strong>Kode</strong></td><td style="width:32%"><strong>Nama</strong></td>'
    + '<td style="width:12%"><strong>Dipesan</strong></td><td style="width:12%"><strong>Sudah Ada</strong></td>'
    + '<td style="width:26%"><strong>Foto</strong></td></tr>' + baris + '</table>';
}

function galeriFoto(dok: BarisDokumentasi[]): string {
  // Baris tanpa kolom `foto` (data lama / sebagian terisi) tidak boleh
  // menggagalkan seluruh dokumen cetak.
  const baris = Array.isArray(dok) ? dok : [];
  const isiFoto = baris.filter(d => d && Array.isArray(d.foto) && d.foto.length).flatMap(d =>
    d.foto.map(f => '<figure><img src="/api/media?key=' + encodeURIComponent(f.key) + '" alt="' + esc(d.judul)
      + '"><figcaption>' + esc(d.judul) + '</figcaption></figure>')).join('');
  return isiFoto ? '<h2>Dokumentasi Foto</h2><div class="galeri">' + isiFoto + '</div>' : '';
}

function tabelPekerjaan(p: PekerjaanTambahan[] | undefined): string {
  // Berjaga terhadap baris cacat / kolom lama: satu nilai yang bukan teks
  // cukup untuk mematikan seluruh dokumen cetak.
  const teks = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const ada = (Array.isArray(p) ? p : []).filter(x => x && teks(x.nama));
  if (!ada.length) return '';
  const baris = ada.map(x => '<tr><td>' + esc(x.nama) + '</td><td>' + (x.on ? 'Ya' : 'Tidak') + '</td><td>' + isi(x.ket) + '</td></tr>').join('');
  return '<h2>Pekerjaan Tambahan</h2><table><tr><td style="width:35%"><strong>Pekerjaan</strong></td>'
    + '<td style="width:15%"><strong>Dikerjakan</strong></td><td style="width:50%"><strong>Keterangan</strong></td></tr>'
    + baris + '</table>';
}

function tabelKesimpulan(k: ButirKesimpulan[] | undefined): string {
  const ada = (Array.isArray(k) ? k : []).filter(x => x && x.jawab);
  if (!ada.length) return '';
  const baris = ada.map((x, i) => '<tr><td>' + (i + 1) + '. ' + esc(x.q) + '</td><td style="width:22%">'
    + esc(x.jawab) + '</td><td style="width:33%">' + isi(x.alasan) + '</td></tr>').join('');
  return '<h2>Kesimpulan</h2><table><tr><td style="width:45%"><strong>Pertanyaan</strong></td>'
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

export function cetakSurvey(b: BahanCetakSurvey) {
  const final = b.jenis === 'final';
  const kepala = '<h2>Identitas Proyek</h2><table>'
    + '<tr><th>Kode Proyek</th><td class="nilai"><strong>' + isi(b.kodeProyek) + '</strong></td></tr>'
    + '<tr><th>Kode Lead</th><td class="nilai">' + esc(b.kodeLead) + '</td></tr>'
    + '<tr><th>Nama Proyek / Customer</th><td class="nilai">' + esc(b.namaProspek) + '</td></tr>'
    + '<tr><th>Tanggal Survey</th><td class="nilai">' + fmtTgl(b.tgl) + '</td></tr>'
    + '<tr><th>' + (final ? 'Surveyor' : 'Disurvey Oleh') + '</th><td class="nilai">'
    + esc(final ? b.surveyor : b.ttd.sales) + '</td></tr>'
    + '<tr><th>PJ Lapangan</th><td class="nilai">' + isi(b.pjLapangan) + (b.pjTelp ? ' · ' + esc(b.pjTelp) : '') + '</td></tr>'
    + '<tr><th>Jam Kerja di Lokasi</th><td class="nilai">' + isi(b.jamKerja) + '</td></tr>'
    + (b.videoLink ? '<tr><th>Tautan Video</th><td class="nilai">' + esc(b.videoLink) + '</td></tr>' : '')
    + (final && b.dikunciOleh ? '<tr><th>Dikunci Oleh</th><td class="nilai">' + esc(b.dikunciOleh)
      + ' · ' + fmtTgl(b.dikunciPada) + '</td></tr>' : '')
    + '</table>';

  const isiHtml = kepala
    + '<h2>Data Teknis</h2><table>' + tabelDt(b.dt) + '</table>'
    + tabelLantai(b.dt.lantai as unknown as Lantai[])
    + tabelAddon(b.dt.addon as unknown as AddOn[])
    + tabelPekerjaan(b.pekerjaan)
    + tabelKesimpulan(b.kesimpulan)
    + galeriFoto(b.dokumentasi)
    + (b.catatanLapangan ? '<h2>Catatan Lapangan</h2><div class="kotak">' + esc(b.catatanLapangan).replace(/\n/g, '<br>') + '</div>' : '')
    + blokTtd(b.ttd, final);

  cetakHtml(
    bingkai(b.judul, final ? 'FINAL SURVEY' : 'SURVEY', b.noSurvey || '—',
      'Hasil Survey Teknis — ' + b.namaProspek, isiHtml),
    b.judul,
  );
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
    'Kecepatan: ' + f('kecepatan') + '   SFD: ' + f('sfd'),
    'Tipe mesin: ' + f('tipeMesin') + '   Penggerak: ' + f('drive'),
    'Ukuran shaft: ' + f('shaftSize') + '   Pit: ' + f('pitDepth') + '   Overhead: ' + f('overhead'),
    'Pintu: ' + f('tipePintu') + ' ' + f('bukaanPintu') + '   Sill: ' + f('sillPintu'),
    'Cabin: ' + f('cabinSize') + '   Bahan: ' + f('bahanCabin') + '   Finishing: ' + f('finishCabin'),
    'Daya mesin: ' + f('dayaMesin') + '   Power: ' + f('power'),
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

export function cetakLacak(b: BahanCetakLacak) {
  const temuan = Array.isArray(b.temuan) ? b.temuan : [];
  const kritis = temuan.filter(t => t.tingkat === 'kritis').length;
  const perhatian = temuan.filter(t => t.tingkat === 'perhatian').length;

  const kepala = '<h2>Proyek</h2><table>'
    + '<tr><th>Nama Proyek / Customer</th><td class="nilai">' + esc(b.namaProspek) + '</td></tr>'
    + '<tr><th>Kode Lead</th><td class="nilai">' + esc(b.kodeLead) + '</td></tr>'
    + '<tr><th>Kode Proyek</th><td class="nilai">' + isi(b.kodeProyek) + '</td></tr>'
    + '<tr><th>Dibandingkan</th><td class="nilai">' + esc(b.sumber) + ' &nbsp;→&nbsp; ' + esc(b.pembanding) + '</td></tr>'
    + '<tr><th>Tanggal Cetak</th><td class="nilai">' + fmtTgl(new Date().toISOString()) + '</td></tr>'
    + '</table>';

  const rantai = '<h2>Titik Data Kunci</h2><table>'
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

  cetakHtml(
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

export function cetakPo(po: BahanCetakPo, revisi: PoRevisiRow[], pabrik?: string, pic?: string) {
  const rev = revisi[0];
  const dt = (rev?.dt || null) as DataTeknis | null;
  const pakaiPabrik = pabrik || po.pabrik;

  const kepala = '<h2>Data Pesanan</h2><table>'
    + '<tr><th>Nomor PO</th><td class="nilai"><strong>' + isi(po.no_po) + '</strong></td></tr>'
    + '<tr><th>Tanggal PO</th><td class="nilai">' + fmtTgl(po.tgl_po) + '</td></tr>'
    + '<tr><th>Kode Proyek</th><td class="nilai">' + isi(po.kode_proyek) + '</td></tr>'
    + '<tr><th>Nama Proyek / Customer</th><td class="nilai">' + isi(po.nama_prospek) + '</td></tr>'
    + '<tr><th>Pabrik Tujuan</th><td class="nilai">' + isi(pakaiPabrik) + '</td></tr>'
    + '<tr><th>PIC Pabrik</th><td class="nilai">' + isi(pic || po.pic) + '</td></tr>'
    + '<tr><th>Revisi Ke</th><td class="nilai">' + (po.rev_terakhir || 0) + (rev?.alasan ? ' — ' + esc(rev.alasan) : '') + '</td></tr>'
    + (po.catatan ? '<tr><th>Catatan</th><td class="nilai">' + esc(po.catatan) + '</td></tr>' : '')
    + '</table>';

  const isiHtml = kepala
    + '<h2>Data Teknis Acuan Pabrik</h2>'
    + (dt
      ? '<p style="font-size:9.5pt;margin:0 0 2mm">Data ini adalah salinan <strong>Final Survey terkunci</strong>'
        + (rev && rev.rev > 1 ? ' pada revisi ke-' + rev.rev : '') + '.</p>'
        + '<table>' + tabelDt(dt) + '</table>'
        + tabelLantai(dt.lantai as unknown as Lantai[])
        + tabelAddon(dt.addon as unknown as AddOn[])
      : '<div class="kotak">PO belum diterbitkan — data teknis acuan belum terkunci.</div>')
    + (revisi.length > 1
      ? '<h2>Catatan Revisi</h2><table><tr><td style="width:10%"><strong>Rev</strong></td>'
        + '<td style="width:20%"><strong>Tanggal</strong></td><td style="width:20%"><strong>Oleh</strong></td>'
        + '<td style="width:50%"><strong>Alasan / Perubahan</strong></td></tr>'
        + revisi.map(r => '<tr><td>' + r.rev + '</td><td>' + fmtTgl(r.tgl_revisi) + '</td><td>' + isi(r.oleh)
          + '</td><td>' + isi(r.alasan) + (r.jml_perubahan ? ' · ' + r.jml_perubahan + ' perubahan' : '') + '</td></tr>').join('')
        + '</table>'
      : '')
    + '<h2>Pengesahan</h2><div class="kolom2" style="margin-top:6mm">'
    + ['Dibuat — Operasional', 'Diperiksa — Manager', 'Disetujui — Direktur'].map(j =>
      '<div><div class="sigbox"></div><span class="sig-nm"> </span><div class="sig-jab">' + esc(j) + '</div></div>').join('')
    + '</div>';

  cetakHtml(
    bingkai('PO Pabrik', 'PO', po.no_po || '—', 'Pesanan ke Pabrik — ' + (po.nama_prospek || ''), isiHtml),
    'PO Pabrik',
  );
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
    'Kecepatan: ' + f('kecepatan') + '   SFD: ' + f('sfd'),
    'Ukuran shaft: ' + f('shaftSize') + '   Pit: ' + f('pitDepth') + '   Overhead: ' + f('overhead'),
    'Pintu: ' + f('tipePintu') + ' ' + f('bukaanPintu') + '   Sill: ' + f('sillPintu'),
    'Cabin: ' + f('cabinSize') + '   Bahan: ' + f('bahanCabin') + '   Finishing: ' + f('finishCabin'),
    'Daya mesin: ' + f('dayaMesin') + '   Power: ' + f('power'),
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
