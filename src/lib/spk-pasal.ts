/**
 * Penyusun daftar pasal SPK — SATU sumber teks default.
 *
 * KENAPA FILE INI ADA
 * Dulu seluruh teks pasal hanya hidup di dalam `pageSPK()`. Akibatnya panel
 * Editor SPK tidak punya cara mengetahui isi default sebuah pasal, sehingga
 * yang ditampilkan ke pengguna hanyalah kotak kosong berlabel "paragraf
 * tambahan" — padahal yang dibutuhkan adalah MELIHAT dan MENYUNTING teks yang
 * benar-benar akan tercetak.
 *
 * Dengan memindahkan pembuat pasal ke sini, editor dan dokumen cetak memakai
 * fungsi yang sama. Teks yang tampil di editor dijamin identik dengan yang
 * tercetak — bukan salinan yang bisa melenceng saat dokumen diubah.
 *
 * Alur:
 *   daftarPasal(s, …)  →  susunPasal(…, manualSpk)  →  renderPasal(…)
 *   (teks default)        (tempel isian manusia)       (HTML dokumen)
 */
import { BlokPasal, Pasal, TerminCetak, ORDINAL } from './spk-susun';
import type { GenState, ModeHarga } from './sph-generator';
import { esc, ttdBlok } from './sph-generator';
import { rupiah, num, totalKel, kelAktif, grandTotal } from './sph-utils';
import { KEL_LABEL, type KatalogItem, type TerminItem } from './sph-types';

/** Nilai uang yang dipakai pasal 4 (Nilai Kontrak). */
export interface BahanNilai {
  /** Grand total pekerjaan (sudah termasuk mode harga). */
  gt: number;
  /** Kategori yang punya nilai > 0 beserta nominalnya, urut seperti dokumen. */
  perKategori: { label: string; nominal: number }[];
}

export interface BahanPasal {
  /** Penanda tangan Pihak Pertama & Kedua (blok tanda tangan pasal 10). */
  signBlok: string;
  /** Baris "Pemasangan …" untuk pasal lingkup pekerjaan, sudah berbentuk <li>. */
  stPasang: string;
  /** Daftar termin pembayaran berurutan (3 s/d 9 baris, bebas). */
  daftarTermin: TerminCetak[];
  /** Rincian nilai untuk pasal 4. */
  nilai: BahanNilai;
}

/**
 * Bangun 10 pasal dari data form. Semua nilai yang berasal dari form tetap
 * segar setiap kali dipanggil — inilah sebabnya editor memanggil ulang fungsi
 * ini setiap kali data form berubah, bukan menyimpan salinan HTML sekali.
 */
