// ============================================================
//  GENERATOR SPH & SPK — BELIFT
//  Split-panel: form (left) + live A4 preview (right)
// ============================================================
import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  KatalogItem, TerminItem, DesainPilihan, DesainOption,
  OPT, KEL_LABEL, SYARAT, TERMIN_AWAL, DESAIN, DESAIN_LABEL, ASET, HARI_ID,
  makeDefaultItems,
} from '@/lib/sph-types';
import { supabase } from '@/integrations/supabase/client';
import {
  num, rupiah, ribu, terbilangRp, terbilang, capWords, fmtID,
  parseDate, pad3, noSuratSPH, noSuratSPK,
  totalKel, grandTotal, kelAktif, sumTermin,
  saveDocument, generateId,
} from '@/lib/sph-utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────
type Mode = 'SPH' | 'SPK';
type ModeHarga = 'satuan' | 'lumpsum';

interface S {
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

const DEFAULT_S: S = {
  noUrut:'438', tanggal:new Date().toISOString().slice(0,10), kota:'Depok',
  alamatKantor:OPT.alamatKantor[1], formatNoSPK:'standar',
  sapaan:'Bapak', namaCustomer:'', namaPerusahaan:'', nikCustomer:'', alamatCustomer:'', kotaProyek:'Bandung',
  jenisLift:'Home Lift', tipeKabin:'Full Panoramic', kapasitas:'400 Kg', penumpang:'3-4 orang',
  kecepatan:'0,4 m/s', mpm:'24 mpm', sfd:'4/4/4', tipeMesin:'MRL Lift', traksi:'2:1', dayaMesin:'1,2 kw',
  power:'380V 50HZ (3 phase)', pintu:'Center Opening', bukaanPintu:'750 mm', tinggiKabin:'2200 mm',
  shaftSize:'2000 * 2000', cabinSize:'1200*1300 (Custom)', pitDepth:'(Custom)', namaLantai:'1.2.3.4', baseFloor:'1',
  ppn:'exclude', masaBerlaku:'3 Minggu', freeMtn:OPT.freeMtn[1], garSpare:OPT.garSpare[1], garMesin:OPT.garMesin[1],
  waktuPengadaan:'2 Bulan', waktuInstalasi:'1,5 Bulan',
  tampilTtd:true, tampilDesain:true,
  sales:'Imam Solikhin', jabatanTtd:'Sales', direktur:'Adhie Kurnia',
  rekening:'BANK BCA : 1662996330 - KCP Cimanggis, Depok',
};

// ── Helper: escape HTML ─────────────────────────────────────
function esc(s: unknown): string {
  return String(s == null ? '' : s).replace(/[<>"]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;'})[c]!);
}

// ── Helper: nomor surat ─────────────────────────────────────
function noSurat(mode: Mode, s: S): string {
  return mode === 'SPH' ? noSuratSPH(s.noUrut, s.tanggal) : noSuratSPK(s.noUrut, s.tanggal, s.formatNoSPK);
}

function namaFile(mode: Mode, s: S): string {
  const th = String(parseDate(s.tanggal).getFullYear()).slice(2);
  return pad3(s.noUrut)+th+'.'+mode+'_'+((s.namaPerusahaan||s.namaCustomer||'Customer').trim())+
    '_'+s.tipeKabin+'_'+s.kapasitas.replace(/\s/g,'')+'_'+s.kotaProyek;
}

function tujuan(s: S): string {
  return (s.namaPerusahaan || ((s.sapaan === '—' ? '' : s.sapaan + ' ') + (s.namaCustomer || '…'))).trim();
}

function namaDesain(k: string, pilihDesain: DesainPilihan, desain?: Record<string, DesainOption[]>): string {
  const list = (desain || DESAIN)[k] || [];
  const o = list.find(x => x.kode === pilihDesain[k as keyof DesainPilihan]);
  return o ? o.nama : '';
}

// ── Document generation helpers used locally ────────────────

function kop(t: string, alamatKantor: string): string {
  return '<div class="lethead"><div class="doctype">'+t+'</div><div class="co">' +
    '<div class="mark">B<i>ELIFT</i></div>' +
    '<div class="ent">PT. BELIFT AMANAH INDONESIA</div>' +
    esc(alamatKantor).replace(/, /g, ',<br>') + '<br>info@belift.co.id</div></div>';
}

function ttdBlok(nama: string, jabatan: string, pakaiCap: boolean, tampilTtd: boolean): string {
  const img = ASET.ttd[nama] || '';
  const cap = (pakaiCap && ASET.capPerusahaan) ? '<img class="cap" src="'+ASET.capPerusahaan+'" alt="">' : '';
  const sig = img ? '<img class="ttd" src="'+img+'" alt="">' : '';
  return '<div class="sigbox">'+(tampilTtd ? cap+sig : '')+'</div>' +
    '<div class="sig-nm">'+esc(nama)+'</div><div>'+esc(jabatan)+'</div>';
}

function specRows(s: S, pilihDesain: DesainPilihan, desain?: Record<string, DesainOption[]>): string {
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
    ['Cabin decoration', namaDesain('cabin', pilihDesain, desain) || 'As in pic'],
    ['Handrail', 'Yes'], ['Floor', namaDesain('floor', pilihDesain, desain) || '—'],
    ['Ceiling', namaDesain('ceiling', pilihDesain, desain) || 'As at Pict'],
    ['Door', namaDesain('door', pilihDesain, desain) || 'As at Pict'],
    ['COP', namaDesain('cop', pilihDesain, desain) || 'As at Pict'],
    ['LOP', namaDesain('lop', pilihDesain, desain) || 'As at Pict'],
    ['Struktur', namaDesain('struktur', pilihDesain, desain) || '—'],
    ['Language', 'English'], ['Brand', 'BELIFT'],
  ];
  return d.map((r, i) =>
    '<tr><td>'+String(i+1).padStart(3,'0')+'</td><td>'+esc(r[0])+'</td><td'+(r[2]?' class="hl"':'')+'>'+esc(r[1])+'</td></tr>'
  ).join('');
}

function tabelHargaDoc(items: KatalogItem[], mode: ModeHarga): string {
  const aktif = kelAktif(items);
  if (!aktif.length) return '';
  const q = mode === 'satuan';
  let rows = '', no = 0;
  aktif.forEach(kel => {
    rows += '<tr class="grp2"><td colspan="'+(q?6:5)+'">'+KEL_LABEL[kel]+'</td></tr>';
    items.filter(i => i.kel === kel && i.on).forEach(it => {
      const sub = it.par ? 'subrow' : '';
      if (it.inc) {
        rows += '<tr class="'+sub+'"><td class="c">'+(it.par?'':++no)+'</td><td>'+it.nama+'</td>' +
          (q?'<td class="c">'+it.qty+' '+it.sat+'</td>':'') + '<td class="inc" colspan="3">Include</td></tr>';
      } else {
        const tp = q ? num(it.hp)*num(it.qty) : num(it.hp);
        const ti = q ? num(it.hi)*num(it.qty) : num(it.hi);
        rows += '<tr class="'+sub+'"><td class="c">'+(it.par?'':++no)+'</td><td>'+it.nama+'</td>' +
          (q?'<td class="c">'+it.qty+' '+it.sat+'</td>':'') +
          '<td class="n">'+(tp?ribu(tp):'—')+'</td><td class="n">'+(ti?ribu(ti):'—')+'</td>' +
          '<td class="n">'+ribu(tp+ti)+'</td></tr>';
      }
    });
    rows += '<tr><td colspan="'+(q?5:4)+'" class="rt" style="font-weight:600">Sub Total '+
      KEL_LABEL[kel].split('· ')[1]+'</td><td class="n" style="font-weight:600">'+ribu(totalKel(items,kel,mode))+'</td></tr>';
  });
  return '<table class="doc"><thead><tr><th style="width:9mm">No</th><th>Item Pekerjaan</th>' +
    (q?'<th style="width:18mm">Qty</th>':'') +
    '<th style="width:26mm">Pengadaan (Rp)</th><th style="width:26mm">Pemasangan (Rp)</th>' +
    '<th style="width:28mm">Total (Rp)</th></tr></thead><tbody>'+rows +
    '<tr class="total"><td colspan="'+(q?5:4)+'" class="rt">TOTAL PRICE</td><td class="n">'+
    ribu(grandTotal(items,mode))+'</td></tr></tbody></table>';
}

function terminDoc(items: KatalogItem[], termin: Record<string,TerminItem[]>, mode: ModeHarga): string {
  return kelAktif(items).filter(k => totalKel(items,k,mode) > 0).map(kel => {
    const dasar = totalKel(items,kel,mode);
    return '<h4>'+KEL_LABEL[kel]+' — '+rupiah(dasar)+'</h4><ul class="ul">' +
      termin[kel].map((t,i) =>
        '<li>Angsuran ke-'+(i+1)+' : <strong>'+t.p+'%</strong> ('+rupiah(dasar*num(t.p)/100)+') '+t.s+'</li>'
      ).join('') + '</ul>';
  }).join('');
}

function desainDoc(s: S, pilihDesain: DesainPilihan, desain?: Record<string, DesainOption[]>): string {
  const src = desain || DESAIN;
  const dipilih = Object.keys(DESAIN_LABEL).filter(k => pilihDesain[k as keyof DesainPilihan]);
  if (!s.tampilDesain || !dipilih.length) return '';
  console.log('[desainDoc] pilihDesain:', JSON.stringify(pilihDesain));
  console.log('[desainDoc] src keys+items:', Object.keys(src).map(k => k+':'+src[k].map(o=>o.kode+'|'+(o.img||'').slice(0,40)).join(',')));
  const cards = dipilih.map(k => {
    const selectedKode = pilihDesain[k as keyof DesainPilihan];
    const o = (src[k]||[]).find(x => x.kode === selectedKode);
    console.log('[desainDoc] k='+k+' selectedKode='+selectedKode+' found='+!!o+' img='+o?.img?.slice(0,60));
    if (!o) return '';
    return '<div class="dcard"><div class="box">' +
      (o.img ? '<img src="'+o.img+'" alt="'+esc(o.nama)+'">' : '<div class="ph">Gambar '+DESAIN_LABEL[k]+'<br>'+esc(o.kode)+'</div>') +
      '</div><div class="cap"><b>'+DESAIN_LABEL[k]+'</b>'+esc(o.nama)+'</div></div>';
  }).join('');
  return '<div class="page cont"><h3 class="secttl">Opsi Desain — '+esc(s.tipeKabin)+'</h3>' +
    '<div class="dgrid">'+cards+'</div>' +
    '<p style="margin-top:6mm;font-size:9pt;font-style:italic">Gambar bersifat ilustrasi. Warna dan tekstur final '+
    'mengikuti sampel material yang disetujui saat survey final.</p><div class="pgnum">·</div></div>';
}

function pageSPH(s: S, items: KatalogItem[], termin: Record<string,TerminItem[]>, mode: ModeHarga, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const d = parseDate(s.tanggal);
  const hariMap: Record<string,number> = {'2 Minggu':14,'3 Minggu':21,'1 Bulan':31,'2 Bulan':61};
  const berlaku = new Date(d.getTime() + (hariMap[s.masaBerlaku]||21)*864e5);
  const adaSipil = totalKel(items,'SIPIL',mode) > 0;
  const gt = grandTotal(items, mode);
  return '' +
  '<div class="page">'+kop('INQUIRY', s.alamatKantor)+
    '<div class="docno">'+noSuratSPH(s.noUrut, s.tanggal)+'</div>'+
    '<div class="place">'+esc(s.kota)+', '+fmtID(d)+'</div>'+
    '<div class="to">Kepada Yth:<br><strong>'+esc(tujuan(s))+'</strong><br>di '+esc(s.kotaProyek)+'</div>'+
    '<div class="subject">Hal: Penawaran Harga Pengadaan &amp; Pemasangan 1 unit '+esc(s.tipeKabin)+' '+esc(s.jenisLift)+' di '+esc(s.kotaProyek)+'</div>'+
    '<div class="body ind"><p>Dengan hormat,<br>Berdasarkan data yang kami terima, bersama ini kami sampaikan '+
    'penawaran harga pekerjaan (pengadaan &amp; pemasangan Elevator merk <strong>BELIFT</strong>) untuk proyek '+
    'tersebut di atas dengan ruang lingkup sebagai berikut:</p>'+
    '<h4>1. Pengadaan '+esc(s.jenisLift)+'</h4><p>Harga pengadaan material Elevator dan transportasi sampai di '+
    'lokasi proyek 1 (satu) unit <strong>Lift Elevator-'+esc(s.kapasitas)+'</strong> / '+esc(s.penumpang)+
    ' – '+esc(s.mpm)+' – Floors/Stops/Doors '+esc(s.sfd)+'.</p>'+
    '<h4>2. Pemasangan</h4><p>Biaya pemasangan termasuk Mobilisasi, Test-Commissioning, Mob-demobilisasi, '+
    '<strong>Free Maintenance '+esc(s.freeMtn)+', Garansi Spare Part '+esc(s.garSpare)+', Garansi Mesin '+esc(s.garMesin)+'</strong>.</p>'+
    (adaSipil?'<h4>3. Pekerjaan Sipil</h4><p>Pekerjaan sipil dikerjakan oleh PT Belift Amanah Indonesia berdasarkan '+
    'SPK tersendiri.</p>':'')+
    '<p><strong>*</strong> Semua Harga <strong>'+(s.ppn==='exclude'?'Exclude':'Include')+'</strong> PPN 11%</p>'+
    '<h4>Waktu Pelaksanaan:</h4><p>Maksimal 3,5 Bulan sudah test commissioning sejak Kontrak ditanda tangani dan '+
    'pembayaran pertama diterima.</p></div><div class="pgnum">1</div></div>'+

  '<div class="page cont"><h3 class="secttl">Rincian Harga Pekerjaan</h3>'+tabelHargaDoc(items,mode)+
    '<div class="terbilang">'+terbilangRp(gt)+'</div>'+
    '<p style="font-size:9.5pt"><strong>*</strong> Harga <strong>'+(s.ppn==='exclude'?'Exclude':'Include')+
    '</strong> PPN 11%. Baris bertanda <em>Include</em> sudah tercakup dalam harga item induknya.</p>'+
    '<div class="pgnum">2</div></div>'+

  desainDoc(s, pilihDesain, liveDesain)+

  '<div class="page cont"><table class="doc spec"><tr><th class="head" colspan="3">Elevator '+esc(s.tipeKabin)+
    ' With Traction Description</th></tr>'+specRows(s,pilihDesain,liveDesain)+'</table><div class="pgnum">·</div></div>'+

  '<div class="page cont"><p style="font-weight:700;text-decoration:underline;margin-bottom:5mm">Syarat dan Kondisi Penawaran :</p>'+
    '<ol class="ol">'+
    '<li>Penawaran berlaku sampai dengan <strong>'+fmtID(berlaku)+'</strong> ('+esc(s.masaBerlaku)+').</li>'+
    (adaSipil
      ?'<li><strong>Termasuk</strong> pekerjaan sipil sesuai rincian.</li>'
      :'<li><strong>Tidak termasuk</strong> dalam penawaran yaitu, <strong>Struktur dan pekerjaan sipil</strong>, '+
       'instalasi dan daya listrik ke ruang mesin elevator.</li>')+
    '<li><strong>Masa pemeliharaan cuma-cuma berlaku selama '+esc(s.freeMtn)+' sejak Serah Terima Pekerjaan.</strong></li>'+
    '<li><strong>Garansi peralatan dan pemasangan berlaku '+esc(s.garSpare)+' sejak Serah Terima Pekerjaan</strong>.</li>'+
    '<li><strong>Garansi Motor Mesin berlaku '+esc(s.garMesin)+' sejak Serah Terima Pekerjaan.</strong></li>'+
    '<li>Cara pembayaran:'+terminDoc(items,termin,mode)+'</li></ol>'+
    '<p>Demikian penawaran ini kami sampaikan, atas perhatian dan kerjasamanya kami ucapkan terima kasih.</p>'+
    '<div style="display:flex;justify-content:flex-end;margin-top:8mm"><div style="width:74mm;text-align:center">'+
    '<div style="font-family:\'Barlow Condensed\';font-size:24pt;font-weight:700;color:#592203">B<span style="color:#D95103">ELIFT</span></div>'+
    ttdBlok(s.sales, s.jabatanTtd, true, s.tampilTtd)+'</div></div><div class="pgnum">·</div></div>';
}

function pageSPK(s: S, items: KatalogItem[], termin: Record<string,TerminItem[]>, mode: ModeHarga, pilihDesain: DesainPilihan, liveDesain?: Record<string, DesainOption[]>): string {
  const d = parseDate(s.tanggal);
  const hari = HARI_ID[d.getDay()];
  const adaSipil = totalKel(items,'SIPIL',mode) > 0;
  const gt = grandTotal(items, mode);

  function P(n: number, t: string, b: string) {
    return '<div class="page cont"><p style="text-align:center;font-weight:700;text-decoration:underline;margin-bottom:1mm">PASAL '+n+
      '</p><p style="text-align:center;font-weight:700;margin-bottom:5mm">'+t+'</p>'+b+
      '<div class="pgnum">'+(n+1)+'</div><div class="paraf">_______ Paraf _______</div></div>';
  }

  return '' +
  '<div class="page">'+kop('CONTRACT', s.alamatKantor)+'<div class="docno">'+noSuratSPK(s.noUrut,s.tanggal,s.formatNoSPK)+'</div>'+
    '<p>Pada hari ini, <strong>'+hari+'</strong> tanggal <strong>'+capWords(terbilang(d.getDate()))+'</strong> bulan '+
    '<strong>'+fmtID(d).split(' ')[1]+'</strong> tahun <strong>'+capWords(terbilang(d.getFullYear()))+'</strong>, kami yang bertanda tangan dibawah ini:</p>'+
    '<table style="margin:4mm 0 4mm 10mm"><tr><td style="width:24mm;vertical-align:top">Nama</td><td>: <strong>'+esc(s.namaCustomer||'…')+'</strong></td></tr>'+
    '<tr><td>NIK</td><td>: '+esc(s.nikCustomer||'…')+'</td></tr>'+
    '<tr><td style="vertical-align:top">Alamat</td><td>: '+esc(s.alamatCustomer||'…')+'</td></tr></table>'+
    '<p>Dalam hal ini bertindak untuk dan atas nama <strong>'+esc(s.namaPerusahaan||s.namaCustomer||'…')+'</strong> '+
    'untuk selanjutnya disebut <strong>PIHAK PERTAMA</strong></p>'+
    '<table style="margin:4mm 0 4mm 10mm"><tr><td style="width:24mm;vertical-align:top">Nama</td><td>: <strong>'+esc(s.direktur)+'</strong></td></tr>'+
    '<tr><td>Jabatan</td><td>: Direktur PT Belift Amanah Indonesia</td></tr>'+
    '<tr><td style="vertical-align:top">Alamat</td><td>: '+esc(s.alamatKantor)+'</td></tr></table>'+
    '<p>Dalam hal ini bertindak untuk dan atas nama <strong>PT. Belift Amanah Indonesia</strong> untuk selanjutnya '+
    'disebut sebagai <strong>PIHAK KEDUA</strong></p>'+
    '<p>Selanjutnya kedua belah pihak mengadakan Surat Perjanjian Kerja sebagai berikut:</p>'+
    '<div class="pgnum">1</div><div class="paraf">_______ Paraf _______</div></div>'+

  P(1,'DEFINISI ISTILAH DAN KETENTUAN',
    '<p><strong>1. SPK</strong> — dokumen resmi dasar pelaksanaan pekerjaan.</p>'+
    '<p><strong>2. MOS (Material On Site)</strong> — material telah tiba dan tersimpan di lokasi proyek.</p>'+
    '<p><strong>3. BAST</strong> — dokumen resmi serah terima pekerjaan; dasar dimulainya masa garansi.</p>'+
    '<p><strong>4. Commissioning</strong> — pengujian dan verifikasi fungsi, keselamatan, dan performa unit.</p>'+
    '<p><strong>5. Masa Garansi</strong> — Free Maintenance '+esc(s.freeMtn)+' · Garansi Spare Part '+esc(s.garSpare)+
    ' · Garansi Mesin/Motor '+esc(s.garMesin)+', dihitung sejak tanggal BAST.</p>')+

  P(2,'LINGKUP PEKERJAAN',
    '<p>PIHAK PERTAMA memberi tugas kepada PIHAK KEDUA untuk mengerjakan pekerjaan dengan rincian sebagai berikut:</p>'+
    tabelHargaDoc(items,mode)+
    (adaSipil?'':'<p><strong>Di luar lingkup PIHAK KEDUA:</strong> pekerjaan sipil, instalasi daya listrik, grounding, dan pembuatan pit.</p>'))+

  P(3,'LOKASI PEKERJAAN','<p>Lokasi pekerjaan berada di '+esc(s.alamatCustomer||'…')+'.</p>')+

  P(4,'NILAI KONTRAK',
    '<p>Nilai pekerjaan yang disepakati adalah <strong>'+rupiah(gt)+'</strong>,- ('+terbilangRp(gt)+') dengan rincian:</p><ul class="ul">'+
    kelAktif(items).filter(k=>totalKel(items,k,mode)>0).map(k=>
      '<li>'+KEL_LABEL[k]+' sebesar <strong>'+rupiah(totalKel(items,k,mode))+'</strong></li>'
    ).join('')+'</ul><p style="font-size:9.5pt">Harga '+(s.ppn==='exclude'?'belum':'sudah')+' termasuk PPN 11%.</p>')+

  P(5,'WAKTU PELAKSANAAN',
    '<ul class="ul"><li>Maksimal <strong>'+esc(s.waktuPengadaan)+'</strong> sejak kontrak ditandatangani untuk Material On Site.</li>'+
    '<li>Maksimal <strong>'+esc(s.waktuInstalasi)+'</strong> sejak Material On Site.</li></ul>')+

  P(6,'PINALTY',
    '<ol class="ol"><li>Keterlambatan produksi melebihi 2,5 bulan: penalty <strong>0,05% per hari kerja (maks 1%)</strong>.</li>'+
    '<li>Keterlambatan pemasangan lebih dari 30 hari: penalty <strong>0,05% per hari kerja (maks 2%)</strong>.</li>'+
    '<li>Penalty tidak berlaku jika keterlambatan karena gangguan sipil, keterlambatan termin, atau gangguan listrik.</li></ol>')+

  P(7,'CARA PEMBAYARAN',
    '<p>Pembayaran dilakukan terpisah untuk setiap lingkup pekerjaan:</p>'+terminDoc(items,termin,mode)+
    '<p>Transfer ke rekening:</p><p style="margin-left:8mm"><strong>PT. BELIFT AMANAH INDONESIA</strong><br>'+
    '<strong>'+esc(s.rekening)+'</strong></p>')+

  P(8,'FORCE MAJEURE',
    '<p>Force Majeure adalah keadaan di luar kemampuan para pihak seperti bencana alam, kebakaran, kerusuhan, kebijakan pemerintah. '+
    'Pihak yang mengalami wajib memberitahu tertulis dalam 7 hari kalender.</p>')+

  P(9,'PENYELESAIAN',
    '<p>Sengketa diselesaikan secara musyawarah. Jika tidak tercapai, diselesaikan melalui Pengadilan Negeri sesuai domisili PIHAK KEDUA.</p>')+

  P(10,'PENUTUP',
    '<p>Hal-hal yang belum tercantum akan dibicarakan kemudian sebagai addendum perjanjian ini.</p>'+
    '<div class="sign"><div>PIHAK PERTAMA<div class="sigbox"></div><div class="sig-nm">'+esc(s.namaCustomer||'…')+'</div>Pemilik Bangunan</div>'+
    '<div>PIHAK KEDUA<br><strong>PT BELIFT AMANAH INDONESIA</strong>'+
    ttdBlok(s.direktur,'Direktur',true,s.tampilTtd)+'</div></div>')+

  desainDoc(s, pilihDesain, liveDesain)+

  '<div class="page cont"><table class="doc spec"><tr><th class="head" colspan="3">Elevator '+esc(s.tipeKabin)+
    ' With Traction Description</th></tr>'+specRows(s,pilihDesain,liveDesain)+'</table>'+
    '<p style="font-weight:700;margin-top:4mm">NOTES: Spesifikasi FINAL SETELAH SURVEY FINAL</p>'+
    '<div class="pgnum">·</div><div class="paraf">_______ Paraf _______</div></div>';
}

// ── Print helper ────────────────────────────────────────────
function printDocument(html: string, tipeKabin: string) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { window.alert('Pop-up diblokir. Izinkan pop-up untuk mencetak.'); return; }
  win.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Belift — ${tipeKabin}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;500;600;700&family=Barlow+Semi+Condensed:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--orange:#D95103;--burnt:#A63F04;--brown:#592203;--ink:#2B1B10;--paper:#fff;--shell:#F0EDE9;--line:#DFD8D1;--muted:#7A6E66;--ok:#1E6B3A;--warn:#B8860B;--bad:#9C0006;--sub:#8A7A6E}
*{box-sizing:border-box}html,body{margin:0;padding:0}
body{font-family:'Barlow',system-ui,sans-serif;background:#fff;color:#2B1B10;font-size:14px}
@page{size:A4;margin:0}
.page{width:210mm;min-height:297mm;background:#fff;padding:18mm 17mm 16mm;position:relative;overflow:hidden;font-size:10.5pt;line-height:1.5;font-family:'Barlow',sans-serif;page-break-after:always;break-after:page}
.page:last-child{page-break-after:auto;break-after:auto}
.page.cont{padding-top:22mm}
.page::before{content:"";position:absolute;left:0;top:0;width:34mm;height:24mm;background:#D95103;border-bottom-right-radius:9mm}
.page::after{content:"";position:absolute;left:6mm;top:0;width:26mm;height:20mm;border:.7pt solid #fff;border-top:0;border-bottom-right-radius:8mm}
.pgnum{position:absolute;left:17mm;bottom:9mm;font-size:9pt;color:#7A6E66}
.paraf{position:absolute;right:17mm;bottom:9mm;font-size:8pt;color:#7A6E66}
.lethead{display:flex;justify-content:space-between;align-items:flex-start;margin-left:36mm;gap:10mm}
.doctype{font-family:'Barlow Condensed',sans-serif;font-size:34pt;color:#A63F04;letter-spacing:.02em;line-height:1;margin-top:14mm}
.co{text-align:right;font-size:8.5pt;color:#4A3A2E;line-height:1.45;margin-top:2mm}
.co .mark{font-family:'Barlow Condensed',sans-serif;font-size:26pt;font-weight:700;color:#592203}
.co .mark i{font-style:normal;color:#D95103}
.co .ent{font-size:11pt;color:#A63F04;font-weight:500;margin-bottom:1mm}
.docno{text-align:center;font-family:'Barlow Condensed',sans-serif;font-size:19pt;font-weight:600;color:#D95103;letter-spacing:.08em;margin:9mm 0 6mm}
.place{text-align:right;font-size:10pt;margin-bottom:5mm}
.to{margin-bottom:6mm}
.subject{font-weight:700;margin:0 0 4mm 8mm}
.body p{margin:0 0 3.4mm}.body h4{font-size:10.5pt;margin:5mm 0 1.6mm;font-weight:700}
.ind{margin-left:8mm}
.secttl{font-family:'Barlow Condensed',sans-serif;font-size:17pt;font-weight:500;margin:0 0 4mm}
table.doc{width:100%;border-collapse:collapse;font-size:9pt;margin:3mm 0}
table.doc th,table.doc td{border:.6pt solid #4A3A2E;padding:1.8mm 2.2mm;vertical-align:middle}
table.doc th{font-weight:600;text-align:center}
table.doc td.n{text-align:right;white-space:nowrap}
table.doc td.c{text-align:center}
tr.grp2 td{background:#F5F1ED;font-weight:700;font-family:'Barlow Condensed',sans-serif;letter-spacing:.06em;text-transform:uppercase;font-size:9.5pt}
tr.subrow td:nth-child(2){padding-left:6mm;font-style:italic;color:#5A4A3E}
tr.subrow td:nth-child(2)::before{content:"↳ "}
.inc{text-align:center;font-style:italic;color:#5A4A3E}
.spec th.head{background:#D95103;color:#fff;font-family:'Barlow Condensed',sans-serif;font-size:12pt;letter-spacing:.05em;text-transform:uppercase}
.spec td:first-child{text-align:center;width:16mm}
.spec td:nth-child(2){width:62mm}
.hl{color:#C0392B}
.total td{font-weight:700;background:#FBE9DF}
.terbilang{font-weight:700;margin-top:3mm}
.ol{margin:0;padding-left:6mm}.ol li{margin-bottom:2.6mm}
.ul{margin:1mm 0 3mm;padding-left:6mm}.ul li{margin-bottom:1.4mm}
.dgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm 5mm;margin-top:5mm}
.dcard{text-align:center}
.dcard .box{height:44mm;border:.6pt solid #DFD8D1;border-radius:2mm;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#FBF9F7}
.dcard .box img{max-width:100%;max-height:100%;object-fit:contain}
.dcard .box .ph{font-size:8pt;color:#B5AAA1;padding:4mm;line-height:1.4}
.dcard .cap{font-size:8.5pt;margin-top:1.5mm;font-style:italic}
.dcard .cap b{font-style:normal;display:block;font-size:9pt}
.sign{display:flex;justify-content:space-between;margin-top:10mm;text-align:center;font-size:10pt}
.sign>div{width:74mm}
.sigbox{position:relative;height:30mm;margin-top:2mm}
.sigbox img.cap{position:absolute;left:50%;top:50%;transform:translate(-58%,-50%) rotate(-8deg);height:26mm;opacity:.85}
.sigbox img.ttd{position:absolute;left:50%;top:50%;transform:translate(-42%,-50%);height:20mm}
.sig-nm{font-weight:700;border-top:.6pt solid #2B1B10;padding-top:1.5mm;display:inline-block;min-width:52mm}
.rt{text-align:right}
h4{font-size:10.5pt;margin:5mm 0 1.6mm;font-weight:700}
</style>
</head>
<body>${html}</body>
</html>`);
  win.document.close();
  win.onload = () => { win.focus(); win.print(); };
}

// ── Build design options purely from DB master data ──────────
// DB category values: 'Cabin', 'Floor', 'Ceiling', 'Door', 'COP', 'LOP', 'Struktur', 'Add On'
// DESAIN key values:  'cabin', 'floor', 'ceiling', 'door', 'cop', 'lop', 'struktur', 'addon'
const CAT_MAP: Record<string, string> = {
  'cabin':'cabin','floor':'floor','ceiling':'ceiling','door':'door',
  'cop':'cop','lop':'lop','struktur':'struktur','add on':'addon','addon':'addon',
};

// UUID regex — used to detect fallback IDs so we don't show them as SKU labels
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mergeDesainFromDB(dbRows: any[]): Record<string, DesainOption[]> {
  // Build map keyed by DESAIN category — filled exclusively from DB rows.
  // Categories with no DB rows stay as empty arrays (no static placeholders).
  // We store the raw SKU in the `kode` field and also build a display label
  // that includes the SKU so users can distinguish items with similar names.
  const result: Record<string, DesainOption[]> = {};
  Object.keys(DESAIN).forEach(k => { result[k] = []; });

  dbRows.forEach(row => {
    const rawCat = (row.category || '').toLowerCase().trim();
    const cat = CAT_MAP[rawCat];
    if (!cat) return; // unknown category — skip

    const img = row.image_url || '';
    const sku = (row.sku || '').trim();
    const kode = sku || row.id; // fallback to id if no sku
    const nama = row.name || kode; // clean name for printing
    // Show "Nama [SKU]" in dropdown only when SKU exists and isn't a UUID fallback
    const label = sku && !UUID_RE.test(sku) ? `${nama} [${sku}]` : nama;

    if (!result[cat]) result[cat] = [];
    // Avoid duplicate kode
    if (!result[cat].find(o => o.kode === kode)) {
      result[cat].push({ kode, nama, label, img });
    }
  });
  return result;
}

// ── Main Component ──────────────────────────────────────────
export default function SPHForm({ defaultMode }: { defaultMode?: Mode }) {
  const navigate = useNavigate();
  const { signOut, fullName, user } = useAuth();
  const [mode, setMode] = useState<Mode>(defaultMode || 'SPH');
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [s, setS] = useState<S>(DEFAULT_S);
  const [modeHarga, setModeHarga] = useState<ModeHarga>('satuan');
  const [items, setItems] = useState<KatalogItem[]>(makeDefaultItems());
  const [termin, setTermin] = useState<Record<string, TerminItem[]>>(JSON.parse(JSON.stringify(TERMIN_AWAL)));
  const [tabTermin, setTabTermin] = useState<string>('PENGADAAN');
  // Start empty — will be populated from DB. No static placeholder pre-selection.
  const [pilihDesain, setPilihDesain] = useState<DesainPilihan>({
    cabin: '', floor: '', ceiling: '', door: '', cop: '', lop: '', struktur: '', addon: '',
  });
  // Design items from Supabase — starts empty, filled after fetch
  const [liveDesain, setLiveDesain] = useState<Record<string, DesainOption[]>>(
    Object.fromEntries(Object.keys(DESAIN).map(k => [k, []])) as Record<string, DesainOption[]>
  );
  const upd = useCallback((k: keyof S, v: unknown) => setS(prev => ({ ...prev, [k]: v })), []);

  // Fetch design_items from Supabase — re-run when user is available (RLS requires auth)
  useEffect(() => {
    if (!user) return; // wait for auth session
    (supabase as any).from('design_items').select('*').then(({ data, error }: { data: any; error: any }) => {
      if (error) { console.error('[SPHForm] design_items fetch error:', error); return; }
      if (!data || data.length === 0) { console.warn('[SPHForm] design_items: no rows returned (RLS or empty table)'); return; }
      console.log('[SPHForm] design_items raw:', data);
      const fromDB = mergeDesainFromDB(data);
      console.log('[SPHForm] liveDesain from DB:', JSON.stringify(fromDB, null, 2));
      setLiveDesain(fromDB);
      // Auto-select first item per category so the design page renders immediately
      setPilihDesain(prev => {
        const next = { ...prev };
        (Object.keys(fromDB) as (keyof DesainPilihan)[]).forEach(k => {
          if (!next[k] && fromDB[k]?.[0]) next[k] = fromDB[k][0].kode;
        });
        return next;
      });
    });
  }, [user]);

  function setItemField(idx: number, k: keyof KatalogItem, v: unknown) {
    setItems(prev => {
      const next = prev.map((it, i) => i === idx ? { ...it, [k]: (k==='on'||k==='inc') ? v : num(v as unknown) } : it);
      if (k === 'inc' && v) { next[idx].hp = 0; next[idx].hi = 0; }
      if (k === 'on' && !prev[idx].par) {
        const pid = prev[idx].id;
        next.forEach(x => { if (x.par === pid) x.on = v as boolean; });
      }
      return next;
    });
  }

  function setT(kel: string, i: number, k: 'p'|'s', v: unknown) {
    setTermin(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[kel][i][k] = k === 'p' ? num(v) : v;
      return next;
    });
  }
  function addT(kel: string) { setTermin(prev => { const n = JSON.parse(JSON.stringify(prev)); n[kel].push({p:0,s:SYARAT[kel][0]}); return n; }); }
  function delT(kel: string, i: number) { setTermin(prev => { const n = JSON.parse(JSON.stringify(prev)); if(n[kel].length>1) n[kel].splice(i,1); return n; }); }

  function isiCepat() {
    const v = window.prompt('Nilai kontrak pengadaan + pemasangan (Rp):', '425000000');
    if (v === null) return;
    const t = num(String(v).replace(/\D/g,'')), p = Math.round(t * 0.87);
    setItems(prev => prev.map(it => {
      if (it.id === 'P1') return { ...it, hp:p, hi:0, inc:false, on:true };
      if (it.id === 'I1') return { ...it, hp:0, hi:t-p, inc:false, on:true };
      return it;
    }));
  }

  const gt = grandTotal(items, modeHarga);
  const aktif = kelAktif(items);

  // Fix tabTermin if needed
  const safeTab = aktif.includes(tabTermin) ? tabTermin : (aktif[0] || 'PENGADAAN');

  const [docId] = useState(() => generateId());
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!user) { toast.error('Login diperlukan untuk menyimpan'); return; }
    setSaving(true);
    // Generate the full A4 HTML so SPHPreview can render it directly
    const renderedHtml = mode === 'SPH'
      ? pageSPH(s, items, termin, modeHarga, pilihDesain, liveDesain)
      : pageSPK(s, items, termin, modeHarga, pilihDesain, liveDesain);
    const ok = await saveDocument({
      id: docId,
      mode,
      noUrut: s.noUrut,
      tanggal: s.tanggal,
      namaCustomer: s.namaCustomer,
      namaPerusahaan: s.namaPerusahaan,
      kotaProyek: s.kotaProyek,
      jenisLift: s.jenisLift,
      tipeKabin: s.tipeKabin,
      kapasitas: s.kapasitas,
      ppn: s.ppn,
      modeHarga,
      sales: s.sales,
      status: 'draft',
      // full state for re-editing
      state: s,
      items,
      termin,
      pilihDesain,
      // rendered HTML for fast preview
      renderedHtml,
    }, user.id);
    setSaving(false);
    if (ok) toast.success('Dokumen berhasil disimpan');
    else toast.error('Gagal menyimpan dokumen');
  }

  function handlePrint() {
    const html = mode === 'SPH'
      ? pageSPH(s, items, termin, modeHarga, pilihDesain, liveDesain)
      : pageSPK(s, items, termin, modeHarga, pilihDesain, liveDesain);
    printDocument(html, s.tipeKabin);
  }

  return (
    <div style={{display:'flex', flexDirection:'column', height:'100svh', overflow:'hidden'}}>
      {/* TOP BAR */}
      <TopBar mode={mode} setMode={setMode}
        fullName={fullName} onBack={() => navigate('/')} onSignOut={signOut}
        onPrint={handlePrint} onSave={handleSave} saving={saving}
        mobileTab={mobileTab} setMobileTab={setMobileTab} />

      {/* SPLIT LAYOUT — desktop: side-by-side | mobile: tab-switched single panel */}
      <div className="gen-layout" style={{flex:1, overflow:'hidden', display:'grid', gridTemplateColumns:'430px 1fr'}}>
        <FormPanel
          mode={mode} s={s} upd={upd} items={items} setItemField={setItemField}
          modeHarga={modeHarga} setModeHarga={setModeHarga} isiCepat={isiCepat}
          termin={termin} tabTermin={safeTab} setTabTermin={setTabTermin}
          addT={addT} delT={delT} setT={setT}
          pilihDesain={pilihDesain} setPilihDesain={setPilihDesain}
          noSuratStr={noSurat(mode,s)} namaFileStr={namaFile(mode,s)}
          totalKelFn={(k) => totalKel(items,k,modeHarga)} gt={gt}
          liveDesain={liveDesain}
          mobileVisible={mobileTab === 'form'}
        />
        <PreviewPanel mode={mode} s={s} items={items} termin={termin}
          modeHarga={modeHarga} pilihDesain={pilihDesain} liveDesain={liveDesain}
          mobileVisible={mobileTab === 'preview'} />
      </div>
    </div>
  );
}

// ── Form Panel ──────────────────────────────────────────────
interface FormPanelProps {
  mode: Mode; s: S; upd: (k: keyof S, v: unknown) => void;
  items: KatalogItem[]; setItemField: (i: number, k: keyof KatalogItem, v: unknown) => void;
  modeHarga: ModeHarga; setModeHarga: (m: ModeHarga) => void; isiCepat: () => void;
  termin: Record<string, TerminItem[]>; tabTermin: string; setTabTermin: (t: string) => void;
  addT: (k: string) => void; delT: (k: string, i: number) => void; setT: (k: string, i: number, f: 'p'|'s', v: unknown) => void;
  pilihDesain: DesainPilihan; setPilihDesain: (d: DesainPilihan) => void;
  noSuratStr: string; namaFileStr: string; totalKelFn: (k: string) => number; gt: number;
  liveDesain: Record<string, DesainOption[]>;
  mobileVisible: boolean;
}

function Grp({ title, open, children }: { title: string; open?: boolean; children: React.ReactNode }) {
  return (
    <details className="grp-sec" open={open}>
      <summary className="grp-sum">{title}</summary>
      <div className="grp-fields">{children}</div>
    </details>
  );
}

function Fsel({ label, value, options, onChange, hint }: { label: string; value: string; options: string[]; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="f-item">
      <label className="f-label">{label}</label>
      <select className="f-ctrl" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
      {hint && <div className="f-hint">{hint}</div>}
    </div>
  );
}

function Ftxt({ label, value, type, onChange, hint }: { label: string; value: string; type?: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="f-item">
      <label className="f-label">{label}</label>
      <input className="f-ctrl" type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} />
      {hint && <div className="f-hint">{hint}</div>}
    </div>
  );
}

function FormPanel(props: FormPanelProps) {
  const { mode, s, upd, items, setItemField, modeHarga, setModeHarga, isiCepat,
    termin, tabTermin, setTabTermin, addT, delT, setT,
    pilihDesain, setPilihDesain, noSuratStr, namaFileStr, totalKelFn, gt, mobileVisible } = props;
  const isSPK = mode === 'SPK';
  const aktif = kelAktif(items);
  const safeTab = aktif.includes(tabTermin) ? tabTermin : (aktif[0] || 'PENGADAAN');

  return (
    <div className="form-panel no-print" style={{display: mobileVisible ? undefined : 'none'}}>
      <Grp title="Nomor &amp; tanggal" open>
        <div className="row2">
          <Ftxt label="No urut" value={s.noUrut} onChange={v => upd('noUrut', v)} />
          <Ftxt label="Tanggal" value={s.tanggal} type="date" onChange={v => upd('tanggal', v)} />
        </div>
        <div className="computed-box">
          Nomor surat: <b>{noSuratStr}</b><br />Nama file: <b>{namaFileStr}</b>
        </div>
        {isSPK && <Fsel label="Format nomor SPK" value={s.formatNoSPK} options={['standar','lama']} onChange={v => upd('formatNoSPK', v)} hint="'standar' = 068/SPK/LIFT/BAI/VIII/2026. 'lama' = 068/LIFT/BAI/VIII/2026." />}
        <Fsel label="Alamat kantor di kop" value={s.alamatKantor} options={OPT.alamatKantor} onChange={v => upd('alamatKantor', v)} />
      </Grp>

      <Grp title="Customer" open>
        <div className="row2">
          <Fsel label="Sapaan" value={s.sapaan} options={['Bapak','Ibu','Bapak/Ibu','—']} onChange={v => upd('sapaan', v)} />
          <Ftxt label="Nama customer" value={s.namaCustomer} onChange={v => upd('namaCustomer', v)} />
        </div>
        <Ftxt label="Nama perusahaan / yayasan" value={s.namaPerusahaan} onChange={v => upd('namaPerusahaan', v)} hint="Kosongkan untuk perorangan." />
        {isSPK && <Ftxt label="NIK" value={s.nikCustomer} onChange={v => upd('nikCustomer', v)} />}
        {isSPK && (
          <div className="f-item">
            <label className="f-label">Alamat lengkap (lokasi pekerjaan)</label>
            <textarea className="f-ctrl f-area" value={s.alamatCustomer} onChange={e => upd('alamatCustomer', e.target.value)} />
          </div>
        )}
        <Ftxt label="Kota lokasi proyek" value={s.kotaProyek} onChange={v => upd('kotaProyek', v)} />
      </Grp>

      <Grp title="Tabel harga" open>
        <div className="f-item">
          <label className="f-label">Mode harga</label>
          <select className="f-ctrl" value={modeHarga} onChange={e => setModeHarga(e.target.value as ModeHarga)}>
            <option value="satuan">Harga Satuan (dikali Qty)</option>
            <option value="lumpsum">Lumpsum (harga total langsung)</option>
          </select>
        </div>
        <PriceTable items={items} setItemField={setItemField} modeHarga={modeHarga} />
        <div className="f-hint" style={{marginTop:8}}>Centang <b>Include</b> kalau item sudah tercakup di harga induknya.</div>
        <button className="mini-btn" onClick={isiCepat}>Isi cepat 87/13 dari satu nilai kontrak</button>
        <div className="computed-box">
          Pengadaan (SPK 1): <b>{rupiah(totalKelFn('PENGADAAN'))}</b><br />
          Instalasi (SPK 2): <b>{rupiah(totalKelFn('INSTALASI'))}</b><br />
          Pekerjaan Sipil (SPK 3): <b>{rupiah(totalKelFn('SIPIL'))}</b><br />
          <span className="big-total">Total: {rupiah(gt)}</span><br />
          <span style={{fontSize:'11.5px'}}>{terbilangRp(gt)}</span>
        </div>
      </Grp>

      <Grp title="Termin pembayaran" open>
        <TerminPanel items={items} termin={termin} tabTermin={safeTab} setTabTermin={setTabTermin}
          modeHarga={modeHarga} addT={addT} delT={delT} setT={setT} />
        <div className="flag-box">Tiap SPK punya termin sendiri. Termin pengadaan menempel pada milestone barang (BL, MOS), termin instalasi pada milestone pekerjaan lapangan.</div>
      </Grp>

      <Grp title="Opsi desain">
        <Fsel label="Cetak halaman desain" value={String(s.tampilDesain)} options={['true','false']} onChange={v => upd('tampilDesain', v === 'true')} />
        {Object.keys(DESAIN_LABEL).map(k => {
          const list = (props.liveDesain[k] || DESAIN[k] || []);
          return (
            <div key={k} className="f-item">
              <label className="f-label">{DESAIN_LABEL[k]}</label>
              <select className="f-ctrl" value={pilihDesain[k as keyof DesainPilihan]} onChange={e => setPilihDesain({...pilihDesain, [k]: e.target.value})}>
                <option value="">Pilih desain…</option>
                {list.map(o => <option key={o.kode} value={o.kode}>{o.label ?? o.nama}</option>)}
              </select>
            </div>
          );
        })}
      </Grp>

      <Grp title="Unit lift &amp; spesifikasi">
        <Fsel label="Jenis lift" value={s.jenisLift} options={OPT.jenisLift} onChange={v => upd('jenisLift', v)} />
        <Fsel label="Tipe kabin" value={s.tipeKabin} options={OPT.tipeKabin} onChange={v => upd('tipeKabin', v)} />
        <div className="row2">
          <Fsel label="Kapasitas" value={s.kapasitas} options={OPT.kapasitas} onChange={v => upd('kapasitas', v)} />
          <Fsel label="Kapasitas orang" value={s.penumpang} options={OPT.penumpang} onChange={v => upd('penumpang', v)} />
        </div>
        <div className="row3">
          <Fsel label="Kecepatan" value={s.kecepatan} options={OPT.kecepatan} onChange={v => upd('kecepatan', v)} />
          <Fsel label="MPM" value={s.mpm} options={OPT.mpm} onChange={v => upd('mpm', v)} />
          <Fsel label="S/F/D" value={s.sfd} options={OPT.sfd} onChange={v => upd('sfd', v)} />
        </div>
        <div className="row2">
          <Fsel label="Tipe mesin" value={s.tipeMesin} options={OPT.tipeMesin} onChange={v => upd('tipeMesin', v)} />
          <Fsel label="Rasio traksi" value={s.traksi} options={OPT.traksi} onChange={v => upd('traksi', v)} />
        </div>
        <div className="row2">
          <Fsel label="Daya mesin" value={s.dayaMesin} options={OPT.dayaMesin} onChange={v => upd('dayaMesin', v)} />
          <Fsel label="Power supply" value={s.power} options={OPT.power} onChange={v => upd('power', v)} />
        </div>
        <div className="row2">
          <Fsel label="Bukaan pintu" value={s.pintu} options={OPT.pintu} onChange={v => upd('pintu', v)} />
          <Fsel label="Lebar bukaan" value={s.bukaanPintu} options={OPT.bukaanPintu} onChange={v => upd('bukaanPintu', v)} />
        </div>
        <div className="row2">
          <Fsel label="Tinggi kabin" value={s.tinggiKabin} options={OPT.tinggiKabin} onChange={v => upd('tinggiKabin', v)} />
          <Ftxt label="Shaft size" value={s.shaftSize} onChange={v => upd('shaftSize', v)} />
        </div>
        <div className="row2">
          <Ftxt label="Cabin size" value={s.cabinSize} onChange={v => upd('cabinSize', v)} />
          <Ftxt label="Pit depth" value={s.pitDepth} onChange={v => upd('pitDepth', v)} />
        </div>
        <div className="row2">
          <Ftxt label="Nama lantai" value={s.namaLantai} onChange={v => upd('namaLantai', v)} />
          <Ftxt label="Base floor" value={s.baseFloor} onChange={v => upd('baseFloor', v)} />
        </div>
      </Grp>

      <Grp title="Syarat &amp; kondisi">
        <div className="row2">
          <Fsel label="Masa berlaku" value={s.masaBerlaku} options={OPT.masaBerlaku} onChange={v => upd('masaBerlaku', v)} />
          <Fsel label="PPN 11%" value={s.ppn} options={['exclude','include']} onChange={v => upd('ppn', v)} />
        </div>
        <div className="row2">
          <Fsel label="Garansi sparepart" value={s.garSpare} options={OPT.garSpare} onChange={v => upd('garSpare', v)} />
          <Fsel label="Garansi mesin" value={s.garMesin} options={OPT.garMesin} onChange={v => upd('garMesin', v)} />
        </div>
        <Fsel label="Maintenance" value={s.freeMtn} options={OPT.freeMtn} onChange={v => upd('freeMtn', v)} />
        {isSPK && (
          <div className="row2">
            <Ftxt label="Waktu s/d MOS" value={s.waktuPengadaan} onChange={v => upd('waktuPengadaan', v)} />
            <Ftxt label="Instalasi setelah MOS" value={s.waktuInstalasi} onChange={v => upd('waktuInstalasi', v)} />
          </div>
        )}
      </Grp>

      <Grp title="Tanda tangan &amp; cap">
        <Fsel label="Tampilkan tanda tangan &amp; cap" value={String(s.tampilTtd)} options={['true','false']} onChange={v => upd('tampilTtd', v === 'true')} />
        {mode === 'SPH'
          ? <>
              <Fsel label="Nama sales" value={s.sales} options={OPT.sales} onChange={v => upd('sales', v)} />
              <Fsel label="Jabatan" value={s.jabatanTtd} options={OPT.jabatanTtd} onChange={v => upd('jabatanTtd', v)} />
            </>
          : <>
              <Ftxt label="Nama direktur" value={s.direktur} onChange={v => upd('direktur', v)} />
              <Ftxt label="Rekening pembayaran" value={s.rekening} onChange={v => upd('rekening', v)} />
            </>
        }
        <div className="f-hint">Gambar diambil dari blok ASET di sph-types.ts. Selama kosong, yang tercetak hanya garis dan nama.</div>
      </Grp>
    </div>
  );
}

// ── Price Table ──────────────────────────────────────────────
function PriceTable({ items, setItemField, modeHarga }: { items: KatalogItem[]; setItemField: (i: number, k: keyof KatalogItem, v: unknown) => void; modeHarga: ModeHarga }) {
  const q = modeHarga === 'satuan';
  let lastKel = '';
  return (
    <table className="ptbl">
      <thead>
        <tr>
          <th style={{width:24}}></th>
          <th>Item Pekerjaan</th>
          {q && <th style={{width:44}}>Qty</th>}
          <th style={{width:78}}>Pengadaan</th>
          <th style={{width:78}}>Pemasangan</th>
          <th style={{width:46}}>Include</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, idx) => {
          const kelHeader = it.kel !== lastKel ? (lastKel = it.kel, <tr key={'kel'+it.kel} className="kel-row"><td colSpan={q?6:5} dangerouslySetInnerHTML={{__html: KEL_LABEL[it.kel]}} /></tr>) : null;
          const d = it.inc;
          return (
            <>
              {kelHeader}
              <tr key={it.id} className={(it.par ? 'sub-row ' : '') + (it.on ? '' : 'off-row')}>
                <td className="tc"><input type="checkbox" checked={it.on} onChange={e => setItemField(idx,'on',e.target.checked)} /></td>
                <td dangerouslySetInnerHTML={{__html: it.nama}} />
                {q && <td><input type="number" min={0} value={it.qty} disabled={d} onChange={e => setItemField(idx,'qty',e.target.value)} /></td>}
                <td><input type="number" min={0} value={it.hp} disabled={d} onChange={e => setItemField(idx,'hp',e.target.value)} /></td>
                <td><input type="number" min={0} value={it.hi} disabled={d} onChange={e => setItemField(idx,'hi',e.target.value)} /></td>
                <td className="tc"><input type="checkbox" checked={it.inc} onChange={e => setItemField(idx,'inc',e.target.checked)} /></td>
              </tr>
            </>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Termin Panel ─────────────────────────────────────────────
function TerminPanel({ items, termin, tabTermin, setTabTermin, modeHarga, addT, delT, setT }:
  { items: KatalogItem[]; termin: Record<string,TerminItem[]>; tabTermin: string; setTabTermin: (t:string)=>void;
    modeHarga: ModeHarga; addT: (k:string)=>void; delT: (k:string,i:number)=>void; setT: (k:string,i:number,f:'p'|'s',v:unknown)=>void }) {
  const aktif = kelAktif(items);
  const kel = tabTermin;
  const dasar = totalKel(items, kel, modeHarga);
  const tot = sumTermin(termin, kel);
  return (
    <>
      <div className="chip-bar">
        {aktif.map(k => (
          <button key={k} className={'chip'+(tabTermin===k?' chip-on':'')} onClick={() => setTabTermin(k)}>
            {KEL_LABEL[k].split('· ')[1]}
          </button>
        ))}
      </div>
      <div className="tblk">
        <div className="tblk-title" dangerouslySetInnerHTML={{__html: KEL_LABEL[kel]+' — dasar '+rupiah(dasar)}} />
        {(termin[kel]||[]).map((t, i) => (
          <div key={i} className="trow">
            <input type="number" min={0} value={t.p} onChange={e => setT(kel,i,'p',e.target.value)} />
            <select value={t.s} onChange={e => setT(kel,i,'s',e.target.value)}>
              {(SYARAT[kel]||[]).map(o => <option key={o}>{o}</option>)}
            </select>
            <input type="text" value={ribu(dasar*num(t.p)/100)} readOnly tabIndex={-1} />
            <button className="del-btn" onClick={() => delT(kel,i)}>×</button>
          </div>
        ))}
        <button className="mini-btn" onClick={() => addT(kel)}>+ Tambah termin</button>
        <div className="sum-line">
          <span>Total persentase</span>
          <b className={tot===100?'ok-text':'bad-text'}>{tot}%</b>
        </div>
      </div>
    </>
  );
}

// ── Preview Panel ────────────────────────────────────────────
function PreviewPanel({ mode, s, items, termin, modeHarga, pilihDesain, liveDesain, mobileVisible }:
  { mode: Mode; s: S; items: KatalogItem[]; termin: Record<string,TerminItem[]>; modeHarga: ModeHarga; pilihDesain: DesainPilihan; liveDesain: Record<string, DesainOption[]>; mobileVisible: boolean }) {
  const html = mode === 'SPH'
    ? pageSPH(s, items, termin, modeHarga, pilihDesain, liveDesain)
    : pageSPK(s, items, termin, modeHarga, pilihDesain, liveDesain);
  return (
    <div className="preview-panel" style={{display: mobileVisible ? undefined : 'none'}} data-mobile-visible={mobileVisible}>
      <div className="plabel no-print">Pratinjau {mode} — A4</div>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ── Top Bar ─────────────────────────────────────────────────
function TopBar({ mode, setMode, fullName, onBack, onSignOut, onPrint, onSave, saving, mobileTab, setMobileTab }:
  { mode:Mode; setMode:(m:Mode)=>void; fullName:string|null;
    onBack:()=>void; onSignOut:()=>void; onPrint:()=>void;
    onSave:()=>void; saving:boolean;
    mobileTab:'form'|'preview'; setMobileTab:(t:'form'|'preview')=>void; }) {
  return (
    <div className="topbar-app no-print" style={{
      position:'sticky', top:0, zIndex:60, background:'var(--brown)', color:'#fff',
      borderBottom:'3px solid var(--orange)', flexShrink:0,
    }}>
      {/* Main row: back + logo + mode tabs + desktop actions */}
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'0 12px', height:52}}>
        <button onClick={onBack} style={{background:'none',border:0,color:'#E8DCD3',cursor:'pointer',fontSize:20,lineHeight:1,padding:'0 4px',flexShrink:0}}>‹</button>
        <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontWeight:700,fontSize:26,letterSpacing:'.06em',flexShrink:0}}>
          BEL<span style={{color:'var(--orange)'}}>IFT</span>
        </div>
        {/* Desktop SPH/SPK tabs — shown inline on desktop, hidden on mobile */}
        <div className="topbar-mode-tabs" style={{display:'flex',gap:2}} role="tablist">
          {(['SPH','SPK'] as Mode[]).map(m => (
            <button key={m} role="tab" aria-selected={mode===m} onClick={()=>setMode(m)} style={{
              background:'none', border:0, color: mode===m ? '#fff' : '#E8DCD3',
              padding:'8px 14px', cursor:'pointer',
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:16, letterSpacing:'.08em',
              borderBottom: mode===m ? '3px solid var(--orange)' : '3px solid transparent',
              marginBottom:-3, whiteSpace:'nowrap',
            }}>{m === 'SPH' ? 'SPH · Penawaran' : 'SPK · Kontrak'}</button>
          ))}
        </div>
        {/* Desktop: action buttons — hidden on mobile via CSS */}
        <div className="desktop-topbar-actions" style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
          {fullName && <span style={{fontSize:12,opacity:.7}}>{fullName}</span>}
          <button onClick={onSave} disabled={saving} style={{border:'1px solid rgba(255,255,255,.35)',background:'none',color:'#fff',padding:'7px 13px',borderRadius:3,cursor:'pointer',fontWeight:500,fontSize:13,opacity:saving?0.6:1}}>{saving?'Menyimpan…':'Simpan'}</button>
          <button onClick={onPrint} style={{background:'var(--orange)',border:'1px solid var(--orange)',color:'#fff',padding:'7px 13px',borderRadius:3,cursor:'pointer',fontWeight:500,fontSize:13}}>Cetak / Simpan PDF</button>
          <button onClick={onSignOut} style={{border:'1px solid rgba(255,255,255,.35)',background:'none',color:'#fff',padding:'7px 13px',borderRadius:3,cursor:'pointer',fontSize:13}}>Keluar</button>
        </div>
        {/* Mobile: action buttons row (right side) — hidden on desktop via CSS */}
        <div className="mobile-actions" style={{marginLeft:'auto',display:'flex',gap:6,alignItems:'center'}}>
          <button onClick={onSave} disabled={saving} title="Simpan" style={{
            border:'1px solid rgba(255,255,255,.45)',background:'none',color:'#fff',
            padding:'6px 10px',borderRadius:3,cursor:'pointer',fontSize:13,fontWeight:500,
            opacity:saving?0.6:1,whiteSpace:'nowrap',
          }}>{saving?'…':'Simpan'}</button>
          <button onClick={onPrint} title="Cetak / PDF" style={{
            background:'var(--orange)',border:'1px solid var(--orange)',color:'#fff',
            padding:'6px 10px',borderRadius:3,cursor:'pointer',fontSize:13,fontWeight:500,whiteSpace:'nowrap',
          }}>PDF</button>
          <button onClick={onSignOut} title="Keluar" style={{
            border:'1px solid rgba(255,255,255,.35)',background:'none',color:'#E8DCD3',
            padding:'6px 8px',borderRadius:3,cursor:'pointer',fontSize:13,whiteSpace:'nowrap',
          }}>Keluar</button>
        </div>
      </div>

      {/* Mobile second row: SPH/SPK mode tabs + Form/Preview switcher */}
      <div className="mobile-tabs" style={{display:'none', alignItems:'center', justifyContent:'space-between', padding:'0 12px 8px', gap:8}}>
        {/* SPH/SPK mode tabs */}
        <div style={{display:'flex',border:'1px solid rgba(255,255,255,.35)',borderRadius:4,overflow:'hidden'}}>
          {(['SPH','SPK'] as Mode[]).map(m => (
            <button key={m} role="tab" aria-selected={mode===m} onClick={()=>setMode(m)} style={{
              background: mode===m ? 'rgba(255,255,255,.15)' : 'none',
              border:0, color: mode===m ? '#fff' : '#E8DCD3',
              padding:'5px 14px', cursor:'pointer',
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:14, letterSpacing:'.06em',
              borderRight: '1px solid rgba(255,255,255,.2)',
            }}>{m}</button>
          ))}
        </div>
        {/* Form/Preview tab switcher */}
        <div style={{display:'flex',border:'1px solid rgba(255,255,255,.35)',borderRadius:4,overflow:'hidden'}}>
          {(['form','preview'] as const).map(t => (
            <button key={t} onClick={() => setMobileTab(t)} style={{
              background: mobileTab===t ? 'var(--orange)' : 'none',
              border:0, color:'#fff', padding:'5px 12px', cursor:'pointer',
              fontFamily:"'Barlow Condensed',sans-serif", fontWeight:600, fontSize:13, letterSpacing:'.04em',
            }}>{t==='form'?'Form':'Preview'}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
