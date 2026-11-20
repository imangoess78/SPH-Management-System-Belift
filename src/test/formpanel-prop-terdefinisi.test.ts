import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * PENJAGA REGRESI untuk blank page SPK.
 *
 * Bug aslinya: `<TerminPanel ... setTanggalTermin={setTanggalTermin} />` ditulis
 * padahal `setTanggalTermin` tidak pernah di-destructure di `FormPanel`.
 * Hasilnya `ReferenceError` saat render → halaman blank putih. `tsc` lolos
 * karena nama yang tidak terdefinisi di JSX hanya error saat runtime.
 *
 * Tes ini memeriksa kode sumber secara statis: setiap identifier yang dipakai
 * sebagai prop `={...}` harus terdefinisi di komponen yang memakainya.
 */

const SRC = readFileSync('src/pages/SPHForm.tsx', 'utf8');

/** Ambil badan sebuah function component (dari `function Nama(` sampai penutupnya). */
function badanKomponen(nama: string): string {
  const mulai = SRC.indexOf('function ' + nama + '(');
  expect(mulai, 'komponen ' + nama + ' tidak ditemukan').toBeGreaterThan(-1);
  // Cari return ( JSX pertama setelahnya; ambil sampai akhir berkas sebagai batas aman.
  return SRC.slice(mulai);
}

describe('FormPanel — prop yang dipakai harus terdefinisi', () => {
  const badan = badanKomponen('FormPanel');
  const destructure = badan.slice(0, badan.indexOf('return ('));
  const jsx = badan.slice(badan.indexOf('return ('), badan.indexOf('function Grp'));

  it('setTanggalTermin di-destructure (bug blank page)', () => {
    expect(destructure).toContain('setTanggalTermin,');
  });

  it('setTanggalTermin ada di tipe FormPanelProps', () => {
    const tipe = SRC.slice(SRC.indexOf('interface FormPanelProps'), SRC.indexOf('function Grp'));
    expect(tipe).toContain('setTanggalTermin:');
  });

  it('setS ada di tipe dan diteruskan dari induk (dipakai EditorSpk)', () => {
    const tipe = SRC.slice(SRC.indexOf('interface FormPanelProps'), SRC.indexOf('function Grp'));
    expect(tipe, 'setS harus ada di FormPanelProps').toContain('setS:');
    // Pemanggilan <FormPanel ... setS={setS} />
    const panggil = SRC.slice(SRC.indexOf('<FormPanel'), SRC.indexOf('/>', SRC.indexOf('<FormPanel')));
    expect(panggil, 'induk harus mengoper setS').toContain('setS={setS}');
  });

  it('Setiap prop yang dioper ke komponen anak terdefinisi', () => {
    // Ambil semua tag komponen anak <Nama ... /> di dalam FormPanel, lalu periksa
    // setiap prop berbentuk nama={identifier} harus terdefinisi di FormPanel
    // (entah lewat destructure props, atau variabel lokal).
    const anak = [...jsx.matchAll(/<(TerminPanel|Grp|Fsel|Ftxt|EditorSpk|ItemPanel|DesainPanel)\b[\s\S]*?\/>/g)]
      .map(m => m[0]);
    expect(anak.length, 'tidak ada komponen anak terdeteksi').toBeGreaterThan(2);

    const destructured = new Set(
      (destructure.match(/[{,]\s*([a-zA-Z_$][\w$]*)/g) || []).map(x => x.replace(/[{,\s]/g, '')),
    );
    // Variabel lokal di badan komponen (const/let/function)
    const lokal = new Set(
      [...badan.matchAll(/\b(?:const|let|function)\s+([a-zA-Z_$][\w$]*)/g)].map(m => m[1]),
    );
    const tersedia = new Set([...destructured, ...lokal]);

    const dipakai = new Set<string>();
    anak.forEach(tag => {
      // hanya prop sebelum '>' pertama
      const kepala = tag.slice(0, tag.indexOf('>') + 1);
      [...kepala.matchAll(/\s([a-zA-Z_$][\w$]*)=\{\s*([a-zA-Z_$][\w$]*)\s*\}/g)]
        .forEach(m => dipakai.add(m[2]));
    });

    const hilang = [...dipakai].filter(n => !tersedia.has(n));
    expect(hilang, 'prop dipakai tapi tidak terdefinisi: ' + hilang.join(', ')).toEqual([]);
  });
});
