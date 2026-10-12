import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/**
 * PoPilihProyek — ketahanan saat sebagian endpoint menolak.
 *
 * Halaman ini dijaga izin `po`, tetapi salah satu sumber datanya
 * (`surveyApi.daftar({jenis:'final'})`) menuntut izin `survey_final`. Peran
 * bawaan hari ini memegang keduanya sehingga gejalanya belum terlihat, TETAPI
 * izin bisa diatur per akun di Manajemen Akun. Akun dengan `po` tanpa
 * `survey_final` akan mendapat 403.
 *
 * Dulu kedua permintaan dibundel dalam satu `Promise.all` tanpa penangan
 * per-sumber, jadi penolakan itu mengosongkan KEDUA daftar sekaligus — termasuk
 * daftar PO yang datanya sudah tiba. Gejala yang tampak hanya "tidak ada proyek
 * yang siap", tanpa petunjuk apa pun. Ini kelas bug yang sama dengan halaman
 * "Mulai Final Survey".
 */

const FINAL_TERKUNCI = {
  id: 'F1', id_lead: 'L1', jenis: 'final', kode_proyek: 'PRJ-0001',
  no_survey: '001/SVY/LIFT/BAI/X/2026', tgl_survey: '2026-10-01',
  surveyor: 'Jihad', terkunci: 1, status: 'Selesai', nama_prospek: 'Agung Putro Setio',
};

const { daftarFinal, daftarPo } = vi.hoisted(() => ({
  daftarFinal: vi.fn(),
  daftarPo: vi.fn(),
}));

vi.mock('@/lib/survey-api', () => ({
  surveyApi: { daftar: (...a: unknown[]) => daftarFinal(...a) },
  poApi: { daftar: (...a: unknown[]) => daftarPo(...a) },
}));

import PoPilihProyek from '@/pages/po/PoPilihProyek';

const gambar = () => render(
  <MemoryRouter>
    <PoPilihProyek />
  </MemoryRouter>,
);

beforeEach(() => {
  daftarFinal.mockReset();
  daftarPo.mockReset();
  daftarFinal.mockResolvedValue({ data: [FINAL_TERKUNCI] });
  daftarPo.mockResolvedValue({ data: [] });
});

describe('PoPilihProyek', () => {
  it('menampilkan proyek yang Final Survey-nya sudah dikunci', async () => {
    gambar();
    await waitFor(() => expect(screen.getByText('Agung Putro Setio')).toBeInTheDocument());
    expect(screen.getByText('PRJ-0001')).toBeInTheDocument();
  });

  it('tetap menampilkan daftar PO walau daftar Final Survey ditolak', async () => {
    // Akun dengan izin `po` tetapi tanpa `survey_final`.
    daftarFinal.mockRejectedValue(new Error('Akses ditolak: peran ini tidak berwenang membuka survey_final.'));
    gambar();

    // Yang penting: halaman tidak diam-diam tampak normal tanpa penjelasan.
    await waitFor(() => expect(screen.getByText(/Sebagian data tidak bisa dimuat/)).toBeInTheDocument());
    expect(screen.getByText(/survey_final/)).toBeInTheDocument();
  });

  it('tidak memunculkan peringatan saat semua data termuat', async () => {
    gambar();
    await waitFor(() => expect(screen.getByText('Agung Putro Setio')).toBeInTheDocument());
    expect(screen.queryByText(/Sebagian data tidak bisa dimuat/)).not.toBeInTheDocument();
  });
});
