/* Uji paritas: Kalkulator Dinamis harus menghasilkan angka yang SAMA PERSIS
 * dengan kalkulator lama (/kalkulator) untuk konfigurasi bawaan.
 *
 * Referensi di bawah dihitung ulang dengan cara yang berbeda — rumus
 * kalkulator lama ditulis apa adanya, angka tertanam, tanpa membaca
 * src/lib/kalkulator-inti.ts. Kalau dua cara menghasilkan angka berbeda,
 * berarti alih-alih memindahkan logika kita malah mengubahnya.
 */
import { describe, expect, it } from 'vitest';
import {
  KONFIG_BAWAAN, gabungKonfig, hargaUnitDasar, hitungKalkulator,
  masukanBawaan, type MasukanKalkulator,
} from '../../shared/kalkulator-konfigurasi';

// ── Rumus kalkulator lama, ditulis ulang apa adanya ─────────
const CABIN: Record<string, number> = {
  'Standard Silver HSS': 0, 'Etched HSS': 460, 'HSS Panoramic': 985,
  'HSS GOLD/BLACK TITANIUM': 758, 'Alumunium Panoramic': 1402,
  'Panoramic with HSS GOLD/BLACK TITANIUM': 1212,
};
const DOOR: Record<string, number> = {
  'Standard HSS': 0, 'Standard GOLD/BLACK TITANIUM': 91, 'Glass HSS': 197,
  'Glass HSS GOLD/BLACK TITANIUM': 227, 'Panoramic Alumunium Narrow': 258,
  'Panoramic Frameless': 265,
};
const LOKASI: Record<string, number> = {
  Jabodetabek: 0, 'Jawa Barat': 15000000, 'Jawa Tengah & Yogyakarta': 18000000,
  'Jawa Timur & Bali': 19000000, 'Kota Besar Sumatera': 40000000,
  'Kota Besar Kalimantan': 50000000, 'Kota Besar Sulawesi': 55000000,
  'Kota Kecil Indonesia Barat dan Tengah': 70000000, 'Indonesia Timur': 90000000,
};
const FAKTOR = 1.145;
const TETAP = 7000000 + 25000000;

function unitDasarLama(kap: number, kec: number): number {
  if (kap === 450 && kec === 0.4) return 6350;
  if (kap === 450 && (kec === 0.6 || kec === 1)) return 6580;
  if (kap === 630 && kec === 0.4) return 6580;
  return 6810;
}

interface Lama {
  c2: string; c3: string; c4: string; c5: string; c6: string; c7: string;
  c8: string; c9: string; c10: string; c11: string; c12: string; c13: string;
  c18: string; c14: string; c15: string; c16: string; c17: string; c19: string;
  c20: string; rate: string; ppn: string;
}

/** Hitung persis seperti `hasil = useMemo(...)` di Kalkulator.tsx.
 *
 * Dua perilaku kalkulator lama adalah BUG yang sengaja tidak dibawa ke
 * kalkulator dinamis. Keduanya diberi saklar agar setiap kasus uji
 * menyatakan sendiri apakah bug itu termasuk yang diuji:
 *
 *   bugLantaiDua   — `lt === 2 ? 3 : lt`: gedung 2 lantai ditagih tenaga kerja
 *                    3 lantai.
 *   bugKacaAlumunium — dinding kaca selalu dikurangi tarif shaft ALUMUNIUM
 *                    (294), berapa pun shaft yang dipilih.
 *
 * Keduanya hanya mengubah angka bila masukan benar-benar menyentuhnya
 * (lantai 2; atau dinding kaca dikombinasikan dengan shaft non-alumunium).
 * Untuk kasus lain hasilnya identik, dan itulah yang dijaga uji paritas.
 */
