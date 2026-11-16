/* Uji fungsi pembanding riwayat harga (fungsi/api/kalkulator.ts).
 *
 * Riwayat inilah satu-satunya jejak perubahan harga. Kalau ia salah, admin
 * mengira harga tidak berubah padahal berubah — atau sebaliknya, riwayat
 * dibanjiri baris palsu sampai perubahan sungguhan tidak terlihat.
 */
import { describe, expect, it } from 'vitest';
import { bedakan } from '../../shared/kalkulator-konfigurasi';

describe('bedakan', () => {
  it('mendeteksi perubahan satu angka bersarang', () => {
    const lama = { kurs: { usd_idr: 17730, faktor_biaya_masuk: 1.145 } };
    const baru = { kurs: { usd_idr: 18250, faktor_biaya_masuk: 1.145 } };
    expect(bedakan(lama, baru)).toEqual([
      { jalur: 'kurs.usd_idr', dari: 17730, ke: 18250 },
    ]);
  });

  it('tidak menghasilkan baris bila tidak ada yang berubah', () => {
    const cfg = { ppn_persen: 11, kabin: [{ nama: 'A', harga: 0 }] };
    expect(bedakan(cfg, structuredClone(cfg))).toEqual([]);
  });

  it('memakai nama opsi, bukan nomor urut, sebagai label', () => {
    const lama = { kabin: [{ nama: 'Standard', harga: 0 }, { nama: 'Etched', harga: 460 }] };
    const baru = { kabin: [{ nama: 'Standard', harga: 0 }, { nama: 'Etched', harga: 520 }] };
    expect(bedakan(lama, baru)).toEqual([
      { jalur: 'kabin.Etched.harga', dari: 460, ke: 520 },
    ]);
  });

  it('opsi baru muncul sebagai penambahan', () => {
    const lama = { lokasi: [{ nama: 'Jabodetabek', harga: 0 }] };
    const baru = { lokasi: [{ nama: 'Jabodetabek', harga: 0 }, { nama: 'Bali', harga: 19000000 }] };
    const hasil = bedakan(lama, baru);
    expect(hasil).toEqual([{ jalur: 'lokasi.Bali.harga', dari: null, ke: 19000000 }]);
  });

  it('opsi yang dihapus tercatat (ke = null)', () => {
    const lama = { addon: [{ nama: 'AC', harga: 555 }, { nama: 'Knob', harga: 230 }] };
    const baru = { addon: [{ nama: 'AC', harga: 555 }] };
    expect(bedakan(lama, baru)).toEqual([
      { jalur: 'addon.Knob.harga', dari: 230, ke: null },
    ]);
  });

  it('angka yang dikirim sebagai teks tidak dianggap berubah', () => {
    // Form HTML mengirim "11", sedangkan database menyimpan 11.
    expect(bedakan({ ppn_persen: 11 }, { ppn_persen: '11' })).toEqual([]);
  });

  it('kunci yang hilang dibandingkan dengan null', () => {
    expect(bedakan({ a: 1 }, { a: 1, b: 2 })).toEqual([{ jalur: 'b', dari: null, ke: 2 }]);
  });

  it('menangani nilai kosong tanpa melempar galat', () => {
    expect(bedakan(null, null)).toEqual([]);
    expect(bedakan(undefined, { a: 1 })).toEqual([{ jalur: 'a', dari: null, ke: 1 }]);
    expect(bedakan({}, [])).toEqual([]);
  });

  it('beberapa perubahan sekaligus terdaftar semua', () => {
    const lama = { kurs: { usd_idr: 17730 }, ppn_persen: 11, margin: { pembagi_shaft_belift: 0.8 } };
    const baru = { kurs: { usd_idr: 18000 }, ppn_persen: 12, margin: { pembagi_shaft_belift: 0.8 } };
    const jalur = bedakan(lama, baru).map((p) => p.jalur).sort();
    expect(jalur).toEqual(['kurs.usd_idr', 'ppn_persen']);
  });
});