export function daftarPasal(s: GenState, b: BahanPasal): Pasal[] {
  const { signBlok, stPasang, daftarTermin, nilai } = b;
  // ── Isi pasal sebagai blok terstruktur ──
  // Teks dipindahkan APA ADANYA dari versi lama. Yang berubah hanya bentuknya:
  // tiap paragraf jadi satu entri, supaya bisa disisipi isian manual dan diberi
  // aturan anti-menggantung (judul pasal tidak boleh terpisah dari isinya).
  const p1 = (html: string): BlokPasal => ({ t: 'p', html });
  const ul = (items: string[]): BlokPasal => ({ t: 'ul', items });
  // stPasang dari versi lama berbentuk <li>…</li>; di blok terstruktur isinya teks saja.
  const stPasangTeks = stPasang.replace(/^<li>/, '').replace(/<\/li>$/, '');

  const blokDefinisi: BlokPasal[] = [
    p1('<p><strong>1. SPK (Surat Perintah Kerja)</strong></p>'),
    p1('<p>SPK adalah dokumen resmi yang menjadi dasar pelaksanaan pekerjaan antara Pemberi Kerja dan Pelaksana Pekerjaan yang memuat ruang lingkup pekerjaan, nilai kontrak, waktu pelaksanaan, serta syarat dan ketentuan pekerjaan.</p>'),
    p1('<p><strong>Ketentuan:</strong></p>'),
    ul(['SPK menjadi dasar hukum pelaksanaan proyek.',
      'Semua pekerjaan yang dilakukan harus mengacu pada SPK beserta lampirannya.']),
    p1('<p><strong>2. MOS (Material On Site)</strong></p>'),
    p1('<p>MOS atau Material On Site adalah kondisi dimana material, komponen, atau peralatan yang akan digunakan dalam pekerjaan telah tiba dan tersimpan di lokasi proyek, namun belum dilakukan pemasangan.</p>'),
    p1('<p>Material yang termasuk dalam kategori MOS antara lain dapat berupa komponen utama lift, rel guide rail, mesin, panel kontrol, pintu lantai, cabin, serta material pendukung lainnya yang telah dikirim ke lokasi proyek.</p>'),
    p1('<p><strong>Ketentuan:</strong></p>'),
    ul(['Material yang dinyatakan sebagai MOS telah berada secara fisik di lokasi proyek dan dapat diverifikasi oleh Pemberi Kerja atau Pengawas Proyek.',
      'Material harus dalam kondisi baik, lengkap, dan sesuai dengan spesifikasi yang tercantum dalam dokumen kontrak.',
      'Material yang telah dinyatakan sebagai MOS dapat dijadikan dasar untuk perhitungan progres pekerjaan atau penagihan termin pembayaran sesuai ketentuan dalam kontrak.',
      'Risiko kehilangan atau kerusakan material sebelum proses instalasi menjadi tanggung jawab Pelaksana Pekerjaan, kecuali ditentukan lain dalam perjanjian.',
      'Pemberi Kerja berhak melakukan pemeriksaan terhadap material yang dinyatakan sebagai MOS untuk memastikan kesesuaian dengan spesifikasi proyek.']),
    p1('<p><strong>3. BAST (Berita Acara Serah Terima)</strong></p>'),
    p1('<p>BAST adalah dokumen resmi yang menyatakan bahwa pekerjaan telah selesai dilaksanakan dan diserahkan dari Pelaksana Pekerjaan kepada Pemberi Kerja.</p>'),
    p1('<p>Menandakan pekerjaan telah selesai secara substansial dan unit dapat dioperasikan serta menandakan seluruh kewajiban terselesaikan dan dimulainya perbaikan selama masa pemeliharaan.</p>'),
    p1('<p><strong>Ketentuan:</strong></p>'),
    ul(['BAST menjadi dasar dimulainya masa garansi.',
      'Penandatanganan BAST dilakukan oleh kedua belah pihak.']),
    p1('<p><strong>4. Commissioning</strong></p>'),
    p1('<p>Commissioning adalah proses pengujian dan verifikasi sistem lift setelah instalasi selesai untuk memastikan bahwa seluruh komponen berfungsi sesuai spesifikasi teknis.</p>'),
    p1('<p><strong>Ketentuan:</strong></p>'),
    ul(['Commissioning meliputi pengujian fungsi, keselamatan, dan performa unit.',
      'Commissioning dilakukan sebelum unit dinyatakan siap digunakan.']),
    p1('<p><strong>5. Handover</strong></p>'),
    p1('<p>Handover adalah proses penyerahan unit lift dari Pelaksana Pekerjaan kepada Pemberi Kerja setelah pekerjaan instalasi dan pengujian selesai.</p>'),
    p1('<p><strong>Ketentuan:</strong></p>'),
    ul(['Handover dilakukan setelah commissioning berhasil.',
      'Handover dibuktikan dengan dokumen BAST.']),
    p1('<p><strong>6. Masa Garansi</strong></p>'),
    p1('<p>Masa Garansi adalah periode waktu setelah serah terima dimana Pelaksana Pekerjaan bertanggung jawab memperbaiki kerusakan yang disebabkan oleh kesalahan instalasi atau cacat material.</p>'),
    p1('<p><strong>Ketentuan:</strong></p>'),
    ul(['Masa garansi dimulai sejak tanggal BAST.',
      'Perbaikan selama masa garansi tidak dikenakan biaya tambahan kepada Pemberi Kerja, kecuali kerusakan akibat kelalaian penggunaan.']),
    p1('<p><strong>Waktu Garansi:</strong></p>'),
    ul(['Free Maintenance <strong>' + esc(s.freeMtn) + '</strong>',
      'Garansi Spare Part <strong>' + esc(s.garSpare) + '</strong>',
      'Garansi Mesin/Motor <strong>' + esc(s.garMesin) + '</strong>']),
    p1('<p><strong>7. Progress Pekerjaan</strong></p>'),
    p1('<p>Progress pekerjaan adalah tingkat penyelesaian pekerjaan berdasarkan tahapan pekerjaan yang telah dilaksanakan.</p>'),
    p1('<p><strong>Ketentuan:</strong></p>'),
    ul(['Progress pekerjaan menjadi dasar penagihan termin pembayaran.',
      'Progress harus dapat diverifikasi oleh kedua belah pihak.']),
  ];

  const blokLingkup: BlokPasal[] = [
    p1('<p>PIHAK PERTAMA memberi tugas kepada PIHAK KEDUA untuk mengerjakan pekerjaan sebagai berikut :</p>'),
    p1('<p><strong>Pengadaan Lift</strong></p>'),
    p1('<p>Pengadaan material ' + esc(s.tipeKabin) + ' ' + esc(s.kapasitas) + ' dan transportasi sampai di lokasi proyek ' +
      '1&nbsp;(satu) unit ' + esc(s.jenisLift) + '-' + esc(s.kapasitas) + ', ' + esc(s.penumpang) + ' – ' + esc(s.mpm) + ' – Floors/Stops/Doors ' + esc(s.sfd) + '.</p>'),
    p1('<p><strong>Lingkup Pekerjaan PIHAK PERTAMA</strong></p>'),
    p1('<p>Merupakan pekerjaan yang dilakukan oleh PIHAK PERTAMA untuk mempersiapkan dan menyediakan media pemasangan Elevator yang akan dikerjakan oleh PIHAK KEDUA, dalam hal ini melingkupi:</p>'),
    p1('<p><strong>A. Pekerjaan sipil ;</strong></p>'),
    ul(['Pekerjaan Arsitektural estetika diluar area pintu lift termasuk finishing celah lantai dengan pintu lift',
      'Sirkulasi Udara Ruang Mesin (turbin/Heksos/lainnya) jika diinginkan.']),
    p1('<p><strong>B. Pengadaan Elektrikal/Kelistrikan</strong></p>'),
    ul(['Pengadaan Daya Listrik dan Instalasi Listrik Sub Panel di Dekat Control Panel Lift',
      'Pemasangan grounding listrik khusus lift, terpisah dari penangkal petir']),
    p1('<p><strong>C. Pengadaan gudang peralatan Lift di Lokasi Proyek sesuai dengan Kapasitas Lift</strong></p>'),
    p1('<p><strong>D. Pembuatan pit</strong></p>'),
    p1('<p><strong>Lingkup Pekerjaan PIHAK KEDUA</strong></p>'),
    p1('<p>Merupakan pekerjaan utama pengadaan hingga pemasangan Elevator melingkupi ;</p>'),
    ul(['Produksi dan pengadaan elevator sesuai permintaan dan spesifikasi',
      stPasangTeks,
      'Pengiriman elevator hingga sampai di Lokasi,',
      'Instalasi dan pemasangan elevator sesuai standard dengan pekerjaan diluar lingkup pekerjaan PIHAK PERTAMA,',
      'Pemeriksaan dan uji kelayakan, commissioning penggunaan lift',
      'Serah terima pekerjaan melalui Berita Acara Serah Terima (BAST)',
      'Free Maintenance setelah BAST di tanda tangani sesuai ketentuan']),
  ];

  const blokBayar: BlokPasal[] = [
    p1('<p>Pembayaran akan dilakukan dengan cara :</p>'),
    { t: 'tabel_termin', items: daftarTermin },
    p1('<p>Pembayaran dapat ditransfer ke rekening:</p><p style="margin-left:8mm"><strong>PT. BELIFT AMANAH INDONESIA</strong><br><strong>' + esc(s.rekening) + '</strong></p>'),
  ];

  return [
    { no: 1, judul: 'DEFINISI ISTILAH DAN KETENTUAN', blok: blokDefinisi },
    { no: 2, judul: 'LINGKUP PEKERJAAN', blok: blokLingkup },
    { no: 3, judul: 'LOKASI PEKERJAAN', blok: [
      p1('<p>Lokasi pekerjaan berada di <strong>' + esc(s.alamatCustomer || '…') + '</strong> yang disebut lokasi proyek yang akan dikerjakan oleh PIHAK KEDUA.</p>'),
    ] },
    { no: 4, judul: 'NILAI KONTRAK', blok: [
      p1('<p>Nilai pekerjaan yang telah disepakati oleh kedua belah pihak adalah : <strong>' + rupiah(nilai.gt) + '</strong> ,-</p>'),
      { t: 'tabel_nilai', items: nilai.perKategori },
      p1('<p style="font-size:9.5pt">Harga ' + (s.ppn === 'exclude' ? 'belum' : 'sudah') + ' termasuk PPN 11%.</p>'),
    ] },
    { no: 5, judul: 'WAKTU PELAKSANAAN PEKERJAAN', blok: [
      p1('<p>Waktu pelaksanaan Pekerjaan :</p>'),
      ul(['Maksimal <strong>' + esc(s.waktuPengadaan) + '</strong> sejak kontrak telah ditanda tangani dan pembayaran pertama (DP) diterima untuk Material On site.',
        'Maksimal <strong>' + esc(s.waktuInstalasi) + '</strong> sejak Material On Site dengan catatan tidak ada kendala bangunan dari PIHAK PERTAMA.']),
    ] },
    { no: 6, judul: 'PINALTY', blok: [
      p1('<p>Penalty akan dikenakan apabila keterlambatan terjadi karena kelalaian PIHAK KEDUA:</p>'),
      ul(['Apabila PIHAK KEDUA terlambat dalam menyelesaikan proses produksi dan pengiriman material ke lokasi proyek melebihi waktu maksimal 2,5 (dua setengah) bulan sejak pembayaran DP diterima, maka dikenakan pinalty sebesar <strong>0,05% / hari kerja (maksimal 1%)</strong> dari nilai pekerjaan pengadaan material unit elevator.',
        'Apabila PIHAK KEDUA terlambat dalam menyelesaikan pekerjaan pemasangan lebih dari 30 hari sejak Material dinyatakan lengkap di lokasi dan lokasi dinyatakan siap oleh PIHAK PERTAMA akan dikenakan pinalty sebesar <strong>0,05% / hari kerja (maksimal 2%)</strong> dari nilai pekerjaan pemasangan unit elevator.',
        'Pinalty pemasangan dan pengadaan material <strong>tidak berlaku</strong> apabila keterlambatan disebabkan oleh: gangguan pekerjaan sipil, keterlambatan pelunasan termin, akses kerja yang belum lengkap dan gangguan listrik di lokasi proyek.']),
    ] },
    { no: 7, judul: 'CARA PEMBAYARAN', blok: blokBayar },
    { no: 8, judul: 'FORCE MAJURE', blok: [
      p1('<p>Force Majeure adalah keadaan di luar kemampuan para pihak yang menyebabkan pekerjaan tidak dapat dilaksanakan, seperti Bencana Alam, Gempa Bumi, Kebakaran, Kerusuhan, Kebijakan Pemerintah, Gangguan Distribusi Material Global, atau Meninggal Dunia salah satu pihak.</p>'),
      p1('<p>Pihak yang mengalami Force Majeure wajib memberitahukan secara tertulis kepada pihak lainnya paling lambat 7 (tujuh) hari kalender sejak terjadinya keadaan tersebut.</p>'),
      p1('<p>Selama keadaan Force Majeure berlangsung, kewajiban para pihak ditangguhkan sementara, waktu pelaksanaan pekerjaan diperpanjang sesuai lamanya keadaan tersebut, dan PIHAK KEDUA tidak dikenakan penalty keterlambatan.</p>'),
      p1('<p>Dalam hal salah satu pihak meninggal dunia, maka hak dan kewajiban berdasarkan SPK ini beralih kepada ahli waris yang sah sesuai ketentuan dalam SPK.</p>'),
      p1('<p>Apabila keadaan Force Majeure berlangsung lebih dari 90 (sembilan puluh) hari kalender dan pekerjaan tidak dapat dilanjutkan, maka para pihak atau ahli waris yang sah sepakat menyelesaikannya secara musyawarah.</p>'),
    ] },
    { no: 9, judul: 'PENYELESAIAN', blok: [
      p1('<p>Apabila terjadi sengketa, PIHAK PERTAMA dan PIHAK KEDUA sepakat menyelesaikan secara musyawarah. Apabila tidak tercapai kesepakatan, maka diselesaikan melalui Pengadilan NEGERI sesuai domisili hukum PIHAK KEDUA.</p>'),
    ] },
    { no: 10, judul: 'PENUTUP', blok: [
      p1('<p>Hal-hal yang belum tercantum dalam surat Perjanjian Kerja ini apabila diperlukan akan dibicarakan kemudian dan dituangkan dalam bentuk tertulis serta menjadi addendum yang tak terpisahkan dari perjanjian ini.</p>'),
      p1('<p>Demikian, Surat Perjanjian Kerja ini ditanda tangani oleh kedua belah pihak untuk dapat dilaksanakan dengan baik sebagaimana mestinya. Perjanjian ini dibuat dalam rangkap dua. Masing-masing dibubuhi materai secukupnya serta mempunyai kekuatan hukum yang sama.</p>'),
      p1(signBlok),
    ] },
  ];
}

