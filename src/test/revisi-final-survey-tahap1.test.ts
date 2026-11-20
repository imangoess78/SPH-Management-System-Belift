import { describe, it, expect } from 'vitest';
import {
  DT_FIELDS, DT_FIELDS_TAMPIL, KELOMPOK_FIELD, FIELD_WAJIB_KUNCI,
  fieldDari, type FieldDef,
} from '@/lib/survey-types';
import { htmlPo, teksRingkasPo } from '@/lib/survey-cetak';
import type { BahanCetakPo } from '@/lib/survey-cetak';
// PoRevisiRow tidak diekspor ulang oleh survey-cetak — ambil dari sumbernya.
import type { PoRevisiRow } from '@/lib/survey-types';

// ============================================================
//  Revisi klien (tahap 1) — hanya sekitar Spesifikasi Utama dan
//  Mesin & Kelistrikan. Tahap sebelumnya (field warna, Finishing
//  Car/Landing Door) SUDAH DI-REVERT, jadi tidak diuji di sini.
//
//  Setiap butir revisi dijaga supaya tidak mundur diam-diam:
//  kalau seseorang menghapus `sembunyi: true`, ubah opsi Power
//  Supply, atau membalik urutan Floors/Stops/Doors, tes ini gagal.
// ============================================================

const tampil = (key: string): FieldDef | undefined => DT_FIELDS_TAMPIL.find(f => f.key === key);
const semua = (key: string): FieldDef | undefined => fieldDari(key);

/** Field yang dihapus klien: tidak tampil, tetapi tetap ada di katalog. */
const DIHAPUS = [
  { key: 'dayaMesin', label: 'Daya Mesin' },
  { key: 'mesinMerk', label: 'Merk Mesin' },
  { key: 'posisiMesin', label: 'Posisi Mesin' },
  { key: 'drive', label: 'Sistem Penggerak' },
];

describe('Revisi Final Survey tahap 1', () => {
  describe('field yang dihapus klien', () => {
    for (const { key, label } of DIHAPUS) {
      it(`${label} (${key}) tidak tampil di form`, () => {
        expect(tampil(key), `${label} masih tampil di form`).toBeUndefined();
        expect(semua(key)?.sembunyi, `${key} harus ditandai sembunyi`).toBe(true);
      });

      it(`${label} tidak lagi wajib diisi`, () => {
        expect(FIELD_WAJIB_KUNCI).not.toContain(key);
      });

      it(`${label} tetap ada di katalog (dokumen lama tidak kehilangan isi)`, () => {
        expect(semua(key)?.label).toBe(label);
      });
    }

    it('kelima field itu benar-benar hilang dari label yang dirender', () => {
      const label = DT_FIELDS_TAMPIL.map(f => f.label);
      for (const { label: l } of DIHAPUS) expect(label).not.toContain(l);
    });
  });

  describe('Power Supply jadi dropdown 220 1ph / 380 3ph', () => {
    it('jenisnya dropdown pilihan, bukan teks bebas', () => {
      expect(tampil('power')?.jenis).toBe('pilih');
    });

    it('opsinya persis 220 1ph dan 380 3ph', () => {
      expect(tampil('power')?.opsi).toEqual(['220 1ph', '380 3ph']);
    });

    it('placeholder teks lama tidak tertinggal', () => {
      expect(tampil('power')?.hint).toBeUndefined();
    });
  });

  describe('urutan Floors / Stops / Doors', () => {
    it('label form memakai Floors / Stops / Doors', () => {
      expect(tampil('sfd')?.label).toBe('Floors / Stops / Doors');
    });

    it('label cetak bahasa Inggris juga dibalik', () => {
      expect(semua('sfd')?.en).toBe('Floors / Stops / Doors');
    });

    it('tidak ada sisa "Stops / Floors" di katalog', () => {
      const sisa = DT_FIELDS.filter(f => f.label.includes('Stops / Floors') || (f.en || '').includes('Stops / Floors'));
      expect(sisa.map(f => f.key)).toEqual([]);
    });
  });

  describe('susunan kelompok tidak berubah', () => {
    it('Mesin & Kelistrikan tetap punya isi setelah 3 field dihapus', () => {
      const isi = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Mesin & Kelistrikan');
      expect(isi.length).toBeGreaterThan(0);
      expect(isi.map(f => f.key)).not.toContain('dayaMesin');
    });

    it('Spesifikasi Utama masih layak tampil', () => {
      const isi = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Spesifikasi Utama');
      expect(isi.length).toBeGreaterThan(3);
      expect(isi.map(f => f.key)).not.toContain('drive');
    });

    it('setiap kelompok tercantum di KELOMPOK_FIELD', () => {
      const asing = DT_FIELDS_TAMPIL
        .map(f => f.kel)
        .filter(k => !(KELOMPOK_FIELD as readonly string[]).includes(k));
      expect([...new Set(asing)]).toEqual([]);
    });
  });
});

