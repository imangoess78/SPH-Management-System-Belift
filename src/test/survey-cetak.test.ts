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
import { dtKosong } from '@/components/survey/SurveyPanels';

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
