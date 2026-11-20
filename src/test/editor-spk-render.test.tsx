import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EditorSpk, { JUDUL_PASAL } from '@/components/EditorSpk';
import { CETAK_AWAL } from '@/lib/spk-susun';

/**
 * Tes ini lahir dari bug NYATA di produksi: form SPK blank putih karena
 * `setTanggalTermin is not defined`. `tsc` TIDAK menangkapnya (prop tak
 * diteruskan antar komponen), hanya terlihat saat dirender. Jadi di sini
 * panel editor benar-benar dirender, bukan sekadar diuji tipenya.
 */

// Tiptap butuh API DOM yang tidak lengkap di jsdom.
vi.mock('@tiptap/react', () => ({
  useEditor: () => null,
  EditorContent: () => <div data-testid="editor-content" />,
}));

function renderPanel(s: Record<string, unknown> = {}) {
  const setS = vi.fn();
  // State lengkap dibutuhkan karena panel menyusun teks default lewat pageSPK().
  const dasar = {
    noUrut: '001', tanggal: '2026-01-01', kota: 'Jakarta', alamatKantor: 'jakarta',
    sapaan: 'Bapak', namaCustomer: 'Uji', namaPerusahaan: '', nikCustomer: '',
    alamatCustomer: 'Jl. Uji', kotaProyek: 'Jakarta', sales: 'Uji Sales',
    jabatanTtd: 'Sales', tampilTtd: true, formatNoSPK: 'standar', tipeKabin: 'MR',
    kapasitas: '6', penumpang: '6', mpm: '60', sfd: '6/6/6', jenisLift: 'Passenger',
    tampilDesain: true, finishingStruktur: '', catatanDesain: {},
    cetak: CETAK_AWAL, manualSpk: {},
  };
  const hasil = render(
    <MemoryRouter>
      <EditorSpk s={{ ...dasar, ...s } as never} setS={setS} />
    </MemoryRouter>,
  );
  return { ...hasil, setS };
}

describe('EditorSpk — panel harus bisa dirender tanpa error', () => {
  it('render dasar tidak melempar (ini yang bikin blank page)', () => {
    expect(() => renderPanel()).not.toThrow();
  });

  it('menampilkan 10 pasal dan pilihan kertas', () => {
    renderPanel();
    expect(screen.getByText('Editor SPK')).toBeTruthy();
    expect(document.querySelectorAll('.edspk-pasal')).toHaveLength(JUDUL_PASAL.length);
    const opsi = [...document.querySelectorAll('.edspk-row select option')].map(o => o.textContent);
    expect(opsi).toHaveLength(4);
    expect(opsi[0]).toContain('A4');
  });

  it('default margin sesuai CETAK_AWAL (A4, 18/16/17/17)', () => {
    renderPanel();
    const nilai = [...document.querySelectorAll('.edspk-margin input')].map(i => (i as HTMLInputElement).value);
    expect(nilai).toEqual(['18', '16', '17', '17']);
  });

  it('data manual yang sudah ada terbaca (judul pasal berubah tampil)', () => {
    renderPanel({ manualSpk: { '3': { judul: 'LOKASI PROYEK KHUSUS' } } });
    expect(screen.getByText('LOKASI PROYEK KHUSUS')).toBeTruthy();
  });

  it('badge muncul bila ada pasal yang diubah manual', () => {
    renderPanel({ manualSpk: { '3': { judul: 'X' }, '4': { judul: 'Y' } } });
    expect(screen.getByText('2 pasal diubah manual')).toBeTruthy();
  });

  it('cetak rusak / kosong tidak membuat panel crash', () => {
    expect(() => renderPanel({ cetak: undefined })).not.toThrow();
    expect(() => renderPanel({ cetak: { kertas: 'ngawur', marginAtas: NaN } })).not.toThrow();
  });

  it('manualSpk berisi pasal yang tidak dikenal tidak membuat crash', () => {
    expect(() => renderPanel({ manualSpk: { '99': { judul: 'Hantu' } } })).not.toThrow();
  });
});