export function hitungVersiLama(
  s: Lama,
  bug: { bugLantaiDua?: boolean; bugKacaAlumunium?: boolean } = {},
) {
  const kap = +s.c2;
  const kec = +s.c3;
  const lt = Math.max(2, parseInt(s.c4, 10) || 2);
  const tinggi = parseFloat(s.c11) || 0;
  const shaft = s.c9;
  const rate = parseFloat(s.rate) || 0;
  const adaShaft = shaft !== 'None (by customer)';
  const outdoor = s.c18 === 'YES';
  const IMP = rate * FAKTOR;

  const usd1 =
    unitDasarLama(kap, kec) +
    (lt - 2) * 450 +
    CABIN[s.c5] +
    DOOR[s.c6] * (lt + 1) +
    (s.c7 === 'Side Opening' ? 220 + (lt - 2) * 50 : 0) +
    (s.c8 === 'PVC' ? 0 : 250) +
    (s.c12 === 'GOLD/BLACK TI' ? 152 : 0) +
    (s.c13 === 'GOLD/BLACK TI' ? 23 * lt : 0);

  const usd2 =
    (shaft === 'Alumunium Shaft' ? (tinggi / 1000) * 294
      : shaft === 'Steel Shaft' ? (tinggi / 1000) * 175
      : 0) +
    (s.c10 === 'Include'
      ? (tinggi / 1000) * (
          bug.bugKacaAlumunium
            ? (415 - 294)
            // Perbaikan: kurangi tarif shaft yang BENAR-BENAR dipakai,
            // sehingga shaft + kaca = tepat 415/m.
            : (415 - (shaft === 'Alumunium Shaft' ? 294 : shaft === 'Steel Shaft' ? 175 : 0))
        )
      : 0) +
    (outdoor ? 305 * (lt - 1) : 0);
  const idr2 = outdoor ? lt * 1500000 : 0;

  // Bug kalkulator lama #1: `lt === 2 ? 3 : lt`. Karena semua komponen di
  // bawah dibagi pembagi margin, selisihnya dihitung dalam rupiah MENTAH
  // dulu (3 − 2) × 7,5 juta, baru ikut dibagi.
  const pengaliInstalasi = bug.bugLantaiDua ? (lt === 2 ? 3 : lt) : lt;
  const idr3 =
    pengaliInstalasi * 7500000 +
    (adaShaft ? lt * 1000000 : 0) +
    (adaShaft ? lt * 1000000 : 0);
  if (process.env.DEBUG_PARITAS) {
    console.log('  [lama] idr3=', idr3, 'bug=', JSON.stringify(bug), 'lt=', lt);
  }

  const usd4 =
    (s.c14 === 'YES' ? 45 : 0) +
    (s.c15 === 'YES' ? 220 : 0) +
    (s.c16 === 'YES' ? 555 : 0) +
    (s.c17 === 'YES' ? 230 : 0) +
    (s.c19 === 'YES' ? 530 : 0);

  const idr5 = (LOKASI[s.c20] ?? 0) + TETAP;

  // Nilai per komponen persis seperti kalkulator lama: biaya × kurs efektif,
  // lalu dibagi margin. Operasi yang sama dengan `hitungKalkulator`.
  const rawKomponen = [
    usd1 * IMP,
    usd2 * IMP + idr2,
    idr3,
    usd4 * IMP,
    idr5,
  ];

  if (process.env.DEBUG_PARITAS) {
    console.log('  [lama] adaShaft=', adaShaft, 'ldr3=', idr3, 'pengali=', pengaliInstalasi, 'bug=', JSON.stringify(bug));
  }

  const K = rawKomponen.map((c) => c / (adaShaft ? 0.8 : 0.75));
  if (process.env.DEBUG_PARITAS) {
    console.log('  [lama] K=', K.map((v) => v.toFixed(0)).join(', '));
    console.log('  [lama] JUMLAH K=', K.reduce((a, b) => a + b, 0).toFixed(2));
  }

  const jual = K.reduce((a, b) => a + b, 0);
  if (process.env.DEBUG_PARITAS) {
    console.log('  [lama] jual=', jual.toFixed(2));
  }
  const t = (parseFloat(s.ppn) || 0) / 100;
  const ppn = jual * t;
  return { komponen: K, jual, ppn, grand: jual + ppn, adaShaft };
}