// ── Dampak ke PO ─────────────────────────────────────────────
// PO menyalin `dt` dari Final Survey, jadi revisi ini WAJIB ikut
// terlihat di PO: field yang dihapus tidak boleh tercetak, dan
// label Floors/Stops/Doors harus konsisten.

describe('Revisi tahap 1 ikut diterapkan ke PO', () => {
  const po: BahanCetakPo = {
    id: 'po-1', no_po: '001/PO/LIFT/BAI/XI/2026', tgl_po: '2026-11-20',
    kode_proyek: 'BAI-01', nama_prospek: 'STEVEN_CAKUNG', pabrik: 'Pabrik A',
    pic: 'Dewo', rev_terakhir: 1, catatan: null,
  } as unknown as BahanCetakPo;

  const revisi: PoRevisiRow[] = [{
    rev: 1, tgl_revisi: '2026-11-20', oleh: 'Dewo', alasan: null, jml_perubahan: 0,
    dt: {
      jenisLift: 'Home Lift', kapasitas: '450', kecepatan: '0.6', sfd: '3/3/3',
      shaftSize: '1550 x 1800', pitDepth: '550', tipePintu: 'Center Opening',
      bukaanPintu: '800', cabinSize: '1200 x 1000', bahanCabin: 'Stainless',
      power: '380 3ph',
      // Nilai lama yang MASIH tersimpan di dokumen lama:
      dayaMesin: '3,7 kW', mesinMerk: 'Ziehl-Abegg', posisiMesin: 'Atas (Machine Room)',
      drive: 'VVVF',
    },
  } as unknown as PoRevisiRow];

  it('field yang dihapus klien TIDAK tercetak di PO', () => {
    const html = htmlPo(po, revisi);
    for (const { label } of DIHAPUS) {
      expect(html, `${label} masih tercetak di PO`).not.toContain(label);
    }
  });

  it('nilai lama field yang dihapus tidak ikut tercetak', () => {
    const html = htmlPo(po, revisi);
    expect(html).not.toContain('Ziehl-Abegg');
    expect(html).not.toContain('3,7 kW');
  });

  it('Power Supply 380 3ph tercetak di PO', () => {
    expect(htmlPo(po, revisi)).toContain('380 3ph');
  });

  it('label Floors / Stops / Doors tercetak, bukan urutan lama', () => {
    const html = htmlPo(po, revisi);
    expect(html).toContain('Floors / Stops / Doors');
    expect(html).not.toContain('Stops / Floors / Doors');
  });

  it('ringkasan teks PO memakai Floors/Stops/Doors dan tanpa Daya mesin', () => {
    const t = teksRingkasPo(po, revisi);
    expect(t).toContain('Floors/Stops/Doors');
    expect(t).not.toContain('Stops/Floors/Doors');
    expect(t).not.toContain('Daya mesin');
    expect(t).toContain('380 3ph');
  });
});
