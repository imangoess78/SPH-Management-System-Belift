import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * Reproduksi laporan Mas: "ketika mengisi Final Survey tidak ada SPK/proyek
 * yang muncul, padahal sudah ada SPK".
 *
 * Ada DUA sebab yang saling menutupi, dan keduanya harus dijaga di sini:
 *
 *   1. Halaman "Mulai Final Survey" hanya menawarkan LEAD yang sudah punya
 *      Survey Sales. Data untuk menyusun daftar itu harus memuat survey
 *      jenis `sales` — kalau tidak, tidak ada satu pun lead yang lolos.
 *      (inilah yang diperbaiki lebih dulu)
 *
 *   2. Lebih dalam: lead adalah satu-satunya pintu masuk. Padahal di
 *      lapangan tim kerap langsung SPH → SPK → Final Survey tanpa Survey
 *      Sales, dan dokumen SPK-nya sendiri tidak pernah menyimpan `id_lead`.
 *      Akibatnya halaman tetap kosong meski SPK-nya ada — berapa pun
 *      banyaknya. Karena itu Final Survey diperbolehkan berangkat dari
 *      dokumen SPK final, dengan penautan SPK → lead diselesaikan server.
 */

const LEADS = [
  {
    id: 'L1', kode_lead: 'LEAD-0001', nama_prospek: 'Agung Putro Setio',
    kota: 'Depok', sales: 'Jihad', kualifikasi: 'HOT', skor: 100,
    status_terakhir: 'SPK Ditandatangani + DP',
  },
  // Belum melewati Survey Sales → tidak muncul di pintu "Dari Proyek".
  // Dipakai untuk menguji penautan nama tanpa bentrok dengan tabel lead.
  {
    id: 'L2', kode_lead: 'LEAD-0002', nama_prospek: 'Budi Santoso',
    kota: 'Bandung', sales: 'Imam Solikhin', kualifikasi: 'WARM', skor: 60,
    status_terakhir: 'SPK Disusun',
  },
];

const SURVEY_SALES = [
  {
    id: 'S1', id_lead: 'L1', jenis: 'sales', kode_proyek: 'PRJ-0001',
    no_survey: '001/SVY/LIFT/BAI/X/2026', tgl_survey: '2026-10-01',
    surveyor: 'Jihad', terkunci: 1, status: 'Selesai',
  },
];

/** SPK nyata: `id_lead` masih kosong karena dokumen tidak menyimpannya. */
const SPK_TANPA_LEAD = {
  id: 'D1', nomor_spk: '7826/SPK/LIFT/BAI/X/2026', tanggal: '2026-10-02',
  customer: 'Yessitania', kota: 'Lamongan', jenis_lift: 'Home Lift',
  kapasitas: '400 Kg', tipe_kabin: 'Premium Pintu Kaca',
  sales: 'Imam Solikhin', id_lead: null,
};

// ── Keadaan yang bisa diubah tiap tes ──────────────────────
let spkData: unknown[] = [];
let surveyFinal: unknown[] = [];

const taut = vi.fn(async (_id: string) => ({
  ok: true, id_lead: 'L2', kode_lead: 'LEAD-0002',
  baru: true, cara: 'nama cocok', nomor_spk: '7826/SPK/LIFT/BAI/X/2026',
}));

vi.mock('@/lib/crm-api', () => ({
  api: { listLeads: vi.fn(async () => ({ data: LEADS })) },
}));

// Server menyaring `jenis` di sisi SQL, jadi permintaan `jenis=final` TIDAK
// akan pernah memuat baris ber-jenis `sales`.
vi.mock('@/lib/survey-api', () => ({
  surveyApi: {
    daftar: vi.fn(async (f: { jenis?: string } = {}) => ({
      data: f.jenis === 'sales' ? SURVEY_SALES : surveyFinal,
    })),
  },
  spkApi: {
    final: vi.fn(async () => ({ data: spkData })),
    taut: (id: string) => taut(id),
  },
}));

import SurveyPilihLead from '@/pages/survey/SurveyPilihLead';