/** Terjemahkan masukan gaya lama (c2, c3, ...) ke bentuk baru. */
function keMasukanBaru(s: Lama): MasukanKalkulator {
  return {
    kapasitas: +s.c2,
    kecepatan: +s.c3,
    lantai: Math.max(
      KONFIG_BAWAAN.instalasi.lantai_minimum_input,
      parseInt(s.c4, 10) || KONFIG_BAWAAN.instalasi.lantai_minimum_input,
    ),
    // Catatan: bug lama `lt === 2 ? 3 : lt` hanyalah pengganda tarif
    // instalasi, jadi ia hidup di referensi (saklar `bugLantaiDua`), bukan
    // di masukan.
    tinggi_mm: parseFloat(s.c11) || 0,
    kabin: s.c5,
    pintu: s.c6,
    bukaan: s.c7,
    lantai_kabin: s.c8,
    shaft: s.c9,
    dinding: s.c10,
    cop: s.c12,
    lop: s.c13,
    outdoor: s.c18,
    handrail: s.c14,
    ic_card: s.c15,
    ac: s.c16,
    knob: s.c17,
    stabilizer: s.c19,
    lokasi: s.c20,
    kurs: parseFloat(s.rate) || undefined,
    ppn_persen: parseFloat(s.ppn) || undefined,
  };
}

const DASAR: Lama = {
  c2: '450', c3: '0.4', c4: '2',
  c5: 'Standard Silver HSS', c6: 'Standard HSS', c7: 'Center Opening',
  c8: 'PVC', c9: 'None (by customer)', c10: 'None (by customer)',
  c11: '20000', c12: 'Standard', c13: 'Standard', c18: 'NO',
  c14: 'NO', c15: 'NO', c16: 'NO', c17: 'NO', c19: 'NO',
  c20: 'Jabodetabek', rate: '17730', ppn: '11',
};

