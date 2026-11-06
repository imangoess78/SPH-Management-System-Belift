/**
 * Uji dokumen cetak Survey / Lacak / PO.
 *
 * Kenapa uji ini ada: dokumen cetak dibuka di jendela baru, jadi kalau
 * pembuatannya gagal, pengguna hanya melihat halaman kosong tanpa pesan
 * apa pun. Satu nilai cacat (kolom lama, teks biasa di tempat yang
 * seharusnya array) pernah membuat seluruh dokumen gagal. Uji ini menjaga
 * agar ketiga dokumen selalu menghasilkan HTML lengkap.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cetakSurvey, cetakLacak, cetakPo, gantiAlamatMedia, htmlSurvey } from '@/lib/survey-cetak';
import { dtKosong, dokumentasiKosong, pekerjaanKosong, kesimpulanKosong } from '@/components/survey/SurveyPanels';

const tertangkap: string[] = [];

/**
 * Dokumen yang ditulis ke jendela cetak.
 *
 * cetakHtml() menulis dua kali: penanda "Menyiapkan dokumen…" lebih dulu
 * (supaya pengguna tidak melihat tab kosong sambil foto disiapkan), baru
 * dokumen sungguhannya. Yang diperiksa uji ini adalah yang terakhir.
 */
const dokumenTerakhir = () => {
  const asli = tertangkap.filter(h => !h.includes('Menyiapkan dokumen'));
  return asli[asli.length - 1] || '';
};

beforeEach(() => {
  tertangkap.length = 0;
  vi.spyOn(window, 'open').mockImplementation((() => ({
    document: {
      write: (h: string) => tertangkap.push(h),
      open: () => { tertangkap.length = 0; },
      close: () => {},
      images: [],
    },
    addEventListener: () => {},
    focus: () => {}, print: () => {}, close: () => {},
  })) as unknown as typeof window.open);
});

const dt = { ...dtKosong(), kapasitas: '450', pit: '1500' };

