// ============================================================
//  SPH DOCUMENT HTML GENERATOR
//  Diekstrak dari SPHForm.tsx agar bisa diimport dari mana saja
//  (termasuk SPHPreview untuk regenerate dari docstate)
// ============================================================
import {
  KatalogItem, TerminItem, DesainPilihan, DesainOption,
  ASET, DESAIN, DESAIN_LABEL, KEL_LABEL, HARI_ID,
} from './sph-types';
import {
  num, rupiah, ribu, terbilangRp, terbilang, capWords,
  parseDate, fmtID, noSuratSPH, noSuratSPK,
  totalKel, grandTotal, kelAktif,
} from './sph-utils';

// ── Interface matching SPHForm S state ───────────────────────
export interface GenState {
  noUrut: string; tanggal: string; kota: string; alamatKantor: string; formatNoSPK: 'standar' | 'lama';
  sapaan: string; namaCustomer: string; namaPerusahaan: string; nikCustomer: string; alamatCustomer: string; kotaProyek: string;
  jenisLift: string; tipeKabin: string; kapasitas: string; penumpang: string; kecepatan: string; mpm: string; sfd: string;
  tipeMesin: string; traksi: string; dayaMesin: string; power: string; pintu: string; bukaanPintu: string;
  tinggiKabin: string; shaftSize: string; cabinSize: string; pitDepth: string; namaLantai: string; baseFloor: string;
  ppn: 'exclude' | 'include'; masaBerlaku: string; freeMtn: string; garSpare: string; garMesin: string;
  waktuPengadaan: string; waktuInstalasi: string;
  tampilTtd: boolean; tampilDesain: boolean;
  sales: string; jabatanTtd: string; direktur: string; rekening: string;
}

export type ModeHarga = 'satuan' | 'lumpsum';
export type DocMode = 'SPH' | 'SPK';