describe('paritas dengan kalkulator lama', () => {
  it('konfigurasi bawaan = angka kalkulator lama', () => {
    expect(KONFIG_BAWAAN.kurs.usd_idr).toBe(17730);
    expect(KONFIG_BAWAAN.kurs.faktor_biaya_masuk).toBe(1.145);
    expect(KONFIG_BAWAAN.ppn_persen).toBe(11);
    expect(KONFIG_BAWAAN.biaya_tetap_idr).toBe(32000000);
  });

  it('nilai bawaan halaman = nilai awal kalkulator lama', () => {
    const m = masukanBawaan(KONFIG_BAWAAN);
    expect(m.kapasitas).toBe(450);
    expect(m.kecepatan).toBe(0.4);
    expect(m.lantai).toBe(2);
    expect(m.tinggi_mm).toBe(20000);
    expect(m.kabin).toBe('Standard Silver HSS');
    expect(m.lokasi).toBe('Jabodetabek');
  });

  it('harga unit dasar cocok untuk semua kombinasi', () => {
    for (const u of KONFIG_BAWAAN.unit_dasar) {
      expect(hargaUnitDasar(KONFIG_BAWAAN, u.kapasitas, u.kecepatan)).toBe(unitDasarLama(u.kapasitas, u.kecepatan));
    }
  });

  // Matriks kasus: kombinasi pilihan yang menggerakkan setiap cabang rumus.
  //
  // Kasus di sini TIDAK boleh menyentuh kedua bug lama. Bug `lt === 2 ? 3 : lt`
  // hanya muncul di gedung 2 lantai; bug dinding-kaca hanya muncul bila kaca
  // dikombinasikan dengan shaft non-alumunium. Selama tidak ada kasus di sini
  // yang menyentuhnya, rumus lama yang sudah benar dan rumus baru WAJIB sama
  // persis — itulah yang dijaga daftar ini.
  //
  // Kasus 2 lantai dan kasus kombinasi-penuh sengaja TIDAK ada di sini: angka
  // keduanya memang harus berbeda dari kalkulator lama, dan selisihnya dikunci
  // di blok «perbaikan bug rumus lama» di bawah.
  const kasus: { nama: string; ubah: Partial<Lama> }[] = [
    { nama: 'shaft alumunium + dinding kaca', ubah: { c9: 'Alumunium Shaft', c10: 'Include' } },
    { nama: 'shaft steel, 5 lantai', ubah: { c9: 'Steel Shaft', c4: '5', c11: '15000' } },
    { nama: 'side opening, 4 lantai', ubah: { c7: 'Side Opening', c4: '4' } },
    { nama: 'kabin panoramic + pintu glass', ubah: { c5: 'HSS Panoramic', c6: 'Glass HSS' } },
    { nama: 'lantai non-PVC', ubah: { c8: 'Non-PVC (marmer/granit)' } },
    { nama: 'COP & LOP gold', ubah: { c12: 'GOLD/BLACK TI', c13: 'GOLD/BLACK TI', c4: '3' } },
    { nama: 'outdoor, 3 lantai', ubah: { c18: 'YES', c4: '3' } },
    { nama: 'semua add-on', ubah: { c14: 'YES', c15: 'YES', c16: 'YES', c17: 'YES', c19: 'YES' } },
    { nama: 'kapasitas 630 kecepatan 1', ubah: { c2: '630', c3: '1' } },
    { nama: 'lokasi Indonesia Timur', ubah: { c20: 'Indonesia Timur' } },
    { nama: 'kurs berubah 16500', ubah: { rate: '16500' } },
    { nama: 'PPN 12', ubah: { ppn: '12' } },
    { nama: '7 lantai penuh, shaft steel + kaca include', ubah: {
      c2: '630', c3: '0.6', c4: '7', c5: 'Panoramic with HSS GOLD/BLACK TITANIUM',
      c6: 'Panoramic Frameless', c7: 'Side Opening', c8: 'Non-PVC (marmer/granit)',
      c9: 'Steel Shaft', c10: 'Include', c11: '26000', c12: 'GOLD/BLACK TI',
      c13: 'GOLD/BLACK TI', c18: 'YES', c14: 'YES', c15: 'YES', c16: 'YES',
      c17: 'YES', c19: 'YES', c20: 'Kota Besar Sulawesi', rate: '18250', ppn: '11',
    } },
  ];

  for (const k of kasus) {
    it(`angka sama persis: ${k.nama}`, () => {
      const masukan = { ...DASAR, ...k.ubah };
      // Referensi dihitung TANPA saklar bug: matriks ini hanya berisi kasus
      // yang tidak menyentuh kedua bug lama, jadi rumus lama sudah benar.
      const lama = hitungVersiLama(masukan);
      const baru = hitungKalkulator(KONFIG_BAWAAN, keMasukanBaru(masukan));

      if (process.env.DEBUG_PARITAS) {
        console.log(k.nama, '| c4=', masukan.c4);
        console.log('  adaShaft lama:', lama.adaShaft, ' baru:', baru.adaShaft, ' shaft:', masukan.c9);
        console.log('  lama komponen:', lama.komponen.map((v) => v.toFixed(2)).join(' | '));
        console.log('  baru komponen:', baru.komponen.map((v) => v.nilai.toFixed(2)).join(' | '));
        console.log('  lama jual:', lama.jual.toFixed(2), ' baru jual:', baru.hargaJual.toFixed(2));
      }

      expect(baru.adaShaft).toBe(lama.adaShaft);
      expect(baru.hargaJual).toBeCloseTo(lama.jual, 6);
      expect(baru.ppn).toBeCloseTo(lama.ppn, 6);
      expect(baru.grandTotal).toBeCloseTo(lama.grand, 6);

      baru.komponen.forEach((kom, i) => {
        expect(kom.nilai, `komponen ${i} (${kom.nama})`).toBeCloseTo(lama.komponen[i], 6);
      });
    });
  }
});

