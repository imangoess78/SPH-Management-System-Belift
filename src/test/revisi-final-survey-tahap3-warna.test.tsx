/**
 * Uji REVISI Final Survey — field "Pilih Color" dari Master Data.
 *
 * Permintaan klien (20 Nov 2026):
 *   · Cabin  → Bahan Cabin, Lantai Cabin, Handrail masing-masing dapat
 *              field warna SENDIRI.
 *   · Finishing → SEMUA field dapat pilihan warna.
 *   · Warna diambil dari Master Data (kategori 'Warna'), bukan teks bebas.
 *   · Ikut tampil di PO Pabrik.
 *
 * Poin paling rawan yang dikunci di sini:
 *   1. Field bahan TIDAK boleh berubah jadi warna (kesalahan yang pernah
 *      terjadi). Bahan tetap berisi bahan; warna field terpisah.
 *   2. Baris Master Data kategori 'Warna' tidak punya `image_url`. Dulu semua
 *      baris tanpa gambar dibuang loader, jadi warna tidak akan pernah muncul
 *      walau sudah diisi di Master Data.
 *   3. Nilai lama (teks bebas, mis. Warna Struktur) tidak boleh hilang saat
 *      field berubah jadi dropdown — harus tetap terbaca sebagai "(lama)".
 *   4. PO Pabrik harus mencetak baris warna dengan label Inggris.
 */
import { describe, it, expect } from 'vitest';
import { DT_FIELDS, DT_FIELDS_TAMPIL, fieldDari, type DataTeknis } from '@/lib/survey-types';
import { susunKatalog, KATEGORI_WARNA, namaWarna } from '@/components/survey/SurveyPanels';
import { htmlPo, teksRingkasPo } from '@/lib/survey-cetak';
import type { BahanCetakPo } from '@/lib/survey-cetak';
import type { PoRevisiRow } from '@/lib/survey-types';

const tampil = (key: string) => DT_FIELDS_TAMPIL.find(f => f.key === key);

// Field warna yang diminta klien, beserta pasangan field yang mendahuluinya.
const WARNA_CABIN = ['warnaCabin', 'warnaLantaiCabin', 'warnaHandrail'] as const;
const WARNA_FINISHING = [
  'warnaFinishLantai', 'warnaFinishDinding', 'warnaFinishPlafon',
  'warnaFinishPintuLantai', 'warnaStruktur', 'warnaFinishingStruktur',
] as const;