const gambar = (jenis: 'sales' | 'final' = 'final') => render(
  <MemoryRouter>
    <SurveyPilihLead jenis={jenis} />
  </MemoryRouter>,
);

beforeEach(() => {
  spkData = [];
  surveyFinal = [];
  taut.mockClear();
});

describe('SurveyPilihLead — Final Survey', () => {
  it('menampilkan lead yang sudah punya Survey Sales', async () => {
    gambar();
    await waitFor(() => expect(screen.getByText('Agung Putro Setio')).toBeInTheDocument());
  });

  it('kolom Survey Sales menampilkan tanggal, bukan "Belum ada"', async () => {
    gambar();
    await waitFor(() => expect(screen.getByText(/Ada ·/)).toBeInTheDocument());
  });

  it('menampilkan SPK final yang belum tertaut lead, meski Survey Sales nol', async () => {
    // Inti laporan: SPK ada, tapi tidak muncul apa pun.
    spkData = [SPK_TANPA_LEAD];
    gambar();

    await waitFor(() => expect(screen.getByText('Dari Dokumen SPK Final')).toBeInTheDocument());
    expect(screen.getByText('Yessitania')).toBeInTheDocument();
    expect(screen.getByText('7826/SPK/LIFT/BAI/X/2026')).toBeInTheDocument();
    expect(screen.getByText('Lamongan')).toBeInTheDocument();
  });

  it('SPK yang lead-nya sudah punya Final Survey tidak ditawarkan lagi', async () => {
    // Kalau tetap ditawarkan, satu proyek bisa dapat dua Final Survey.
    // Lead L1 juga hilang dari pintu "Dari Proyek" karena sudah punya Final
    // Survey — jadi halaman memang harus kosong, bukan menawarkan ulang.
    spkData = [{ ...SPK_TANPA_LEAD, id: 'D9', id_lead: 'L1' }];
    surveyFinal = [{ id: 'F1', id_lead: 'L1', jenis: 'final', kode_proyek: 'PRJ-0001' }];
    gambar();

    await waitFor(() => expect(screen.getByText(/tidak ada SPK final yang belum disurvey/)).toBeInTheDocument());
    expect(screen.queryByText('Dari Dokumen SPK Final')).not.toBeInTheDocument();
    expect(screen.queryByText('7826/SPK/LIFT/BAI/X/2026')).not.toBeInTheDocument();
  });

  it('memberi tahu lebih dulu ke mana SPK akan ditautkan', async () => {
    // 'Budi Santoso' cocok dengan LEAD-0002 yang belum lewat Survey Sales,
    // jadi label ini hanya muncul di baris SPK — bukan di tabel lead.
    spkData = [{ ...SPK_TANPA_LEAD, customer: 'Budi Santoso', kota: 'Bandung' }];
    gambar();

    await waitFor(() => expect(screen.getByText(/Akan ditautkan ke/)).toBeInTheDocument());
    expect(screen.getByText('LEAD-0002')).toBeInTheDocument();
  });

  it('menandai SPK yang belum punya lead pasangan', async () => {
    spkData = [SPK_TANPA_LEAD];
    gambar();

    await waitFor(() => expect(screen.getByText(/lead baru akan dibuat/)).toBeInTheDocument());
  });

  it('tombol Tautkan menyerahkan penautan ke server, bukan mengerjakannya di klien', async () => {
    spkData = [SPK_TANPA_LEAD];
    gambar();

    const tombol = await screen.findByRole('button', { name: /Tautkan & Survey/ });
    fireEvent.click(tombol);

    await waitFor(() => expect(taut).toHaveBeenCalledWith('D1'));
  });

  it('Survey Sales tetap hanya menawarkan lead — pintu SPK tidak muncul', async () => {
    spkData = [SPK_TANPA_LEAD];
    gambar('sales');

    await waitFor(() => expect(screen.getByText('Dari Lead')).toBeInTheDocument());
    expect(screen.queryByText('Dari Dokumen SPK Final')).not.toBeInTheDocument();
  });
});