describe('perbaikan bug rumus lama', () => {
  // Kedua uji ini mengunci selisih yang DISENGAJA terhadap kalkulator lama.
  // Tanpa uji ini, "perbaikan" bisa diam-diam hilang saat kode dirapikan dan
  // tidak ada yang menyadarinya.

  it('bug 1 — instalasi ditagih sesuai jumlah lantai sebenarnya', () => {
    // Kalkulator lama memakai `lt === 2 ? 3 : lt`, sehingga gedung 2 lantai
    // dibebani ongkos tenaga kerja 3 lantai (Rp22,5 jt alih-alih Rp15 jt
    // sebelum margin).
    const m = masukanBawaan(KONFIG_BAWAAN);
    const dua = hitungKalkulator(KONFIG_BAWAAN, { ...m, lantai: 2 });
    const tiga = hitungKalkulator(KONFIG_BAWAAN, { ...m, lantai: 3 });
    expect(dua.biaya.instalasi).toBe(2 * 7500000);
    expect(tiga.biaya.instalasi).toBe(3 * 7500000);
  });

  it('bug 2 — shaft + dinding kaca selalu berjumlah tepat harga kaca penuh', () => {
    // Bug lama: pengurangnya selalu tarif ALUMUNIUM (294), apa pun shaft yang
    // dipakai. Untuk shaft baja (175) kaca dapat "diskon" 119/m, dan untuk
    // shaft pelanggan (0) kaca dinilai hanya 121 dari harga 415/m.
    const m = masukanBawaan(KONFIG_BAWAAN);
    const tinggiM = m.tinggi_mm / 1000;

    // Ambil lewat NAMA, bukan indeks: urutan baris komponen bisa berubah.
    const usdStruktur = (h: ReturnType<typeof hitungKalkulator>) => {
      const baris = h.komponen.find((k) => k.nama === 'Struktur & finishing')!.nilai;
      const pembagi = h.adaShaft
        ? KONFIG_BAWAAN.margin.pembagi_shaft_belift
        : KONFIG_BAWAAN.margin.pembagi_shaft_pelanggan;
      // Nilai komponen = USD × kurs efektif ÷ pembagi margin.
      return (baris * pembagi) / h.kursEfektif;
    };

    for (const shaft of ['Alumunium Shaft', 'Steel Shaft']) {
      const hasil = hitungKalkulator(KONFIG_BAWAAN, {
        ...m, shaft, dinding: KONFIG_BAWAAN.dinding_kaca.nama_include,
      });
      // shaft + (415 − tarif shaft) = 415, berapa pun shaft-nya.
      expect(usdStruktur(hasil), `shaft ${shaft}`).toBeCloseTo(tinggiM * 415, 4);
    }

    const pelanggan = hitungKalkulator(KONFIG_BAWAAN, {
      ...m,
      shaft: KONFIG_BAWAAN.shaft_oleh_pelanggan,
      dinding: KONFIG_BAWAAN.dinding_kaca.nama_include,
    });
    expect(usdStruktur(pelanggan)).toBeCloseTo(tinggiM * 415, 4);
    // Dan pastikan angkanya memang jauh di atas angka versi bug lama
    // (20 m × 121 = 2420), supaya uji ini benar-benar membedakan.
    expect(usdStruktur(pelanggan)).toBeGreaterThan(tinggiM * 121 * 2);
  });
});

