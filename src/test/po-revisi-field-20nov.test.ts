// ============================================================
//  PO — DAMPAK REVISI FINAL SURVEY 20 Nov 2026
//  Preview PO mencetak tabel Data Teknis dari katalog yang sama dengan
//  form Final Survey. Tes ini memastikan perubahan katalog benar-benar
//  sampai ke dokumen, DAN dokumen lama tidak kehilangan isinya.
// ============================================================
import { describe, it, expect } from 'vitest';
import { htmlPo } from '@/lib/survey-cetak';
import type { PoRevisiRow } from '@/lib/survey-types';
import type { BahanCetakPo } from '@/lib/survey-cetak';

const po = {
  no_po: 'PO/TEST/2026/001', tgl_po: '2026-11-20', kode_proyek: 'PRJ-1',
  nama_prospek: 'Proyek Uji', pabrik: 'PT. Sinar Cerah Sempurna',
  pic: 'Bpk. Uji', catatan: '', rev_terakhir: 1, status: 'diterbitkan', dibuat_oleh: 'Ops',
} as unknown as BahanCetakPo;

const revisiDengan = (dt: Record<string, unknown>) => ([
  { rev: 1, tgl_revisi: '2026-11-20', oleh: 'Ops', alasan: 'awal', jml_perubahan: 0, dt },
] as unknown as PoRevisiRow[]);

const teks = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('PO — revisi field Final Survey 20 Nov 2026', () => {
  it('mencetak Finishing Car Door & Finishing Landing Door', () => {
    const h = htmlPo(po, revisiDengan({ finishCarDoor: 'Hairline Gold', finishLandingDoor: 'Mirror Silver' }));
    const t = teks(h);
    expect(t).toContain('Car Door Finishing');
    expect(t).toContain('Hairline Gold');
    expect(t).toContain('Landing Door Finishing');
    expect(t).toContain('Mirror Silver');
    // Field lama yang sudah diganti tidak boleh muncul
    expect(t).not.toContain('Door Finishing Hairline SS');
  });

  it('mencetak warna dari Master Data: Bahan Shaft/Cabin, Lantai Cabin, Handrail, Finishing', () => {
    const h = htmlPo(po, revisiDengan({
      bahanShaft: 'Baja WF Putih', bahanCabin: 'Stainless Champagne',
      lantaiCabin: 'Granit Hitam', handrail: 'Rose Gold',
      finishLantai: 'Vinyl Oak', finishDinding: 'Wallpaper Cream',
      finishPlafon: 'Gypsum White', warnaStruktur: 'Charcoal',
      finishingStruktur: 'Powder Coated',
    }));
    const t = teks(h);
    for (const warna of ['Baja WF Putih', 'Stainless Champagne', 'Granit Hitam', 'Rose Gold',
      'Vinyl Oak', 'Wallpaper Cream', 'Gypsum White', 'Charcoal', 'Powder Coated']) {
      expect(t, `${warna} harus tercetak`).toContain(warna);
    }
  });

  it('Power Supply tercetak sebagai nilai dropdown', () => {
    const h = htmlPo(po, revisiDengan({ power: '380 3ph' }));
    expect(teks(h)).toContain('380 3ph');
    expect(teks(h)).toContain('Power Supply');
  });

  it('label urutan baru Floors / Stops / Doors tercetak', () => {
    const h = htmlPo(po, revisiDengan({ sfd: '4/4/4' }));
    expect(teks(h)).toContain('Floors / Stops / Doors');
  });

  it('field yang dihapus TIDAK tercetak bila kosong', () => {
    const h = htmlPo(po, revisiDengan({ jenisLift: 'Passenger', kapasitas: '400' }));
    const t = teks(h);
    expect(t).not.toContain('Machine Brand');
    expect(t).not.toContain('Machine Position');
    expect(t).not.toContain('Motor Power');
    expect(t).not.toContain('Drive System');
    expect(t).not.toContain('Sistem Penggerak');
  });

  it('dokumen LAMA yang masih menyimpan nilai field terhapus tetap mencetaknya', () => {
    // Ini yang melindungi PO yang sudah terbit sebelum revisi: kalau field
    // sembunyi dibuang total dari katalog, nilainya hilang diam-diam.
    const h = htmlPo(po, revisiDengan({
      drive: 'VVVF', dayaMesin: '3.7', mesinMerk: 'Mitsubishi',
      posisiMesin: 'Atas (Machine Room)', finishPintu: 'Hairline SS',
    }));
    const t = teks(h);
    expect(t).toContain('VVVF');
    expect(t).toContain('3.7');
    expect(t).toContain('Mitsubishi');
    expect(t).toContain('Hairline SS');
  });

  it('header tetap Purchase Order tanpa subjudul', () => {
    const h = htmlPo(po, revisiDengan({}));
    expect(h).toContain('Purchase Order');
    expect(h).not.toContain('Pesanan ke Pabrik');
    // Catatan: teks "subdocno" MASIH ada di blok <style> (kelas CSS-nya
    // dibiarkan untuk dokumen lain). Yang harus diperiksa adalah elemennya
    // tidak dirender — cek terhadap body, bukan seluruh dokumen.
    const body = h.slice(h.indexOf('<body'));
    expect(body).not.toContain('class="subdocno"');
  });
});
