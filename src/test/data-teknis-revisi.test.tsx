/**
 * Uji REVISI KLIEN Final Survey (6 Nov 2026).
 *
 * Kenapa uji ini ada: revisi ini mengubah daftar field teknis, dan sebagian
 * perubahan bersifat "menghapus" (Tebal Dinding, Sill Pintu, Bahan Pintu,
 * Jumlah Pintu per Lantai, Finishing Cabin). Kalau daftar field disunting
 * sembarangan, dua hal bisa rusak tanpa terlihat:
 *   1. Field lama yang sudah berisi di dokumen TERKUNCI ikut hilang dari cetak.
 *   2. Travelling / Total Height berhenti dihitung, tapi tetap tampak wajar.
 *
 * Isi uji:
 *   · field baru muncul, field yang dihapus klien tidak muncul di form;
 *   · field yang dihapus TETAP tercetak bila dokumen lama menyimpan nilainya;
 *   · Travelling = jumlah tinggi antar-lantai (tanpa pit), Total = pit+travel+OH;
 *   · format cetak: No | Parameter | Value | Note, judul berbahasa Inggris.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DataTeknisPanel, dtKosong } from '@/components/survey/SurveyPanels';
import { hitungTravelling, hitungTotalHeight, type DataTeknis, type Lantai } from '@/lib/survey-types';
import { htmlSurvey } from '@/lib/survey-cetak';

// Database Desain tidak tersedia di lingkungan uji — panel wajib tetap tampil.
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: false, status: 403, json: () => Promise.resolve({ error: 'ditolak' }),
  } as unknown as Response)));
});

const lantai: Lantai[] = [
  { no: 1, lantai: 'Lantai 1', tinggi: '4000', door: '', finishing: '' },
  { no: 2, lantai: 'Lantai 2', tinggi: '3500', door: '', finishing: '' },
  { no: 3, lantai: 'Lantai 3', tinggi: '3500', door: '', finishing: '' },
];

describe('field Data Teknis setelah revisi klien', () => {
  it('menampilkan field baru & menyembunyikan field yang dihapus', () => {
    render(<DataTeknisPanel dt={{ ...dtKosong() }} ubah={() => {}} />);

    for (const label of [
      'Tipe Lift (MR / MRL)', 'Total Height', 'Travelling Height',
      'Bahan Konstruksi Shaft', 'Posisi Hoistway', 'Tipe Bukaan Pintu',
      'Jenis Cabin', 'Bahan Cabin', 'Plafon Cabin', 'Lantai Cabin', 'Remarks',
    ]) {
      expect(screen.getByText(new RegExp(label.replace(/[()/]/g, '.?')), { selector: 'label, h3' })).toBeTruthy();
    }

    for (const hilang of ['Tebal Dinding', 'Sill Pintu', 'Bahan Pintu', 'Jumlah Pintu per Lantai', 'Finishing Cabin']) {
      expect(screen.queryByText(hilang, { selector: 'label' })).toBeNull();
    }
  });

  it('Kapasitas berupa dropdown (combobox), bukan kolom teks bebas', () => {
    render(<DataTeknisPanel dt={{ ...dtKosong() }} ubah={() => {}} />);
    // Kolom teks biasa ber-placeholder kosong; combobox berarti Select shadcn.
    const combobox = screen.getAllByRole('combobox');
    expect(combobox.length).toBeGreaterThanOrEqual(5); // jenisLift, kapasitas, tipeMesin, drive, dst.
  });

  it('tiap spec punya kolom Note', () => {
    render(<DataTeknisPanel dt={{ ...dtKosong() }} ubah={() => {}} />);
    const notes = screen.getAllByPlaceholderText(/^Note/);
    expect(notes.length).toBeGreaterThan(20);
  });

  it('Travelling & Total Height dihitung otomatis lalu ditulis ke dt', async () => {
    const dt: DataTeknis = { ...dtKosong(), pitDepth: '1500', overhead: '4200', lantai };
    const ubah = vi.fn();
    render(<DataTeknisPanel dt={dt} ubah={ubah} />);

    await waitFor(() => {
      expect(ubah).toHaveBeenCalledWith('travelling', '7000');
      expect(ubah).toHaveBeenCalledWith('totalHeight', '12700');
    });
  });
});

describe('hitungan otomatis', () => {
  it('travelling = jumlah tinggi antar-lantai, lantai dasar & pit tidak dihitung', () => {
    expect(hitungTravelling(lantai)).toBe(7000);
    expect(hitungTotalHeight({ ...dtKosong(), pitDepth: '1500', overhead: '4200', lantai })).toBe(12700);
  });

  it('satu lantai saja → travelling 0 (belum ada perjalanan)', () => {
    expect(hitungTravelling([lantai[0]])).toBe(0);
  });

  it('tahan data kosong / bukan array', () => {
    expect(hitungTravelling(undefined)).toBe(0);
    expect(hitungTotalHeight({ ...dtKosong() })).toBe(0);
  });
});

describe('dokumen cetak gaya spec sheet', () => {
  const bahan = {
    jenis: 'final' as const, judul: 'Final Survey', noSurvey: '001/SVY/LIFT/BAI/XI/2026',
    tgl: '2026-11-06', kodeProyek: 'PRJ-001', namaProspek: 'Bpk. Uji', kodeLead: 'LD-1',
    surveyor: 'Surveyor', pjLapangan: '', pjTelp: '', jamKerja: '',
    dokumentasi: [], pekerjaan: [], kesimpulan: [],
    ttd: { sales: 'Sales', customer: 'Customer', surveyor: 'Surveyor' },
    catatanLapangan: '', videoLink: '',
  };

  it('memakai kolom No / Parameter / Value / Note dan judul Inggris', () => {
    const dt: DataTeknis = {
      ...dtKosong(), jenisLift: 'Passenger', kapasitas: '450', pitDepth: '1500',
      overhead: '4200', travelling: '7000', totalHeight: '12700',
      bahanShaft: 'Baja WF', tipePintu: 'Center Opening',
    };
    const h = htmlSurvey({ ...bahan, dt });

    expect(h).toMatch(/No<\/th>.*Parameter<\/th>.*Value<\/th>.*Note<\/th>/s);
    expect(h).toMatch(/Main Specifications/);
    expect(h).toMatch(/Total Height \(Pit to Overhead\)/);
    expect(h).toMatch(/Shaft Construction/);
    expect(h).toMatch(/Door Opening Type/);
    expect(h).toMatch(/Baja WF/);
    expect(h).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it('Note pengisi dipakai; bila kosong dipakai catatan baku', () => {
    const dt: DataTeknis = { ...dtKosong(), kapasitas: '450', 'note:kapasitas': 'Beban uji 500 kg' };
    const h = htmlSurvey({ ...bahan, dt });
    expect(h).toMatch(/Beban uji 500 kg/);

    const h2 = htmlSurvey({ ...bahan, dt: { ...dtKosong(), kapasitas: '450' } });
    expect(h2).toMatch(/Rated load\./);
  });

  it('field yang dihapus klien TETAP tercetak untuk dokumen lama', () => {
    const dt: DataTeknis = {
      ...dtKosong(), kapasitas: '450',
      sillPintu: 'SS 1.2mm', jumlahPintu: '2', finishCabin: 'Kombinasi',
    };
    const h = htmlSurvey({ ...bahan, dt });
    expect(h).toMatch(/Door Sill/);
    expect(h).toMatch(/Doors per Floor/);
    expect(h).toMatch(/Cabin Finishing/);
    expect(h).toMatch(/SS 1\.2mm/);
  });

  it('Remarks ikut tercetak', () => {
    const dt: DataTeknis = { ...dtKosong(), remarks: 'Pit dibersihkan dulu oleh pemilik.' };
    expect(htmlSurvey({ ...bahan, dt })).toMatch(/Pit dibersihkan dulu/);
    expect(htmlSurvey({ ...bahan, dt })).toMatch(/<h2>Remarks<\/h2>/);
  });

  it('dokumen lama tanpa travelling/totalHeight tetap mencetak hitungannya', () => {
    // Kejadian nyata di 001/SVY/LIFT/BAI/XI/2026: tabel lantai terisi, tapi
    // dua field ini belum pernah ada saat dokumen dibuat.
    const dt: DataTeknis = { ...dtKosong(), kapasitas: '1000', pitDepth: '1500', overhead: '4000', lantai };
    const h = htmlSurvey({ ...bahan, dt });
    expect(h).toMatch(/Travelling Height/);
    expect(h).toMatch(/7000 mm/);
    expect(h).toMatch(/Total Height \(Pit to Overhead\)/);
    expect(h).toMatch(/12500 mm/);
  });
});

describe('nilai lama di luar daftar opsi baru', () => {
  it('tetap ditampilkan, bukan tampak kosong', () => {
    // Data nyata: bahanCabin "Kombinasi SS + Kaca" (opsi baru: Stainless/Aluminium).
    const dt: DataTeknis = { ...dtKosong(), bahanCabin: 'Kombinasi SS + Kaca' };
    render(<DataTeknisPanel dt={dt} ubah={() => {}} bacaSaja />);
    expect(screen.getByText(/Kombinasi SS \+ Kaca/)).toBeTruthy();
  });
});