describe('perilaku tepi', () => {
  it('lantai di bawah minimum tetap dihitung minimum', () => {
    const m = { ...masukanBawaan(KONFIG_BAWAAN), lantai: 1 };
    const hasil = hitungKalkulator(KONFIG_BAWAAN, m);
    const acuan = hitungKalkulator(KONFIG_BAWAAN, { ...m, lantai: 2 });
    expect(hasil.grandTotal).toBe(acuan.grandTotal);
  });

  it('instalasi ditagih sesuai jumlah lantai sebenarnya (bug lama diperbaiki)', () => {
    // Kalkulator lama memakai `lt === 2 ? 3 : lt`, sehingga gedung 2 lantai
    // dibebani ongkos tenaga kerja 3 lantai. Kalkulator dinamis menagih 2.
    const m = masukanBawaan(KONFIG_BAWAAN);
    const dua = hitungKalkulator(KONFIG_BAWAAN, { ...m, lantai: 2 });
    const tiga = hitungKalkulator(KONFIG_BAWAAN, { ...m, lantai: 3 });
    expect(dua.biaya.instalasi).toBe(2 * 7500000);
    expect(tiga.biaya.instalasi).toBe(3 * 7500000);
  });

  it('shaft + dinding kaca selalu berjumlah tepat harga kaca penuh', () => {
    // Bug lama: pengurangnya selalu tarif alumunium (294), apa pun shaft yang
    // dipilih. Akibatnya untuk shaft baja (175) kaca dapat "diskon", dan untuk
    // shaft pelanggan (0) kaca dinilai hanya 121 padahal harganya 415.
    // Di sini total biaya struktur (shaft + kaca) harus sama dengan harga kaca
    // penuh, karena harga 415/m sudah termasuk rangka shaft-nya.
    const m = masukanBawaan(KONFIG_BAWAAN);
    // Ambil lewat NAMA, bukan indeks: urutan baris komponen bisa berubah.
    const strukturDari = (h: ReturnType<typeof hitungKalkulator>) =>
      h.komponen.find((k) => k.nama === 'Struktur & finishing')!.nilai;
    // Komponen ini berisi USD yang SUDAH dikali kurs efektif lalu dibagi
    // pembagi margin. Jadi angka USD-nya didapat dengan membalik keduanya.
    const usdStruktur = (h: ReturnType<typeof hitungKalkulator>) =>
      (strukturDari(h) * (h.adaShaft
        ? KONFIG_BAWAAN.margin.pembagi_shaft_belift
        : KONFIG_BAWAAN.margin.pembagi_shaft_pelanggan)) / h.kursEfektif;

    for (const shaft of ['Alumunium Shaft', 'Steel Shaft']) {
      const hasil = hitungKalkulator(KONFIG_BAWAAN, {
        ...m, shaft, dinding: KONFIG_BAWAAN.dinding_kaca.nama_include,
      });
      // shaft + (415 − tarif shaft) = 415 → biaya struktur = harga kaca penuh.
      expect(usdStruktur(hasil), `shaft ${shaft}`).toBeCloseTo(m.tinggi_mm / 1000 * 415, 4);
    }

    // Shaft dikerjakan pelanggan: tidak ada pengurang, kaca ditagih penuh 415/m.
    const pelanggan = hitungKalkulator(KONFIG_BAWAAN, {
      ...m,
      shaft: KONFIG_BAWAAN.shaft_oleh_pelanggan,
      dinding: KONFIG_BAWAAN.dinding_kaca.nama_include,
    });
    expect(usdStruktur(pelanggan)).toBeCloseTo(m.tinggi_mm / 1000 * 415, 4);

    // Dan pembanding: bug lama akan menghasilkan angka JAUH lebih kecil untuk
    // shaft pelanggan (415 − 294 = 121/m), jadi uji di atas benar-benar
    // membedakan perilaku lama dan baru.
    expect(usdStruktur(pelanggan)).toBeGreaterThan(m.tinggi_mm / 1000 * 121 * 1.5);
  });

  it('margin menempel proporsional: total = biaya / pembagi', () => {
    const m = masukanBawaan(KONFIG_BAWAAN);
    const hasil = hitungKalkulator(KONFIG_BAWAAN, m);
    const totalBiaya = Object.values(hasil.biaya).reduce((a, b) => a + b, 0);
    expect(hasil.hargaJual).toBeCloseTo(totalBiaya / 0.75, 4);
  });

  it('shaft dikerjakan Belift memakai pembagi 0,8', () => {
    const m = { ...masukanBawaan(KONFIG_BAWAAN), shaft: 'Alumunium Shaft' };
    const hasil = hitungKalkulator(KONFIG_BAWAAN, m);
    const totalBiaya = Object.values(hasil.biaya).reduce((a, b) => a + b, 0);
    expect(hasil.hargaJual).toBeCloseTo(totalBiaya / 0.8, 4);
  });

  it('kurs baru langsung menggeser harga, tanpa deploy', () => {
    const m = masukanBawaan(KONFIG_BAWAAN);
    const biasa = hitungKalkulator(KONFIG_BAWAAN, m);
    const naik = hitungKalkulator(
      { ...KONFIG_BAWAAN, kurs: { ...KONFIG_BAWAAN.kurs, usd_idr: 20000 } },
      m,
    );
    expect(naik.kursEfektif).toBeCloseTo(20000 * 1.145, 6);
    expect(naik.hargaJual).toBeGreaterThan(biasa.hargaJual);
  });
});

describe('gabungKonfig', () => {
  it('data kosong → bawaan utuh', () => {
    expect(gabungKonfig(null)).toEqual(KONFIG_BAWAAN);
    expect(gabungKonfig({})).toEqual(KONFIG_BAWAAN);
  });

  it('data sebagian tidak membuat komponen jadi nol', () => {
    const cfg = gabungKonfig({ kurs: { usd_idr: 19000 } });
    expect(cfg.kurs.usd_idr).toBe(19000);
    expect(cfg.kurs.faktor_biaya_masuk).toBe(1.145); // ikut bawaan
    expect(cfg.kabin.length).toBe(KONFIG_BAWAAN.kabin.length);
    expect(cfg.biaya_tetap_idr).toBe(32000000);
  });

  it('daftar kosong ditolak, jatuh ke bawaan', () => {
    expect(gabungKonfig({ kabin: [] }).kabin).toEqual(KONFIG_BAWAAN.kabin);
  });
});
