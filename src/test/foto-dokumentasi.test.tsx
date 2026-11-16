/**
 * Uji permintaan klien (6 Nov 2026):
 *   · Dokumentasi: unggah foto langsung (bukan URL), maksimal 5 per baris.
 *   · Lampiran tiap spec boleh diambil dari Master Data (upload manual).
 *   · Foto dokumentasi WAJIB muncul di dokumen cetak Final Survey.
 *
 * Kenapa uji ini ada: gambar adalah bagian yang paling gampang "hilang diam-
 * diam". Kalau alamatnya dibungkus dua kali (kunci mentah vs URL Master Data),
 * pratinjau tetap tampak wajar di sebagian tempat, tapi dokumen cetak kosong.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DokumentasiPanel, dokumentasiKosong, MAKS_FOTO_DOKUMENTASI, urlFoto,
} from '@/components/survey/SurveyPanels';
import { dtKosong } from '@/components/survey/SurveyPanels';
import { htmlSurvey } from '@/lib/survey-cetak';
import type { DataTeknis } from '@/lib/survey-types';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: false, status: 403, json: () => Promise.resolve({ error: 'ditolak' }),
  } as unknown as Response)));
});

describe('Dokumentasi — unggah foto, maksimal 5', () => {
  it('menampilkan batas 5 dan penghitung per baris', () => {
    render(<DokumentasiPanel baris={dokumentasiKosong()} ubah={() => {}} />);
    expect(screen.getByText(/maksimal/i)).toBeTruthy();
    expect(screen.getAllByText(`0/${MAKS_FOTO_DOKUMENTASI}`).length).toBeGreaterThan(20);
  });

  it('kolom unggah DINONAKTIFKAN saat sudah 5 foto', () => {
    const baris = dokumentasiKosong();
    baris[0].foto = Array.from({ length: MAKS_FOTO_DOKUMENTASI }, (_, i) => ({
      key: `recovery/2026-08-19/survey-photos/f${i}.jpg`, nama: `f${i}.jpg`,
    }));

    const { container } = render(<DokumentasiPanel baris={baris} ubah={() => {}} />);
    const input = container.querySelectorAll('input[type="file"]')[0] as HTMLInputElement;

    expect(input.disabled).toBe(true);
    expect(screen.getByText(`5/${MAKS_FOTO_DOKUMENTASI}`)).toBeTruthy();
  });

  it('tidak ada kolom URL — foto hanya lewat unggah berkas', () => {
    const { container } = render(<DokumentasiPanel baris={dokumentasiKosong()} ubah={() => {}} />);
    // Satu-satunya input teks yang boleh ada: tidak ada. Semua input berupa file/checkbox.
    const teks = Array.from(container.querySelectorAll('input')).filter(
      i => i.type === 'text' || i.type === 'url',
    );
    expect(teks.length).toBe(0);
  });
});

describe('urlFoto — dua bentuk alamat', () => {
  it('kunci R2 mentah dibungkus /api/media', () => {
    expect(urlFoto('recovery/2026-08-19/survey-photos/a.jpg'))
      .toBe('/api/media?key=recovery%2F2026-08-19%2Fsurvey-photos%2Fa.jpg');
  });

  it('URL Master Data dipakai apa adanya (tidak dibungkus dua kali)', () => {
    const dariMaster = '/api/media?key=recovery%2F2026-08-19%2Fdesign-images%2Fb.jpg';
    expect(urlFoto(dariMaster)).toBe(dariMaster);
  });
});

describe('dokumentasi tersimpan → 24 slot baku', () => {
  it('dokumen lama berisi [] tetap menampilkan 24 slot', async () => {
    const { lengkapiDokumentasi } = await import('@/pages/survey/SurveyForm');
    const hasil = lengkapiDokumentasi([]);
    expect(hasil).toHaveLength(24);
    expect(hasil[0].judul).toBe('Tampak depan gedung');
  });

  it('foto lama menempel kembali pada slot yang benar', async () => {
    const { lengkapiDokumentasi } = await import('@/pages/survey/SurveyForm');
    const hasil = lengkapiDokumentasi(JSON.stringify([
      { no: 4, judul: 'Lokasi hoistway / shaft', ada: true, foto: [{ key: 'k1.jpg', nama: 'k1.jpg' }] },
    ]));

    expect(hasil).toHaveLength(24);
    expect(hasil[3].ada).toBe(true);
    expect(hasil[3].foto).toHaveLength(1);
    expect(hasil[0].foto).toHaveLength(0);
  });
});

describe('cetak Final Survey — foto dokumentasi ikut tercetak', () => {
  const bahan = {
    jenis: 'final' as const, judul: 'Final Survey', noSurvey: '002/SVY/LIFT/BAI/XI/2026',
    tgl: '2026-11-06', kodeProyek: 'PRJ-002', namaProspek: 'Bpk. Foto', kodeLead: 'LD-2',
    surveyor: 'Surveyor', pjLapangan: '', pjTelp: '', jamKerja: '',
    pekerjaan: [], kesimpulan: [],
    ttd: { sales: 'Sales', customer: 'Customer', surveyor: 'Surveyor' },
    catatanLapangan: '', videoLink: '',
    dt: { ...dtKosong(), kapasitas: '450' } as DataTeknis,
  };

  it('mencetak sampai 5 foto untuk satu slot, dengan judul slot', () => {
    const dokumentasi = dokumentasiKosong();
    dokumentasi[0].foto = Array.from({ length: 5 }, (_, i) => ({
      key: `recovery/2026-08-19/survey-photos/d${i}.jpg`, nama: `d${i}.jpg`,
    }));

    const h = htmlSurvey({ ...bahan, dokumentasi });
    expect(h).toMatch(/<h2>Dokumentasi<\/h2>/);
    expect((h.match(/<figure>/g) || []).length).toBe(5);
    expect(h).toMatch(/Tampak depan gedung \(1\/5\)/);
    expect(h).toMatch(/Tampak depan gedung \(5\/5\)/);
  });

  it('foto dari Master Data tidak menghasilkan alamat rusak', () => {
    const dokumentasi = dokumentasiKosong();
    dokumentasi[0].foto = [{
      key: '/api/media?key=recovery%2F2026-08-19%2Fdesign-images%2Fx.jpg', nama: 'Master.jpg',
    }];

    const h = htmlSurvey({ ...bahan, dokumentasi });
    expect(h).toContain('/api/media?key=recovery%2F2026-08-19%2Fdesign-images%2Fx.jpg');
    expect(h).not.toMatch(/key=%2Fapi%2Fmedia/); // tidak dibungkus dua kali
  });

  it('tanpa foto dan tanpa video, bagian dokumentasi tidak muncul', () => {
    expect(htmlSurvey({ ...bahan, dokumentasi: dokumentasiKosong() })).not.toMatch(/<h2>Dokumentasi<\/h2>/);
  });
});