/**
 * Susun bahan pasal dari data form.
 *
 * Dipakai DUA tempat — dokumen cetak (pageSPK) dan panel Editor SPK — supaya
 * angka dan nama yang muncul di kotak editor persis sama dengan yang tercetak.
 * Kalau logikanya diduplikasi, keduanya cepat atau lambat akan berbeda.
 */
export function bahanPasal(
  s: GenState,
  st: { steel: boolean; alu: boolean; ada: boolean; label: string },
  items: KatalogItem[],
  termin: Record<string, TerminItem[]>,
  modeH: ModeHarga,
): BahanPasal {
  const signBlok = '<div class="sign">' +
    '<div>PIHAK PERTAMA<div class="sigbox"></div>' +
    '<div class="sig-nm">' + esc(s.namaCustomer || '…') + '</div>' +
    '<div>' + esc(s.namaPerusahaan ? 'Pemilik / Penanggung Jawab' : 'Pemilik Bangunan') + '</div></div>' +
    '<div>PIHAK KEDUA<br><strong>PT BELIFT AMANAH INDONESIA</strong>' +
    ttdBlok(s.direktur, 'Direktur', true, s.tampilTtd) + '</div>' +
    '</div>';

  const stPasang = st.label
    ? '<li>Pemasangan ' + esc(st.label) + (s.finishingStruktur ? ' dengan ' + esc(s.finishingStruktur) : '') + '</li>'
    : (s.finishingStruktur ? '<li>' + esc(s.finishingStruktur) + '</li>' : '');

  const daftarTermin: TerminCetak[] = [];
  kelAktif(items).filter(k => totalKel(items, k, modeH) > 0).forEach(kel => {
    const dasar = totalKel(items, kel, modeH);
    (termin[kel] || []).forEach((t, i) => {
      daftarTermin.push({
        urutan: ORDINAL[daftarTermin.length] || ('ke-' + (daftarTermin.length + 1)),
        persen: num(t.p),
        nominal: dasar * num(t.p) / 100,
        syarat: esc(t.s),
        tanggal: s.tanggalTermin?.[kel]?.[i] || undefined,
      });
    });
  });

  return {
    signBlok,
    stPasang,
    daftarTermin,
    nilai: {
      gt: grandTotal(items, modeH),
      perKategori: kelAktif(items).filter(k => totalKel(items, k, modeH) > 0)
        .map(k => ({ label: KEL_LABEL[k], nominal: totalKel(items, k, modeH) })),
    },
  };
}
