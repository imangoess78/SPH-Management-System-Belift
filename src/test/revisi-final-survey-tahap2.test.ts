import { describe, it, expect } from 'vitest';
import { DT_FIELDS, DT_FIELDS_TAMPIL, fieldDari } from '@/lib/survey-types';
import { htmlPo, teksRingkasPo } from '@/lib/survey-cetak';
import type { BahanCetakPo } from '@/lib/survey-cetak';
import type { PoRevisiRow } from '@/lib/survey-types';

// ============================================================
//  Revisi klien tahap 2 — section Door.
//
//  · Finishing Pintu  -> Finishing Car Door  (field yang SAMA, hanya nama)
//  · Finishing Landing Door                (field BARU, opsi sama)
//
//  Poin paling rawan: field baru TIDAK boleh menumpang kunci lama
//  `finishPintuLantai`, karena kunci itu sudah berisi data lain di
//  dokumen yang sudah ada (terbukti: 2 dari 7 survey berisi
//  'Pintu Kaca SS' dan 'SS'). Kalau ditumpangi, data lama tertimpa.
// ============================================================

const tampil = (key: string) => DT_FIELDS_TAMPIL.find(f => f.key === key);
const semua = (key: string) => fieldDari(key);

describe('Revisi Final Survey tahap 2 — section Door', () => {
  describe('Finishing Pintu menjadi Finishing Car Door', () => {
    it('label form sudah berubah', () => {
      expect(tampil('finishPintu')?.label).toBe('Finishing Car Door');
    });

    it('tetap memakai kunci yang sama (data lama tidak perlu dipindah)', () => {
      expect(tampil('finishPintu')).toBeDefined();
      expect(semua('finishPintu')?.label).toBe('Finishing Car Door');
    });

    it('label lama tidak tersisa di form', () => {
      expect(DT_FIELDS_TAMPIL.map(f => f.label)).not.toContain('Finishing Pintu');
    });

    it('opsi tidak berubah', () => {
      expect(tampil('finishPintu')?.opsi).toEqual(
        ['Hairline SS', 'Mirror SS', 'Titanium', 'Powder Coating', 'Kayu'],
      );
    });

    it('masih di kelompok Pintu', () => {
      expect(tampil('finishPintu')?.kel).toBe('Pintu');
    });
  });

  describe('Finishing Landing Door (field baru)', () => {
    it('ada dan tampil di form', () => {
      expect(tampil('finishLandingDoor')).toBeDefined();
    });

    it('labelnya Finishing Landing Door', () => {
      expect(tampil('finishLandingDoor')?.label).toBe('Finishing Landing Door');
    });

    it('berupa dropdown', () => {
      expect(tampil('finishLandingDoor')?.jenis).toBe('pilih');
    });

    it('opsinya SAMA PERSIS dengan Finishing Car Door', () => {
      expect(tampil('finishLandingDoor')?.opsi).toEqual(tampil('finishPintu')?.opsi);
    });

    it('berada di kelompok Pintu', () => {
      expect(tampil('finishLandingDoor')?.kel).toBe('Pintu');
    });

    it('urutannya tepat SETELAH Finishing Car Door', () => {
      const pintu = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Pintu').map(f => f.key);
      const iCar = pintu.indexOf('finishPintu');
      const iLanding = pintu.indexOf('finishLandingDoor');
      expect(iCar).toBeGreaterThanOrEqual(0);
      expect(iLanding).toBe(iCar + 1);
    });

    it('TIDAK menumpang kunci lama finishPintuLantai', () => {
      expect(semua('finishLandingDoor')?.key).not.toBe('finishPintuLantai');
    });

    it('field lama finishPintuLantai tetap utuh dan tidak disembunyikan', () => {
      expect(semua('finishPintuLantai')?.label).toBe('Finishing Pintu per Lantai');
      expect(semua('finishPintuLantai')?.sembunyi).toBeFalsy();
    });

    it('tidak ada dua field dengan kunci sama', () => {
      const kunci = DT_FIELDS.map(f => f.key);
      expect(kunci.length).toBe(new Set(kunci).size);
    });

    it('label bahasa Inggris tidak bertabrakan dengan field lama', () => {
      // Keduanya tercetak di tabel yang sama; kalau `en` identik, pembaca
      // PO melihat dua baris berlabel sama dengan isi berbeda.
      expect(semua('finishLandingDoor')?.en).not.toBe(semua('finishPintuLantai')?.en);
    });
  });
});

describe('Tahap 2 ikut tercetak di PO', () => {
  const po = {
    id: 'po-1', no_po: '002/PO/LIFT/BAI/XI/2026', tgl_po: '2026-11-20',
    kode_proyek: 'BAI-02', nama_prospek: 'CALVIN_SERPONG', pabrik: 'Pabrik B',
    pic: 'Dewo', rev_terakhir: 1, catatan: null,
  } as unknown as BahanCetakPo;

  const revisi = [{
    rev: 1, tgl_revisi: '2026-11-20', oleh: 'Dewo', alasan: null, jml_perubahan: 0,
    dt: {
      jenisLift: 'Home Lift', kapasitas: '450', kecepatan: '0.6', sfd: '3/3/3',
      tipePintu: 'Center Opening', bukaanPintu: '800',
      finishPintu: 'Mirror SS',
      finishLandingDoor: 'Titanium',
      // Data lama yang sudah ada di dokumen — harus TETAP tercetak.
      finishPintuLantai: 'Pintu Kaca SS',
    },
  }] as unknown as PoRevisiRow[];

  it('Finishing Car Door tercetak', () => {
    expect(htmlPo(po, revisi)).toContain('Car Door Finishing');
  });

  it('Finishing Landing Door tercetak', () => {
    expect(htmlPo(po, revisi)).toContain('Landing Door Finishing');
  });

  it('label lama "Finishing Pintu" tidak tercetak lagi', () => {
    const h = htmlPo(po, revisi);
    expect(h).not.toContain('>Finishing Pintu<');
    // Yang dilarang hanya label yatim "Door Finishing". "Car Door Finishing"
    // dan "Landing Door Finishing" SAH ada, jadi dicocokkan per sel tabel.
    const sel = [...h.matchAll(/<td>([^<]*)<\/td>/g)].map(m => m[1].trim());
    expect(sel).not.toContain('Door Finishing');
    expect(sel).not.toContain('Finishing Pintu');
    expect(sel).toContain('Car Door Finishing');
    expect(sel).toContain('Landing Door Finishing');
  });

  it('data lama finishPintuLantai tidak hilang dari PO', () => {
    expect(htmlPo(po, revisi)).toContain('Pintu Kaca SS');
  });

  it('nilai car door dan landing door tercetak terpisah', () => {
    const h = htmlPo(po, revisi);
    expect(h).toContain('Mirror SS');
    expect(h).toContain('Titanium');
  });

  it('ringkasan teks PO juga memuat keduanya', () => {
    const t = teksRingkasPo(po, revisi);
    expect(t).toContain('Finishing Car Door');
  });
});
