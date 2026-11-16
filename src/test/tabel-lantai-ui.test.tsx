/**
 * Uji editor Tabel Lantai (Floor to Floor) — diuji sebagai komponen, bukan
 * lewat dokumen cetak, supaya benar-benar terbukti bisa dipakai sales:
 * 6 baris awal, tinggi diketik manual, total ikut berubah, tambah/hapus baris.
 */
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TabelLantai from '@/components/sph/TabelLantai';
import { lantaiAwal, type LantaiUnit } from '@/lib/sph-types';

/** Pembungkus: meniru cara form menyimpan state. */
function Harness({ awal, bacaSaja = false }: { awal?: LantaiUnit[]; bacaSaja?: boolean }) {
  const [lantai, setLantai] = useState<LantaiUnit[]>(awal ?? lantaiAwal(6));
  return <TabelLantai lantai={lantai} onChange={setLantai} bacaSaja={bacaSaja} />;
}

const isi = (label: string, nilai: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value: nilai } });

describe('Tabel Lantai — editor Floor to Floor', () => {
  it('menampilkan 6 baris lantai secara default', () => {
    render(<Harness />);
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`Tinggi lantai ${i} (mm)`)).toBeInTheDocument();
    }
    expect(screen.queryByLabelText('Tinggi lantai 7 (mm)')).toBeNull();
  });

  it('total kosong ditandai "—" sebelum ada isian', () => {
    render(<Harness />);
    expect(screen.getByTestId('total')).toHaveTextContent('—');
  });

  it('menjumlahkan tinggi yang diketik manual', () => {
    render(<Harness />);
    isi('Tinggi lantai 1 (mm)', '4300');
    isi('Tinggi lantai 2 (mm)', '3300');
    isi('Tinggi lantai 3 (mm)', '3100');
    expect(screen.getByTestId('total')).toHaveTextContent('10.700 mm');
  });

  it('menerima angka bersatuan (titik ribuan diabaikan)', () => {
    render(<Harness />);
    isi('Tinggi lantai 1 (mm)', '4.300 mm');
    isi('Tinggi lantai 2 (mm)', '3300');
    // 4300 + 3300 = 7600
    expect(screen.getByTestId('total')).toHaveTextContent('7.600 mm');
  });

  it('tambah lantai menambah baris ke-7', () => {
    render(<Harness />);
    fireEvent.click(screen.getByText('+ Tambah lantai'));
    expect(screen.getByLabelText('Tinggi lantai 7 (mm)')).toBeInTheDocument();
  });

  it('hapus baris merapikan nomor dan totalnya', () => {
    render(<Harness />);
    isi('Tinggi lantai 1 (mm)', '4000');
    isi('Tinggi lantai 2 (mm)', '3000');
    fireEvent.click(screen.getByLabelText('Hapus lantai 1'));
    // Baris yang tadinya ke-2 (3000) kini jadi baris pertama
    expect(screen.getByLabelText('Tinggi lantai 1 (mm)')).toHaveValue('3000');
    expect(screen.getByTestId('total')).toHaveTextContent('3.000 mm');
  });

  it('nama lantai bisa diubah bebas (mis. "Lantai Dasar")', () => {
    render(<Harness />);
    isi('Nama lantai 1', 'Lantai Dasar');
    expect(screen.getByLabelText('Nama lantai 1')).toHaveValue('Lantai Dasar');
  });

  it('mode baca-saja tidak menampilkan tombol tambah/hapus', () => {
    render(<Harness bacaSaja />);
    expect(screen.queryByText('+ Tambah lantai')).toBeNull();
    expect(screen.queryByLabelText('Hapus lantai 1')).toBeNull();
    expect(screen.getByLabelText('Tinggi lantai 1 (mm)')).toBeDisabled();
  });

  it('tabel tetap utuh saat data awal rusak/kosong', () => {
    render(<Harness awal={[]} />);
    const tabel = screen.getByRole('table');
    expect(within(tabel).getAllByRole('textbox').length).toBe(12); // 6 baris × 2 kolom
  });
});