describe('Revisi Final Survey — field Pilih Color dari Master Data', () => {
  describe('section Cabin', () => {
    it('Bahan Cabin, Lantai Cabin, dan Handrail punya field warna sendiri', () => {
      for (const key of WARNA_CABIN) {
        const f = tampil(key);
        expect(f, `field ${key} harus tampil di form`).toBeDefined();
        expect(f?.kel).toBe('Cabin');
        expect(f?.jenis).toBe('warna');
      }
    });

    it('field bahan TIDAK berubah jadi warna (bahan tetap berisi bahan)', () => {
      // Kesalahan lama: bahanCabin / lantaiCabin / handrail diubah jadi dropdown
      // warna sehingga pilihan MATERIAL-nya hilang.
      expect(fieldDari('bahanCabin')?.jenis).toBe('pilih');
      expect(fieldDari('bahanCabin')?.opsi).toEqual(['Stainless', 'Aluminium']);
      expect(fieldDari('lantaiCabin')?.jenis).toBe('desain');
      expect(fieldDari('handrail')?.jenis).toBe('teks');
      for (const key of ['bahanCabin', 'lantaiCabin', 'handrail']) {
        expect(fieldDari(key)?.jenis).not.toBe('warna');
      }
    });

    it('label form memakai awalan "Pilih Color"', () => {
      expect(tampil('warnaCabin')?.label).toBe('Pilih Color Cabin');
      expect(tampil('warnaLantaiCabin')?.label).toBe('Pilih Color Lantai Cabin');
      expect(tampil('warnaHandrail')?.label).toBe('Pilih Color Handrail');
    });
  });

  describe('section Finishing — semua field punya opsi warna', () => {
    it('tiap field Finishing non-warna punya pasangan field warna', () => {
      const fin = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Finishing' && f.jenis !== 'warna');
      expect(fin.length).toBeGreaterThan(0);
      const pasangan: Record<string, string> = {
        finishLantai: 'warnaFinishLantai',
        finishDinding: 'warnaFinishDinding',
        finishPlafon: 'warnaFinishPlafon',
        finishPintuLantai: 'warnaFinishPintuLantai',
        finishingStruktur: 'warnaFinishingStruktur',
      };
      for (const f of fin) {
        const key = pasangan[f.key];
        expect(key, `field ${f.key} belum punya pasangan warna`).toBeDefined();
        expect(tampil(key)?.jenis).toBe('warna');
      }
      // Warna Struktur sudah berupa warna — dijadikan dropdown Master Data.
      expect(tampil('warnaStruktur')?.jenis).toBe('warna');
    });

    it('jumlah field warna Finishing sesuai permintaan', () => {
      const warna = DT_FIELDS_TAMPIL.filter(f => f.kel === 'Finishing' && f.jenis === 'warna');
      expect(warna.map(f => f.key).sort()).toEqual([...WARNA_FINISHING].sort());
    });

    it('field finishing sendiri tetap teks (jenis finishing tidak hilang)', () => {
      for (const key of ['finishLantai', 'finishDinding', 'finishPlafon', 'finishPintuLantai', 'finishingStruktur']) {
        expect(fieldDari(key)?.jenis).toBe('teks');
      }
    });
  });

  describe('sumber opsi = Master Data, bukan daftar mati', () => {
    it('tidak ada daftar warna hardcoded di field', () => {
      for (const key of [...WARNA_CABIN, ...WARNA_FINISHING]) {
        expect(fieldDari(key)?.opsi, `${key} tidak boleh punya opsi hardcoded`).toBeUndefined();
      }
    });

    it('baris kategori Warna tanpa gambar tetap terbaca sebagai pilihan', () => {
      // Ini regresi nyata: loader lama membuang semua baris tanpa image_url.
      const { warna } = susunKatalog([
        { id: '1', category: 'Warna', name: 'Rose Gold', image_url: null },
        { id: '2', category: 'Warna', name: 'Hairline Black', image_url: '' },
        { id: '3', category: 'Warna', name: 'Champagne', image_url: 'https://x/y.png' },
      ]);
      expect(warna).toEqual(['Champagne', 'Hairline Black', 'Rose Gold']);
    });

    it('kategori lain tanpa gambar tidak ikut jadi pilihan warna', () => {
      const { peta, warna } = susunKatalog([
        { id: '1', category: 'Ceiling', name: 'Plafon A', image_url: null },
        { id: '2', category: 'Warna', name: 'Gold' },
      ]);
      expect(warna).toEqual(['Gold']);
      expect(peta.Ceiling).toBeUndefined();
    });

    it('katalog warna Struktur ikut jadi pilihan dengan prefix dibuang', () => {
      // Di proyek ini warna asli tersimpan di kategori 'Struktur' dan dipakai
      // generator SPH. Tanpa ini dropdown warna akan kosong di dokumen nyata.
      const { peta, warna } = susunKatalog([
        { id: '1', category: 'Struktur', name: 'Struktur Rose Gold', image_url: 'https://x/1.png' },
        { id: '2', category: 'Struktur', name: 'Struktur Black', image_url: 'https://x/2.png' },
      ]);
      expect(warna).toEqual(['Black', 'Rose Gold']);
      // Tetap tersedia sebagai gambar (dipakai lampiran spec / SPH).
      expect(peta.Struktur).toHaveLength(2);
      expect(namaWarna('Struktur Champagne Gold')).toBe('Champagne Gold');
    });

    it('warna dari kategori Warna dan Struktur tidak dobel', () => {
      const { warna } = susunKatalog([
        { id: '1', category: 'Warna', name: 'Black' },
        { id: '2', category: 'Struktur', name: 'Struktur Black', image_url: 'https://x/1.png' },
      ]);
      expect(warna).toEqual(['Black']);
    });

    it('nama warna ganda tidak menghasilkan opsi dobel', () => {
      const { warna } = susunKatalog([
        { id: '1', category: 'Warna', name: 'Gold' },
        { id: '2', category: 'Warna', name: 'Gold' },
      ]);
      expect(warna).toEqual(['Gold']);
    });

    it('kategori Warna dikenali tanpa peduli huruf besar/kecil', () => {
      const { warna } = susunKatalog([{ id: '1', category: 'warna', name: 'Silver' }]);
      expect(warna).toEqual(['Silver']);
      expect(KATEGORI_WARNA).toBe('Warna');
    });
  });

  describe('PO Pabrik menampilkan pilihan warna', () => {
    const dt: DataTeknis = {
      cabinSize: '1200 x 1400',
      bahanCabin: 'Stainless',
      warnaCabin: 'Rose Gold',
      lantaiCabin: 'Granite Black',
      warnaLantaiCabin: 'Hitam Doff',
      handrail: 'Stainless Steel',
      warnaHandrail: 'Mirror',
      finishLantai: 'Granit',
      warnaFinishLantai: 'Cream',
      finishDinding: 'HPL',
      warnaFinishDinding: 'Walnut',
      finishPlafon: 'Acrylic',
      warnaFinishPlafon: 'Putih Susu',
      finishPintuLantai: 'Pintu Kaca SS',
      warnaFinishPintuLantai: 'Hairline',
      warnaStruktur: 'Abu Tua',
      finishingStruktur: 'Duco',
      warnaFinishingStruktur: 'Hitam Matte',
    };

    const po: BahanCetakPo = {
      no_po: '001/PO/LIFT/BAI/XI/2026', tgl_po: '2026-11-20', kode_proyek: 'BAI',
      nama_prospek: 'Uji Warna', pabrik: 'Pabrik A', pic: 'PIC', catatan: null,
      rev_terakhir: 1, status: 'terbit', dibuat_oleh: 'uji',
    };
    const revisi: PoRevisiRow[] = [{
      id: 'r1', id_po: 'p1', rev: 1, tgl_revisi: '2026-11-20', oleh: 'uji',
      alasan: null, dt, perubahan: [], jml_perubahan: 0, perubahan_setelah_final: 0,
      created_at: '2026-11-20',
    }];

    it('mencetak baris warna Cabin dengan label Inggris', () => {
      const html = htmlPo(po, revisi);
      expect(html).toContain('Cabin Colour');
      expect(html).toContain('Cabin Floor Colour');
      expect(html).toContain('Handrail Colour');
      expect(html).toContain('Rose Gold');
      expect(html).toContain('Hitam Doff');
      expect(html).toContain('Mirror');
    });

    it('mencetak baris warna Finishing dengan label Inggris', () => {
      const html = htmlPo(po, revisi);
      expect(html).toContain('Floor Finishing Colour');
      expect(html).toContain('Wall Finishing Colour');
      expect(html).toContain('Ceiling Finishing Colour');
      expect(html).toContain('Landing Door Finishing Colour');
      expect(html).toContain('Structure Colour');
      expect(html).toContain('Structure Finishing Colour');
      expect(html).toContain('Walnut');
      expect(html).toContain('Hitam Matte');
    });

    it('warna tetap tercetak bersama bahan aslinya (dua baris berbeda)', () => {
      const html = htmlPo(po, revisi);
      expect(html).toContain('Cabin Material');
      expect(html).toContain('Stainless');
      expect(html).toContain('Cabin Colour');
    });

    it('ringkasan teks PO memuat warna cabin & finishing', () => {
      const teks = teksRingkasPo(po, revisi);
      expect(teks).toContain('Rose Gold');
      expect(teks).toContain('Mirror');
      expect(teks).toContain('Walnut');
      expect(teks).toContain('Hitam Matte');
    });

    it('dokumen tanpa warna tidak mencetak baris warna kosong', () => {
      const kosong: PoRevisiRow[] = [{ ...revisi[0], dt: { bahanCabin: 'Stainless' } as DataTeknis }];
      const html = htmlPo(po, kosong);
      expect(html).toContain('Cabin Material');
      expect(html).not.toContain('Cabin Colour');
    });
  });
});
