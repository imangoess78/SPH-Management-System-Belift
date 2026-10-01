import { describe, it, expect, vi } from 'vitest';
import { gantiAlamatMedia, htmlSurvey } from '@/lib/survey-cetak';
import { gantiAsetLokal, tungguGambar, lepasBlob } from '@/lib/cetak';
import { dtKosong } from '@/components/survey/SurveyPanels';

/**
 * Foto di dokumen cetak TIDAK boleh dimuat sendiri oleh jendela cetak.
 *
 * Dokumen cetak dibuka lewat window.open. Kalau HTML-nya masih memuat
 * <img src="/api/media?key=…">, jendela itulah yang meminta gambarnya — dan
 * cookie sesinya belum tentu ikut (jendela pop-up sering dianggap konteks
 * pihak ketiga oleh browser). Akibatnya /api/media membalas 401 dan foto di
 * hasil cetak/PDF bolong tanpa pesan apa pun — muncul di komputer orang lain,
 * tidak di komputer kita.
 *
 * Perbaikannya: gambar diambil dari jendela utama (sesi pasti ada) lalu
 * diganti alamat blob. Uji ini mengunci perilaku itu.
 */
describe('penyiapan gambar untuk cetak', () => {
  const alamat = '/api/media?key=recovery%2F2026-08-19%2Fsurvey-photos%2Fa.png';
  const html = `<figure><img src="${alamat}"><img src="${alamat}"></figure>`;

  it('mengganti SEMUA alamat media (termasuk yang kembar) jadi blob', async () => {
    const blobUrl = 'blob:http://localhost/abc-123';
    // jsdom tidak menyediakan URL.createObjectURL, jadi dipasang manual —
    // bukan spyOn, karena propertinya memang belum ada.
    const asli = (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL = () => blobUrl;
    const ambil = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }));

    try {
      const { html: hasil, blobUrls } = await gantiAlamatMedia(html, ambil);

      expect(hasil).not.toContain('/api/media');
      expect(hasil.match(/blob:/g)).toHaveLength(2);
      expect(blobUrls).toEqual([blobUrl]);
      // Diambil sekali saja walau alamatnya muncul dua kali.
      expect(ambil).toHaveBeenCalledTimes(1);
    } finally {
      if (asli === undefined) delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      else (URL as unknown as { createObjectURL: unknown }).createObjectURL = asli;
    }
  });

  it('alamat yang gagal diambil dibiarkan apa adanya (dokumen tetap bisa dicetak)', async () => {
    const ambil = vi.fn(async () => ({ ok: false, blob: async () => new Blob([]) }));
    const { html: hasil, blobUrls } = await gantiAlamatMedia(html, ambil);

    expect(hasil).toContain(alamat);
    expect(blobUrls).toEqual([]);
  });

  it('jaringan yang melempar galat tidak menggagalkan seluruh cetak', async () => {
    const ambil = vi.fn(async () => { throw new Error('jaringan putus'); });
    const { html: hasil } = await gantiAlamatMedia(html, ambil);
    expect(hasil).toContain(alamat);
  });

  it('HTML dokumen survey memang memuat foto lewat /api/media', () => {
    const hasil = htmlSurvey({
      jenis: 'sales', judul: 'Survey Sales', noSurvey: '001/SVY', tgl: '2026-09-29',
      kodeProyek: 'BLF-1', namaProspek: 'PT Uji', kodeLead: 'L1', surveyor: 'S',
      pjLapangan: '', pjTelp: '', jamKerja: '', dt: dtKosong(),
      dokumentasi: [{ no: 1, judul: 'Depan', ada: true, foto: [
        { key: 'recovery/2026-08-19/survey-photos/a.png', nama: 'a.png' }] }],
      pekerjaan: [], kesimpulan: [], ttd: { sales: '', customer: '', surveyor: '' },
      catatanLapangan: '', videoLink: '',
    });
    expect(hasil).toMatch(/\/api\/media\?key=/);
  });
});

/**
 * Aset gambar bawaan aplikasi (latar halaman, logo, tanda tangan) memakai
 * alamat RELATIF seperti /hexagon-outline-bg.png.
 *
 * Jendela cetak hasil window.open('') adalah halaman about:blank, dan di sana
 * alamat relatif tidak bisa diselesaikan — latarnya hilang di hasil cetak.
 * Ini terjadi bahkan sebelum sesi diwajibkan, dan tidak terlihat saat
 * pratinjau karena di situ alamat relatifnya kebetulan benar.
 */
describe('penyiapan aset lokal untuk cetak', () => {
  const pasangBlob = () => {
    const asli = (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL =
      () => 'blob:http://localhost/aset-1';
    return () => {
      if (asli === undefined) delete (URL as unknown as { createObjectURL?: unknown }).createObjectURL;
      else (URL as unknown as { createObjectURL: unknown }).createObjectURL = asli;
    };
  };

  it('mengganti aset lokal di dalam url(), src="…", dan src=\'…\'', async () => {
    const pulih = pasangBlob();
    const html = `<style>.page{background:#fff url('/hexagon-outline-bg.png') no-repeat}</style>
      <img src="/corner-shape-bg.png"><img src='/logo-belift.svg'>`;
    const ambil = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }));

    try {
      const { html: hasil, blobUrls } = await gantiAsetLokal(html, ambil);

      expect(hasil).not.toContain('/hexagon-outline-bg.png');
      expect(hasil).not.toContain('/corner-shape-bg.png');
      expect(hasil).not.toContain('/logo-belift.svg');
      expect(hasil.match(/blob:/g)).toHaveLength(3);
      // Tiga aset berbeda → tiga alamat blob, dan tiap aset diambil sekali.
      expect(blobUrls).toHaveLength(3);
      expect(ambil).toHaveBeenCalledTimes(3);
    } finally { pulih(); }
  });

  it('TIDAK menyentuh alamat luar (http) atau /api/media', async () => {
    const ambil = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }));
    const html = `<img src="https://contoh.test/foto.png">
      <img src="/api/media?key=recovery%2F2026-08-19%2Fsignatures%2Fa.png">`;

    const { html: hasil } = await gantiAsetLokal(html, ambil);

    expect(hasil).toBe(html);
    expect(ambil).not.toHaveBeenCalled();
  });

  it('aset yang gagal diambil dibiarkan apa adanya', async () => {
    const ambil = vi.fn(async () => ({ ok: false, blob: async () => new Blob([]) }));
    const html = `<img src="/corner-shape-bg.png">`;
    const { html: hasil, blobUrls } = await gantiAsetLokal(html, ambil);

    expect(hasil).toContain('/corner-shape-bg.png');
    expect(blobUrls).toEqual([]);
  });
});

describe('penantian gambar & pembersihan blob', () => {
  it('langsung selesai kalau tidak ada gambar yang tertahan', async () => {
    const win = { document: { images: [] } } as unknown as Window;
    await expect(tungguGambar(win)).resolves.toBeUndefined();
  });

  it('menunggu sampai gambar selesai dimuat', async () => {
    const gambar = { complete: false };
    const win = { document: { images: [gambar] } } as unknown as Window;
    setTimeout(() => { gambar.complete = true; }, 50);

    const mulai = Date.now();
    await tungguGambar(win);
    expect(Date.now() - mulai).toBeGreaterThanOrEqual(40);
  });

  it('lepasBlob tidak melempar walau alamatnya sudah tidak berlaku', () => {
    expect(() => lepasBlob(['blob:tidak-ada'])).not.toThrow();
  });
});