// ── Helpers ──────────────────────────────────────────────────
function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[<>"]/g, c => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

// Inject decorative hexagon (bottom-right) inside every .page div
const HEX_IMG = '<img class="hex-bg" src="/hexagon-outline-bg.png" alt="" aria-hidden="true">';
function injectDeco(html: string): string {
  // Match opening tag of every .page div (with optional class additions) and inject img right after >
  return html.replace(/(<div class="page(?:[^"]*)"[^>]*>)/g, '$1' + HEX_IMG);
}

function tujuan(s: GenState): string {
  return (s.namaPerusahaan || ((s.sapaan === '—' ? '' : s.sapaan + ' ') + (s.namaCustomer || '…'))).trim();
}

function namaDesain(k: string, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const list = (liveDesain && liveDesain[k]?.length ? liveDesain[k] : DESAIN[k]) || [];
  const o = list.find(x => x.kode === pilihDesain[k as keyof DesainPilihan]);
  return o ? o.nama : '';
}

function kop(t: string, alamatKantor: string): string {
  return '<div class="lethead"><div class="doctype">' + t + '</div><div class="co">' +
'<img class="mark-logo" src="/logo.png" alt="Belift" style="height:10mm;width:auto;display:block;margin-left:auto">' +
    '<div class="ent">PT. BELIFT AMANAH INDONESIA</div>' +
    esc(alamatKantor).replace(/, /g, ',<br>') + '<br>info@belift.co.id</div></div>';
}

function ttdBlok(nama: string, jabatan: string, pakaiCap: boolean, tampilTtd: boolean): string {
  const img = ASET.ttd[nama] || '';
  const cap = (pakaiCap && ASET.capPerusahaan) ? '<img class="cap" src="' + ASET.capPerusahaan + '" alt="">' : '';
  const sig = img ? '<img class="ttd" src="' + img + '" alt="">' : '';
  return '<div class="sigbox">' + (tampilTtd ? cap + sig : '') + '</div>' +
    '<div class="sig-nm">' + esc(nama) + '</div><div>' + esc(jabatan) + '</div>';
}

function specRows(s: GenState, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const d: [string, string, boolean?][] = [
    ['Type', s.tipeMesin], ['Loading Capacity', s.kapasitas], ['Speed', s.kecepatan],
    ['Stops/Floors/Doors', s.sfd], ['Floor Name', s.namaLantai], ['Base Floor', s.baseFloor],
    ['Rate of Traction Machine', s.dayaMesin], ['Traction Ratio', s.traksi],
    ['Power Supply', s.power, true], ['Lighting Power', '220V 50HZ'],
    ['Shaft Size', s.shaftSize, true], ['Floor height', 'After Survey', true],
    ['Overhead', 'After Survey', true], ['Travelling Height', '(Custom)', true],
    ['Pit Depth', s.pitDepth, true], ['Door opening Type', s.pintu, true],
    ['Door opening Size', s.bukaanPintu, true], ['Cabin Size', s.cabinSize, true],
    ['Height of Cabin', s.tinggiKabin, true],
    ['Cabin decoration', namaDesain('cabin', pilihDesain, liveDesain) || 'As in pic'],
    ['Handrail', 'Yes'], ['Floor', namaDesain('floor', pilihDesain, liveDesain) || '—'],
    ['Ceiling', namaDesain('ceiling', pilihDesain, liveDesain) || 'As at Pict'],
    ['Door', namaDesain('door', pilihDesain, liveDesain) || 'As at Pict'],
    ['COP', namaDesain('cop', pilihDesain, liveDesain) || 'As at Pict'],
    ['LOP', namaDesain('lop', pilihDesain, liveDesain) || 'As at Pict'],
    ['Struktur', namaDesain('struktur', pilihDesain, liveDesain) || '—'],
    ['Language', 'English'], ['Brand', 'BELIFT'],
  ];
  return d.map((r, i) =>
    '<tr><td>' + String(i + 1).padStart(3, '0') + '</td><td>' + esc(r[0]) + '</td><td' + (r[2] ? ' class="hl"' : '') + '>' + esc(r[1]) + '</td></tr>'
  ).join('');
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

function desainDoc(s: GenState, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const dipilih = Object.keys(DESAIN_LABEL).filter(k => pilihDesain[k as keyof DesainPilihan]);
  if (!s.tampilDesain || !dipilih.length) return '';
  const cards = dipilih.map(k => {
    const src = (liveDesain && liveDesain[k]?.length ? liveDesain[k] : DESAIN[k]) || [];
    const o = src.find(x => x.kode === pilihDesain[k as keyof DesainPilihan]);
    if (!o) return '';
    return '<div class="dcard"><div class="box">' +
      (o.img ? '<img src="' + o.img + '" alt="' + esc(o.nama) + '" crossorigin="anonymous">' : '<div class="ph">Gambar ' + DESAIN_LABEL[k] + '<br>' + esc(o.kode) + '</div>') +
      '</div><div class="cap"><b>' + DESAIN_LABEL[k] + '</b>' + esc(o.nama) + '</div></div>';
  }).join('');
  return '<div class="page cont"><h3 class="secttl">Opsi Desain — ' + esc(s.tipeKabin) + '</h3>' +
    '<div class="dgrid">' + cards + '</div>' +
    '<p style="margin-top:6mm;font-size:9pt;font-style:italic">Gambar bersifat ilustrasi. Warna dan tekstur final ' +
    'mengikuti sampel material yang disetujui saat survey final.</p><div class="pgnum">·</div></div>';
}

// ── Main generators ─────────────────────────────────────────
export function pageSPH(s: GenState, items: KatalogItem[], termin: Record<string, TerminItem[]>, modeH: ModeHarga, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const d = parseDate(s.tanggal);
  const hariMap: Record<string, number> = { '2 Minggu': 14, '3 Minggu': 21, '1 Bulan': 31, '2 Bulan': 61 };
  const berlaku = new Date(d.getTime() + (hariMap[s.masaBerlaku] || 21) * 864e5);
  const adaSipil = totalKel(items, 'SIPIL', modeH) > 0;
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
    (adaSipil ? '<h4>3. Pekerjaan Sipil</h4><p>Pekerjaan sipil dikerjakan oleh PT Belift Amanah Indonesia berdasarkan SPK tersendiri.</p>' : '') +
    '<p><strong>*</strong> Semua Harga <strong>' + (s.ppn === 'exclude' ? 'Exclude' : 'Include') + '</strong> PPN 11%</p>' +
    '<h4>Waktu Pelaksanaan:</h4><p>Maksimal 3,5 Bulan sudah test commissioning sejak Kontrak ditanda tangani dan pembayaran pertama diterima.</p></div><div class="pgnum">1</div></div>' +

    '<div class="page cont"><h3 class="secttl">Rincian Harga Pekerjaan</h3>' + tabelHargaDoc(items, modeH) +
    '<div class="terbilang">' + terbilangRp(gt) + '</div>' +
    '<p style="font-size:9.5pt"><strong>*</strong> Harga <strong>' + (s.ppn === 'exclude' ? 'Exclude' : 'Include') +
    '</strong> PPN 11%. Baris bertanda <em>Include</em> sudah tercakup dalam harga item induknya.</p>' +
    '<div class="pgnum">2</div></div>' +

    desainDoc(s, pilihDesain, liveDesain) +

    '<div class="page cont"><table class="doc spec"><tr><th class="head" colspan="3">Elevator ' + esc(s.tipeKabin) +
    ' With Traction Description</th></tr>' + specRows(s, pilihDesain, liveDesain) + '</table><div class="pgnum">·</div></div>' +

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
    ttdBlok(s.sales, s.jabatanTtd, true, s.tampilTtd) + '</div></div><div class="pgnum">·</div></div>';
  return injectDeco(raw);
}

export function pageSPK(s: GenState, items: KatalogItem[], termin: Record<string, TerminItem[]>, modeH: ModeHarga, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const d = parseDate(s.tanggal);
  const hari = HARI_ID[d.getDay()];
  const gt = grandTotal(items, modeH);

  // Build termin paragraphs matching the reference doc style (per-termin detailed paragraph)
  function terminParagraphs(): string {
    const allTermin: { kel: string; idx: number; pct: number; nominal: number; syarat: string }[] = [];
    kelAktif(items).filter(k => totalKel(items, k, modeH) > 0).forEach(kel => {
      const dasar = totalKel(items, kel, modeH);
      (termin[kel] || []).forEach((t, i) => {
        allTermin.push({ kel, idx: i, pct: num(t.p), nominal: dasar * num(t.p) / 100, syarat: t.s });
      });
    });
    if (!allTermin.length) return '';
    const ordinal = ['Pertama', 'Kedua', 'Ketiga', 'Keempat', 'Kelima', 'Keenam', 'Ketujuh', 'Kedelapan', 'Kesembilan', 'Kesepuluh'];
    return allTermin.map((t, gi) =>
      '<p>Pembayaran ' + (ordinal[gi] || 'ke-' + (gi + 1)) + ' sebesar <strong>' + rupiah(t.nominal) + '</strong> atau ' +
      '<strong>' + t.pct + '% (' + capWords(terbilang(t.pct)) + ' Persen)</strong> dari nilai kontrak ' + esc(t.syarat) + '.</p>'
    ).join('');
  }

  // Pasal block: flowing content, no forced page break per pasal
  function P(n: number, t: string, b: string) {
    return '<div class="pasal-blk">' +
      '<p style="text-align:center;font-weight:700;text-decoration:underline;margin-bottom:1mm">PASAL&nbsp;&nbsp;' + n + '</p>' +
      '<p style="text-align:center;font-weight:700;margin-bottom:5mm">' + t + '</p>' +
      b +
      '</div>';
  }

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

    P(1, 'DEFINISI ISTILAH DAN KETENTUAN',
      '<p><strong>1. SPK (Surat Perintah Kerja)</strong></p>' +
      '<p>SPK adalah dokumen resmi yang menjadi dasar pelaksanaan pekerjaan antara Pemberi Kerja dan Pelaksana Pekerjaan yang memuat ruang lingkup pekerjaan, nilai kontrak, waktu pelaksanaan, serta syarat dan ketentuan pekerjaan.</p>' +
      '<p><strong>Ketentuan:</strong></p>' +
      '<ul class="ul"><li>SPK menjadi dasar hukum pelaksanaan proyek.</li>' +
      '<li>Semua pekerjaan yang dilakukan harus mengacu pada SPK beserta lampirannya.</li></ul>' +

      '<p><strong>2. MOS (Material On Site)</strong></p>' +
      '<p>MOS atau Material On Site adalah kondisi dimana material, komponen, atau peralatan yang akan digunakan dalam pekerjaan telah tiba dan tersimpan di lokasi proyek, namun belum dilakukan pemasangan.</p>' +
      '<p>Material yang termasuk dalam kategori MOS antara lain dapat berupa komponen utama lift, rel guide rail, mesin, panel kontrol, pintu lantai, cabin, serta material pendukung lainnya yang telah dikirim ke lokasi proyek.</p>' +
      '<p><strong>Ketentuan:</strong></p>' +
      '<ul class="ul"><li>Material yang dinyatakan sebagai MOS telah berada secara fisik di lokasi proyek dan dapat diverifikasi oleh Pemberi Kerja atau Pengawas Proyek.</li>' +
      '<li>Material harus dalam kondisi baik, lengkap, dan sesuai dengan spesifikasi yang tercantum dalam dokumen kontrak.</li>' +
      '<li>Material yang telah dinyatakan sebagai MOS dapat dijadikan dasar untuk perhitungan progres pekerjaan atau penagihan termin pembayaran sesuai ketentuan dalam kontrak.</li>' +
      '<li>Risiko kehilangan atau kerusakan material sebelum proses instalasi menjadi tanggung jawab Pelaksana Pekerjaan, kecuali ditentukan lain dalam perjanjian.</li>' +
      '<li>Pemberi Kerja berhak melakukan pemeriksaan terhadap material yang dinyatakan sebagai MOS untuk memastikan kesesuaian dengan spesifikasi proyek.</li></ul>' +

      '<p><strong>3. BAST (Berita Acara Serah Terima)</strong></p>' +
      '<p>BAST adalah dokumen resmi yang menyatakan bahwa pekerjaan telah selesai dilaksanakan dan diserahkan dari Pelaksana Pekerjaan kepada Pemberi Kerja.</p>' +
      '<p>Menandakan pekerjaan telah selesai secara substansial dan unit dapat dioperasikan serta menandakan seluruh kewajiban terselesaikan dan dimulainya perbaikan selama masa pemeliharaan.</p>' +
      '<p><strong>Ketentuan:</strong></p>' +
      '<ul class="ul"><li>BAST menjadi dasar dimulainya masa garansi.</li>' +
      '<li>Penandatanganan BAST dilakukan oleh kedua belah pihak.</li></ul>' +

      '<p><strong>4. Commissioning</strong></p>' +
      '<p>Commissioning adalah proses pengujian dan verifikasi sistem lift setelah instalasi selesai untuk memastikan bahwa seluruh komponen berfungsi sesuai spesifikasi teknis.</p>' +
      '<p><strong>Ketentuan:</strong></p>' +
      '<ul class="ul"><li>Commissioning meliputi pengujian fungsi, keselamatan, dan performa unit.</li>' +
      '<li>Commissioning dilakukan sebelum unit dinyatakan siap digunakan.</li></ul>' +

      '<p><strong>5. Handover</strong></p>' +
      '<p>Handover adalah proses penyerahan unit lift dari Pelaksana Pekerjaan kepada Pemberi Kerja setelah pekerjaan instalasi dan pengujian selesai.</p>' +
      '<p><strong>Ketentuan:</strong></p>' +
      '<ul class="ul"><li>Handover dilakukan setelah commissioning berhasil.</li>' +
      '<li>Handover dibuktikan dengan dokumen BAST.</li></ul>' +

      '<p><strong>6. Masa Garansi</strong></p>' +
      '<p>Masa Garansi adalah periode waktu setelah serah terima dimana Pelaksana Pekerjaan bertanggung jawab memperbaiki kerusakan yang disebabkan oleh kesalahan instalasi atau cacat material.</p>' +
      '<p><strong>Ketentuan:</strong></p>' +
      '<ul class="ul"><li>Masa garansi dimulai sejak tanggal BAST.</li>' +
      '<li>Perbaikan selama masa garansi tidak dikenakan biaya tambahan kepada Pemberi Kerja, kecuali kerusakan akibat kelalaian penggunaan.</li></ul>' +
      '<p><strong>Waktu Garansi:</strong></p>' +
      '<ul class="ul"><li>Free Maintenance <strong>' + esc(s.freeMtn) + '</strong></li>' +
      '<li>Garansi Spare Part <strong>' + esc(s.garSpare) + '</strong></li>' +
      '<li>Garansi Mesin/Motor <strong>' + esc(s.garMesin) + '</strong></li></ul>' +

      '<p><strong>7. Progress Pekerjaan</strong></p>' +
      '<p>Progress pekerjaan adalah tingkat penyelesaian pekerjaan berdasarkan tahapan pekerjaan yang telah dilaksanakan.</p>' +
      '<p><strong>Ketentuan:</strong></p>' +
      '<ul class="ul"><li>Progress pekerjaan menjadi dasar penagihan termin pembayaran.</li>' +
      '<li>Progress harus dapat diverifikasi oleh kedua belah pihak.</li></ul>') +

    P(2, 'LINGKUP PEKERJAAN',
      '<p>PIHAK PERTAMA memberi tugas kepada PIHAK KEDUA untuk mengerjakan pekerjaan sebagai berikut :</p>' +
      '<p><strong>Pengadaan Lift</strong></p>' +
      '<p>Pengadaan material ' + esc(s.tipeKabin) + ' ' + esc(s.kapasitas) + ' dan transportasi sampai di lokasi proyek ' +
      '1&nbsp;(satu) unit ' + esc(s.jenisLift) + '-' + esc(s.kapasitas) + ', ' + esc(s.penumpang) + ' – ' + esc(s.mpm) + ' – Floors/Stops/Doors ' + esc(s.sfd) + '.</p>' +
      '<p><strong>Lingkup Pekerjaan PIHAK PERTAMA</strong></p>' +
      '<p>Merupakan pekerjaan yang dilakukan oleh PIHAK PERTAMA untuk mempersiapkan dan menyediakan media pemasangan Elevator yang akan dikerjakan oleh PIHAK KEDUA, dalam hal ini melingkupi:</p>' +
      '<p><strong>A. Pekerjaan sipil ;</strong></p>' +
      '<ul class="ul"><li>Pekerjaan Arsitektural estetika diluar area pintu lift termasuk finishing celah lantai dengan pintu lift</li>' +
      '<li>Sirkulasi Udara Ruang Mesin (turbin/Heksos/lainnya) jika diinginkan.</li></ul>' +
      '<p><strong>B. Pengadaan Elektrikal/Kelistrikan</strong></p>' +
      '<ul class="ul"><li>Pengadaan Daya Listrik dan Instalasi Listrik Sub Panel di Dekat Control Panel Lift</li>' +
      '<li>Pemasangan grounding listrik khusus lift, terpisah dari penangkal petir</li></ul>' +
      '<p><strong>C. Pengadaan gudang peralatan Lift di Lokasi Proyek sesuai dengan Kapasitas Lift</strong></p>' +
      '<p><strong>D. Pembuatan pit</strong></p>' +
      '<p><strong>Lingkup Pekerjaan PIHAK KEDUA</strong></p>' +
      '<p>Merupakan pekerjaan utama pengadaan hingga pemasangan Elevator melingkupi ;</p>' +
      '<ul class="ul"><li>Produksi dan pengadaan elevator sesuai permintaan dan spesifikasi</li>' +
      '<li>Pemasangan Struktur Steel</li>' +
      '<li>Pengiriman elevator hingga sampai di Lokasi,</li>' +
      '<li>Instalasi dan pemasangan elevator sesuai standard dengan pekerjaan diluar lingkup pekerjaan PIHAK PERTAMA,</li>' +
      '<li>Pemeriksaan dan uji kelayakan, commissioning penggunaan lift</li>' +
      '<li>Serah terima pekerjaan melalui Berita Acara Serah Terima (BAST)</li>' +
      '<li>Free Maintenance setelah BAST di tanda tangani sesuai ketentuan</li></ul>') +

    P(3, 'LOKASI PEKERJAAN',
      '<p>Lokasi pekerjaan berada di <strong>' + esc(s.alamatCustomer || '…') + '</strong> yang disebut lokasi proyek yang akan dikerjakan oleh PIHAK KEDUA.</p>') +

    P(4, 'NILAI KONTRAK',
      '<p>Nilai pekerjaan yang telah disepakati oleh kedua belah pihak adalah : <strong>' + rupiah(gt) + '</strong> ,-</p>' +
      '<ul class="ul">' +
      kelAktif(items).filter(k => totalKel(items, k, modeH) > 0).map(k =>
        '<li>' + KEL_LABEL[k] + ' sebesar <strong>Rp. ' + ribu(totalKel(items, k, modeH)) + '</strong></li>'
      ).join('') + '</ul>' +
      '<p style="font-size:9.5pt">Harga ' + (s.ppn === 'exclude' ? 'belum' : 'sudah') + ' termasuk PPN 11%.</p>') +

    P(5, 'WAKTU PELAKSANAAN PEKERJAAN',
      '<p>Waktu pelaksanaan Pekerjaan :</p>' +
      '<ul class="ul"><li>Maksimal <strong>' + esc(s.waktuPengadaan) + '</strong> sejak kontrak telah ditanda tangani dan pembayaran pertama (DP) diterima untuk Material On site.</li>' +
      '<li>Maksimal <strong>' + esc(s.waktuInstalasi) + '</strong> sejak Material On Site dengan catatan tidak ada kendala bangunan dari PIHAK PERTAMA.</li></ul>') +

    P(6, 'PINALTY',
      '<p>Penalty akan dikenakan apabila keterlambatan terjadi karena kelalaian PIHAK KEDUA:</p>' +
      '<ul class="ul"><li>Apabila PIHAK KEDUA terlambat dalam menyelesaikan proses produksi dan pengiriman material ke lokasi proyek melebihi waktu maksimal 2,5 (dua setengah) bulan sejak pembayaran DP diterima, maka dikenakan pinalty sebesar <strong>0,05% / hari kerja (maksimal 1%)</strong> dari nilai pekerjaan pengadaan material unit elevator.</li>' +
      '<li>Apabila PIHAK KEDUA terlambat dalam menyelesaikan pekerjaan pemasangan lebih dari 30 hari sejak Material dinyatakan lengkap di lokasi dan lokasi dinyatakan siap oleh PIHAK PERTAMA akan dikenakan pinalty sebesar <strong>0,05% / hari kerja (maksimal 2%)</strong> dari nilai pekerjaan pemasangan unit elevator.</li>' +
      '<li>Pinalty pemasangan dan pengadaan material <strong>tidak berlaku</strong> apabila keterlambatan disebabkan oleh: gangguan pekerjaan sipil, keterlambatan pelunasan termin, akses kerja yang belum lengkap dan gangguan listrik di lokasi proyek.</li></ul>') +

    P(7, 'CARA PEMBAYARAN',
      '<p>Pembayaran akan dilakukan dengan cara :</p>' +
      terminParagraphs() +
      '<p>Pembayaran dapat ditransfer ke rekening:</p>' +
      '<p style="margin-left:8mm"><strong>PT. BELIFT AMANAH INDONESIA</strong><br>' +
      '<strong>' + esc(s.rekening) + '</strong></p>') +

    P(8, 'FORCE MAJURE',
      '<p>Force Majeure adalah keadaan di luar kemampuan para pihak yang menyebabkan pekerjaan tidak dapat dilaksanakan, seperti Bencana Alam, Gempa Bumi, Kebakaran, Kerusuhan, Kebijakan Pemerintah, Gangguan Distribusi Material Global, atau Meninggal Dunia salah satu pihak.</p>' +
      '<p>Pihak yang mengalami Force Majeure wajib memberitahukan secara tertulis kepada pihak lainnya paling lambat 7 (tujuh) hari kalender sejak terjadinya keadaan tersebut.</p>' +
      '<p>Selama keadaan Force Majeure berlangsung, kewajiban para pihak ditangguhkan sementara, waktu pelaksanaan pekerjaan diperpanjang sesuai lamanya keadaan tersebut, dan PIHAK KEDUA tidak dikenakan penalty keterlambatan.</p>' +
      '<p>Dalam hal salah satu pihak meninggal dunia, maka hak dan kewajiban berdasarkan SPK ini beralih kepada ahli waris yang sah sesuai ketentuan dalam SPK.</p>' +
      '<p>Apabila keadaan Force Majeure berlangsung lebih dari 90 (sembilan puluh) hari kalender dan pekerjaan tidak dapat dilanjutkan, maka para pihak atau ahli waris yang sah sepakat menyelesaikannya secara musyawarah.</p>') +

    P(9, 'PENYELESAIAN',
      '<p>Apabila terjadi sengketa, PIHAK PERTAMA dan PIHAK KEDUA sepakat menyelesaikan secara musyawarah. Apabila tidak tercapai kesepakatan, maka diselesaikan melalui Pengadilan NEGERI sesuai domisili hukum PIHAK KEDUA.</p>') +

    P(10, 'PENUTUP',
      '<p>Hal-hal yang belum tercantum dalam surat Perjanjian Kerja ini apabila diperlukan akan dibicarakan kemudian dan dituangkan dalam bentuk tertulis serta menjadi addendum yang tak terpisahkan dari perjanjian ini.</p>' +
      '<p>Demikian, Surat Perjanjian Kerja ini ditanda tangani oleh kedua belah pihak untuk dapat dilaksanakan dengan baik sebagaimana mestinya. Perjanjian ini dibuat dalam rangkap dua. Masing-masing dibubuhi materai secukupnya serta mempunyai kekuatan hukum yang sama.</p>' +
      '<div class="sign">' +
        '<div>PIHAK PERTAMA<div class="sigbox"></div>' +
        '<div class="sig-nm">' + esc(s.namaCustomer || '…') + '</div>' +
        '<div>' + esc(s.namaPerusahaan ? 'Pemilik / Penanggung Jawab' : 'Pemilik Bangunan') + '</div></div>' +
        '<div>PIHAK KEDUA<br><strong>PT BELIFT AMANAH INDONESIA</strong>' +
        ttdBlok(s.direktur, 'Direktur', true, s.tampilTtd) + '</div>' +
      '</div>') +

    '</div>' + // tutup .spk-body

    // ── Desain + Spesifikasi ──────────────────────────────────
    desainDoc(s, pilihDesain, liveDesain) +

    '<div class="page cont"><table class="doc spec"><tr><th class="head" colspan="3">Elevator ' + esc(s.tipeKabin) +
    ' With Traction Description</th></tr>' + specRows(s, pilihDesain, liveDesain) + '</table>' +
    '<p style="font-weight:700;margin-top:4mm">NOTES: Spesifikasi FINAL SETELAH SURVEY FINAL</p>' +
    '<div class="pgnum">·</div><div class="paraf">_______ Paraf _______</div></div>';
  return injectDeco(raw);
}
