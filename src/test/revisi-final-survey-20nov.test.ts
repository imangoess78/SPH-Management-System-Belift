// ============================================================
//  REVISI FINAL SURVEY 20 Nov 2026
//  Mengunci hasil kesepakatan dengan klien supaya tidak mundur diam-diam:
//   1. Section Pintu: Finishing Car Door + Finishing Landing Door
//      (Finishing Pintu lama disembunyikan)
//   2. Bahan Konstruksi Shaft, Bahan Cabin, Lantai Cabin, Handrail dan
//      seluruh field Finishing jadi dropdown warna dari Master Data
//   3. Mesin & Kelistrikan: Daya Mesin, Merk Mesin, Posisi Mesin hilang;
//      Power Supply jadi dropdown 220 1ph / 380 3ph
//   4. Spesifikasi Utama: Sistem Penggerak hilang
//   5. Urutan label jadi Floors / Stops / Doors
//  Yang diuji adalah KATALOG (form + cetak memakai katalog yang sama),
//  jadi satu tes di sini mengunci form Final Survey DAN preview PO.
// ============================================================
import { describe, it, expect } from 'vitest';
import {
  DT_FIELDS, DT_FIELDS_TAMPIL, fieldDari, FIELD_WAJIB_KUNCI,
} from '@/lib/survey-types';

const tampil = (key: string) => DT_FIELDS_TAMPIL.find(f => f.key === key);
const semua = (key: string) => fieldDari(key);

describe('Final Survey — revisi 20 Nov 2026', () => {
  it('section Pintu memakai dua field finishing: Car Door & Landing Door', () => {
    const pintu = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Pintu');
    const label = pintu.map(f => f.label);
    expect(label).toContain('Finishing Car Door');
    expect(label).toContain('Finishing Landing Door');
    // Sisa field lama tidak boleh tampil lagi
    expect(label).not.toContain('Finishing Pintu');
    expect(label).not.toContain('Bahan Pintu');
    expect(label).not.toContain('Jumlah Pintu per Lantai');
    expect(label).not.toContain('Sill Pintu');
    // Keduanya dropdown warna
    expect(tampil('finishCarDoor')?.jenis).toBe('warna');
    expect(tampil('finishLandingDoor')?.jenis).toBe('warna');
  });

  it('Finishing Pintu lama tetap ada di katalog sebagai sembunyi (dokumen lama)', () => {
    expect(semua('finishPintu')?.sembunyi).toBe(true);
    expect(tampil('finishPintu')).toBeUndefined();
  });

  // Klien (21 Nov 2026): field MATERIAL tetap material (dropdown pilihan), dan
  // warna jadi field TERPISAH di sebelahnya. Sebelumnya bahan/Handrail dipaksa
  // jadi dropdown warna, sehingga materialnya hilang dari form.
  it('Bahan/Lantai/Handrail tetap material, warna jadi field terpisah', () => {
    const pasangan: [string, string][] = [
      ['bahanShaft', 'warnaShaft'],
      ['bahanCabin', 'warnaCabin'],
      ['lantaiCabin', 'warnaLantaiCabin'],
      ['handrail', 'warnaHandrail'],
    ];
    for (const [material, warna] of pasangan) {
      expect(tampil(material)?.jenis, `${material} harus dropdown material`).toBe('pilih');
      expect(tampil(material)?.opsi?.length, `${material} harus punya daftar material`).toBeGreaterThan(0);
      expect(tampil(warna)?.jenis, `${warna} harus dropdown warna`).toBe('warna');
      // Urutan form: field warna tepat setelah field material-nya.
      const urut = DT_FIELDS_TAMPIL.map(f => f.key);
      expect(urut.indexOf(warna), `${warna} harus tepat setelah ${material}`)
        .toBe(urut.indexOf(material) + 1);
    }
  });

  it('seluruh field kelompok Finishing → warna', () => {
    const fin = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Finishing');
    expect(fin.length).toBeGreaterThan(0);
    const bukanWarna = fin.filter(f => f.jenis !== 'warna').map(f => f.label);
    expect(bukanWarna).toEqual([]);
  });

  it('field warna tidak memakai opsi tetap — opsinya dari Master Data', () => {
    const berwarna = DT_FIELDS_TAMPIL.filter(f => f.jenis === 'warna');
    expect(berwarna.length).toBeGreaterThanOrEqual(8);
    const bawaOpsiSendiri = berwarna.filter(f => (f.opsi?.length ?? 0) > 0).map(f => f.label);
    expect(bawaOpsiSendiri).toEqual([]);
  });

  it('Mesin & Kelistrikan: Daya Mesin, Merk Mesin, Posisi Mesin hilang dari form', () => {
    const label = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Mesin & Kelistrikan').map(f => f.label);
    expect(label).not.toContain('Daya Mesin');
    expect(label).not.toContain('Merk Mesin');
    expect(label).not.toContain('Posisi Mesin');
    // tetap di katalog untuk cetak dokumen lama
    expect(semua('dayaMesin')?.sembunyi).toBe(true);
    expect(semua('mesinMerk')?.sembunyi).toBe(true);
    expect(semua('posisiMesin')?.sembunyi).toBe(true);
  });

  it('Power Supply jadi dropdown 220 1ph / 380 3ph', () => {
    const p = tampil('power');
    expect(p?.jenis).toBe('pilih');
    expect(p?.opsi).toEqual(['220 1ph', '380 3ph']);
  });

  it('Sistem Penggerak hilang dari Spesifikasi Utama', () => {
    const label = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Spesifikasi Utama').map(f => f.label);
    expect(label).not.toContain('Sistem Penggerak');
    expect(semua('drive')?.sembunyi).toBe(true);
  });

  it('urutan label jadi Floors / Stops / Doors', () => {
    expect(tampil('sfd')?.label).toBe('Floors / Stops / Doors');
    expect(tampil('sfd')?.en).toBe('Floors / Stops / Doors');
  });

  it('Daya Mesin tidak lagi wajib diisi', () => {
    expect(FIELD_WAJIB_KUNCI).not.toContain('dayaMesin');
    expect(FIELD_WAJIB_KUNCI).toContain('power');
  });

  it('field pengganti tampil, field lama disembunyikan — bukan sebaliknya', () => {
    const tampilKeys = new Set(DT_FIELDS_TAMPIL.map(f => f.key));
    // Pengganti wajib tampil
    for (const k of ['finishCarDoor', 'finishLandingDoor', 'bahanCabin', 'lantaiCabin', 'handrail', 'bahanShaft']) {
      expect(tampilKeys.has(k), `${k} harus tampil`).toBe(true);
    }
    // Yang digantikan wajib sembunyi, tetapi definisinya tetap ada supaya
    // dokumen lama masih bisa mencetak nilainya.
    for (const k of ['finishPintu', 'finishPintuLantai', 'finishCabin', 'drive', 'dayaMesin', 'mesinMerk', 'posisiMesin']) {
      expect(tampilKeys.has(k), `${k} harus sembunyi`).toBe(false);
      expect(fieldDari(k), `${k} harus tetap ada di katalog`).toBeDefined();
      expect(fieldDari(k)?.sembunyi, `${k} harus ditandai sembunyi`).toBe(true);
    }
  });
});