/** Cek umum yang harus lulus untuk dokumen apa pun. */
function periksaUmum(h: string) {
  expect(h.length).toBeGreaterThan(500);
  expect(h).toMatch(/Belift Amanah/i);      // kop surat
  expect(h).toMatch(/<table/i);             // ada tabel data
  expect(h).not.toMatch(/\{"|\}\}/);        // tidak ada JSON mentah bocor
  expect(h).not.toMatch(/undefined|NaN|\[object Object\]/);
}

describe('dokumen cetak', () => {
  it('Survey Sales — lengkap dengan nomor, foto, dan tanda tangan', async () => {
    await cetakSurvey({
      jenis: 'sales',
      judul: 'Survey Sales',
      noSurvey: '001/SVY/LIFT/BAI/IX/2026',
      tgl: '2026-09-29',
      kodeProyek: 'BLF-2026-001',
      namaProspek: 'PT Uji Coba Lift',
      kodeLead: 'LEAD-UJI-001',
      surveyor: 'Uji Surveyor',
      pjLapangan: 'Pak Andi',
      pjTelp: '08123',
      jamKerja: '08:00-17:00',
      dt,
      dokumentasi: [{ no: 1, judul: 'Tampak depan', ada: true, foto: [{ key: 'recovery/2026-08-19/survey-photos/a.png', nama: 'a.png' }] }],
      pekerjaan: [{ nama: 'Bongkar dinding', on: true, ket: 'perlu izin' }],
      kesimpulan: [{ q: 'Ada ruang mesin?', jawab: 'Ya', alasan: 'cukup' }],
      ttd: { sales: 'Budi Sales', customer: 'Pak Andi', surveyor: 'Uji Surveyor' },
      catatanLapangan: 'Akses sempit',
      videoLink: '',
    });

    const h = dokumenTerakhir();
    expect(h.length).toBeGreaterThan(0);
    periksaUmum(h);
    expect(h).toContain('001/SVY/LIFT/BAI/IX/2026');
    expect(h).toMatch(/\/api\/media\?key=/);        // foto ikut tercetak
    expect(h).toContain('Bongkar dinding');
    expect(h).toContain('Ada ruang mesin?');
    expect(h).toContain('Budi Sales');
  });

  it('Survey tetap jadi walau kolom data teknis kosong/cacat', async () => {
    // Kolom JSON yang kosong atau berbentuk teks biasa tidak boleh
    // menggagalkan dokumen.
    await cetakSurvey({
      jenis: 'final', judul: 'Final Survey', noSurvey: '002/SVY/LIFT/BAI/IX/2026',
      tgl: '2026-09-30', kodeProyek: 'BLF-2026-001', namaProspek: 'PT Uji Coba Lift',
      kodeLead: 'LEAD-UJI-001', surveyor: 'Uji Surveyor', pjLapangan: '', pjTelp: '', jamKerja: '',
      dt: dtKosong(),
      dokumentasi: [], pekerjaan: [], kesimpulan: [],
      ttd: { sales: '', customer: '', surveyor: 'Uji Surveyor' },
      catatanLapangan: '', videoLink: '',
    });

    const h = dokumenTerakhir();
    expect(h.length).toBeGreaterThan(0);
    periksaUmum(h);
  });

  it('Lacak — memuat kode proyek dan hasil perbandingan', async () => {
    await cetakLacak({
      namaProspek: 'PT Uji Coba Lift',
      kodeLead: 'LEAD-UJI-001',
      kodeProyek: 'BLF-2026-001',
      titik: [
        { label: 'Survey Sales', sub: '29 Sep 2026 · Budi' },
        { label: 'Final Survey', sub: '30 Sep 2026 · Uji Surveyor' },
      ],
      temuan: [{
        jenis: 'kritis', field: 'kapasitas', label: 'Kapasitas', teks: '450 → 500',
        arah: 'sales→final', tingkat: 'kritis',
      }],
      sumber: 'Survey Sales',
      pembanding: 'Final Survey',
    });

    const h = dokumenTerakhir();
    expect(h.length).toBeGreaterThan(0);
    periksaUmum(h);
    expect(h).toContain('BLF-2026-001');
    expect(h).toContain('Kapasitas');
    expect(h).toMatch(/kritis/i);
  });

  it('Lacak tanpa temuan — tetap dokumen sah, bukan halaman kosong', async () => {
    await cetakLacak({
      namaProspek: 'PT Uji Coba Lift', kodeLead: 'LEAD-UJI-001', kodeProyek: 'BLF-2026-001',
      titik: [{ label: 'Survey Sales', sub: '29 Sep 2026' }],
      temuan: [], sumber: 'Survey Sales', pembanding: 'Final Survey',
    });

    const h = dokumenTerakhir();
    expect(h.length).toBeGreaterThan(0);
    periksaUmum(h);
    expect(h).toMatch(/Tidak ada perbedaan/i);
  });

  it('PO Pabrik — memuat nomor PO dan data revisi', async () => {
    await cetakPo({
      no_po: 'PO-UJI-1', tgl_po: '2026-09-30', kode_proyek: 'BLF-2026-001',
      nama_prospek: 'PT Uji Coba Lift', kode_lead: 'LEAD-UJI-001',
      pabrik: 'Pabrik Uji', pic: 'Pak PIC', catatan: 'Segera',
      rev_terakhir: 2, status: 'Terbit', dibuat_oleh: 'Uji Surveyor',
    }, [{
      id: 'r1', id_po: 'p1', rev: 1, tgl_revisi: '2026-09-30', oleh: 'Uji Surveyor',
      alasan: 'Perubahan pit', dt, perubahan: [],
      jml_perubahan: 0, perubahan_setelah_final: 0, created_at: '2026-09-30',
    }]);

    const h = dokumenTerakhir();
    expect(h.length).toBeGreaterThan(0);
    periksaUmum(h);
    expect(h).toContain('PO-UJI-1');
    expect(h).toContain('Pabrik Uji');
  });
});

describe('video dokumentasi pada dokumen survey', () => {
  const bahan = (videoLink: string) => ({
    jenis: 'final' as const, judul: 'Final Survey', noSurvey: '004/SVY/LIFT/BAI/X/2026',
    tgl: '2026-11-06', kodeProyek: 'BLF-2026-005', namaProspek: 'PT Uji Coba Lift',
    kodeLead: 'LEAD-UJI-001', surveyor: 'Uji Surveyor', pjLapangan: '', pjTelp: '', jamKerja: '',
    dt: dtKosong(),
    dokumentasi: [{ no: 1, judul: 'Tampak depan', ada: true, foto: [{ key: 'recovery/a.png', nama: 'a.png' }] }],
    pekerjaan: [], kesimpulan: [],
    ttd: { sales: '', customer: '', surveyor: 'Uji Surveyor' },
    catatanLapangan: '', videoLink,
  });

  it('tautan video tercetak dalam satu section Dokumentasi, bukan di Identitas Proyek', () => {
    const h = htmlSurvey(bahan('https://cekcobafinalsurvey.com'));
    expect(h).toContain('Video Dokumentasi');
    expect(h).toContain('https://cekcobafinalsurvey.com');
    // Satu judul section saja: foto dan video menyatu di dalamnya.
    expect(h.match(/<h2>Dokumentasi<\/h2>/g)?.length).toBe(1);
    expect(h).not.toContain('Dokumentasi Foto');
    // video berada di dalam section yang sama, setelah galeri foto
    const posJudul = h.indexOf('<h2>Dokumentasi</h2>');
    const posGaleri = h.indexOf('class="galeri"');
    const posVideo = h.indexOf('Video Dokumentasi');
    expect(posJudul).toBeGreaterThan(-1);
    expect(posGaleri).toBeGreaterThan(posJudul);
    expect(posVideo).toBeGreaterThan(posGaleri);
    // tidak lagi dicetak sebagai baris tabel identitas
    expect(h).not.toContain('<th>Tautan Video</th>');
  });

  it('tautan tanpa skema tetap bisa diklik', () => {
    const h = htmlSurvey(bahan('youtu.be/abc123'));
    expect(h).toContain('href="https://youtu.be/abc123"');
    expect(h).toContain('youtu.be/abc123');           // teks asli tetap ditampilkan
  });

  it('video muncul walau tidak ada foto sama sekali', () => {
    const b = { ...bahan('https://youtu.be/abc123'), dokumentasi: [] };
    const h = htmlSurvey(b);
    expect(h).toContain('<h2>Dokumentasi</h2>');
    expect(h).not.toContain('class="galeri"');
    expect(h).toContain('Video Dokumentasi');
  });

  it('video kosong tidak mencetak bagian apa pun', () => {
    const h = htmlSurvey(bahan(''));
    expect(h).not.toContain('Video Dokumentasi');
    expect(h).not.toMatch(/href="https:\/\/"/);
  });
});

describe('Tabel Lantai tanpa kolom No & gambar spesifikasi', () => {
  const lantai = [
    { no: 1, lantai: 'Lantai 1', tinggi: '4300', door: '800', finishing: 'Granit' },
    { no: 2, lantai: 'Lantai 2', tinggi: '3300', door: '', finishing: '' },
  ];

  const dasar = () => ({
    jenis: 'final' as const, judul: 'Final Survey', noSurvey: '001/SVY/X/2026',
    tgl: '2026-11-06', kodeProyek: 'PRJ-1', namaProspek: 'Bpk. Uji', kodeLead: 'LD-1',
    surveyor: 'S', pjLapangan: '', pjTelp: '', jamKerja: '',
    dt: { ...dtKosong(), lantai },
    dokumentasi: dokumentasiKosong(), pekerjaan: pekerjaanKosong(),
    kesimpulan: kesimpulanKosong(), ttd: { sales: '', customer: '', surveyor: '' },
    catatanLapangan: '', videoLink: '',
  });

  it('kolom No tidak dicetak pada Tabel Lantai', () => {
    const h = htmlSurvey(dasar());
    const iJudul = h.indexOf('<h2>Tabel Lantai</h2>');
    expect(iJudul).toBeGreaterThan(-1);
    const tabel = h.slice(iJudul, h.indexOf('</table>', iJudul));
    expect(tabel).not.toContain('<strong>No</strong>');
    // isi baris langsung dimulai nama lantai, bukan angka urut
    expect(tabel).toContain('<tr><td>Lantai 1</td><td>4300</td>');
    expect(tabel).toContain('<tr><td>Lantai 2</td><td>3300</td>');
  });

  it('gambar dari Database Desain (key mentah) dibungkus /api/media', () => {
    const dt = { ...dtKosong(), 'imgdesain:model': 'recovery/2026-08-19/design-images/a.png' };
    const h = htmlSurvey({ ...dasar(), dt });
    expect(h).toContain('/api/media?key=recovery%2F2026-08-19%2Fdesign-images%2Fa.png');
    // tidak boleh ada src berisi key mentah
    expect(h).not.toContain('src="recovery/');
  });

  it('gambar Database Desain yang sudah berupa URL tidak dibungkus dua kali', () => {
    const dt = { ...dtKosong(), 'imgdesain:model': '/api/media?key=recovery%2Fa.png' };
    const h = htmlSurvey({ ...dasar(), dt });
    expect(h).not.toContain('key=%2Fapi%2Fmedia');
  });
});

/**
 * Lebar kolom dikunci <colgroup> + table-layout:fixed. Tanpa itu browser
 * memeras kolom berisi teks panjang (Note turun sampai 7%) — keluhan klien
 * "kolom Note terlalu sempit". Uji ini menjaga agar tidak kembali longgar.
 */
describe('lebar kolom setiap tabel dokumen', () => {
  const bahan = () => ({
    jenis: 'final' as const, judul: 'Final Survey', noSurvey: '001/SVY/X/2026',
    tgl: '2026-11-06', kodeProyek: 'PRJ-1', namaProspek: 'Bpk. Uji', kodeLead: 'LD-1',
    surveyor: 'S', pjLapangan: 'PJ', pjTelp: '08', jamKerja: '08.00',
    dt: {
      ...dtKosong(),
      kapasitas: '1000',
      'note:kapasitas': 'Catatan panjang yang butuh ruang lebar di kolom Note.',
      lantai: [{ no: 1, lantai: 'Lantai 1', tinggi: '4300', door: '800', finishing: 'Granit' }],
      addon: [{ kode: 'A1', nama: 'Tirai', on: true, ada: true, fotoLink: '' }] as never,
    },
    dokumentasi: dokumentasiKosong(),
    pekerjaan: [{ nama: 'Bongkar', on: true, ket: 'termasuk angkut' }],
    kesimpulan: [{ q: 'Pit cukup?', jawab: 'Ya', alasan: '1600 mm' }],
    ttd: { sales: 'A', customer: 'B', surveyor: 'S' },
    catatanLapangan: '', videoLink: '',
  });

  it('setiap tabel punya colgroup dengan total lebar ~100%', () => {
    const h = htmlSurvey(bahan());
    const tabel = h.match(/<table[^>]*>/g) || [];
    expect(tabel.length).toBeGreaterThan(3);
    // setiap pembuka <table> harus langsung diikuti <colgroup>
    for (const buka of tabel) {
      expect(h).toContain(buka + '<colgroup>');
    }
    for (const cg of h.match(/<colgroup>.*?<\/colgroup>/g) || []) {
      const lebar = [...cg.matchAll(/width:([\d.]+)%/g)].map(m => Number(m[1]));
      const jumlah = lebar.reduce((a, b) => a + b, 0);
      expect(jumlah).toBeGreaterThan(90);
      expect(jumlah).toBeLessThanOrEqual(100);
    }
  });

  it('kolom Note pada tabel spesifikasi minimal 35%', () => {
    const h = htmlSurvey(bahan());
    const cg = h.match(/<colgroup><col style="width:9mm"><col style="width:[^"]+"><col style="width:[^"]+"><col style="width:([\d.]+)%"><\/colgroup>/);
    expect(cg).not.toBeNull();
    expect(Number(cg![1])).toBeGreaterThanOrEqual(35);
  });
});
