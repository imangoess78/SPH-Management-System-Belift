import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PENERIMA, jenisDikenal } from '../../functions/lib/notifikasi';

/**
 * Penjaga: setiap `jenis` yang dikirim dari titik pemicu HARUS terdaftar di
 * `PENERIMA`.
 *
 * KENAPA INI DIUJI SEBAGAI TEKS SUMBER, BUKAN PERILAKU:
 *
 * Salah ketik nama jenis tidak menimbulkan galat apa pun. `kirim()`
 * sengaja tidak pernah melempar (lihat functions/lib/notifikasi.ts), dan
 * ada penerima cadangan untuk jenis tak dikenal. Jadi menulis
 * 'lead_baruu' akan:
 *   1. tetap dianggap simpan berhasil,
 *   2. tetap mengirim lonceng — tapi ke penerima cadangan yang belum tentu
 *      orang yang benar,
 *   3. tidak muncul di log mana pun.
 *
 * Kegagalan senyap seperti ini hanya ketahuan saat ada kejadian penting yang
 * tidak sampai ke orangnya. Karena itu daftar `jenis` di titik pemicu dibaca
 * langsung dari berkasnya dan dicocokkan dengan `PENERIMA`.
 */
const SUMBER = ['crm', 'survey', 'po', 'data']
  .map(f => ({ nama: f, isi: readFileSync(resolve(__dirname, `../../functions/api/${f}.ts`), 'utf8') }));

/**
 * Ambil semua nama jenis dari blok `kirim(env, { ... })`.
 *
 * Menyaring hanya `jenis:` di dalam blok `kirim(...)` penting, karena nama
 * `jenis` juga dipakai untuk hal lain di berkas yang sama (mis. jenis
 * survey 'sales'/'final', kolom `survey_teknis.jenis`). Mengambil semuanya
 * akan menghasilkan positif palsu.
 */
function jenisDariPemicu(): { jenis: string; berkas: string }[] {
  const out: { jenis: string; berkas: string }[] = [];
  for (const { nama, isi } of SUMBER) {
    // Setiap pemanggilan `kirim(env, {` ... sampai `});`
    const re = /kirim\(\s*env\s*,\s*\{([\s\S]*?)\n\s*\}\);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(isi))) {
      const blok = m[1];
      // Judul dan pesan boleh memuat kata apa pun, jadi hanya `jenis:` yang
      // diambil — bukan semua string di blok itu.
      const reJenis = /\bjenis:\s*([^\n]+)/g;
      let j: RegExpExecArray | null;
      while ((j = reJenis.exec(blok))) {
      // Ambil HANYA string pertama di sisi kanan `jenis:`.
      //
      // Pada ekspresi bersyarat seperti
      //   jenis: tahap === 'final' ? (mode === 'SPK' ? 'spk_final' : 'sph_final') : 'sph_baru'
      // sisi kanannya memuat 'final' dan 'SPK' yang BUKAN nama jenis — itu
      // pembanding, bukan nilai. Mengambil semua string di baris itu
      // menghasilkan positif palsu. Nilai jenis yang sahih selalu berupa
      // string yang BERDIRI SENDIRI: entah literal di awal baris
      // (`'lead_baru',`) atau hasil terakhir dari setiap cabang ternary.
      // Karena itu yang diambil adalah literal pertama setelah `jenis:`
      // ditambah literal setelah setiap tanda `:` di dalam baris itu.
      const baris = j[1];
      const kandidat = new Set<string>();
      // literal pertama: langsung setelah `jenis:` (mis. 'lead_baru',)
      const awal = baris.match(/^\s*'([a-z_]+)'/);
      if (awal) kandidat.add(awal[1]);
      // literal hasil cabang ternary: 'x' muncul setelah ' ? ' atau ' : '
      for (const c of baris.matchAll(/[?:]\s*\(?\s*'([a-z_]+)'/g)) kandidat.add(c[1]);
      for (const k of kandidat) out.push({ jenis: k, berkas: nama });
      }
    }
  }
  return out;
}

describe('penjaga: jenis di titik pemicu terdaftar di PENERIMA', () => {
  const pemicu = jenisDariPemicu();

  it('setidaknya ada 13 titik pemicu (regresi bila blok kirim terhapus)', () => {
    // 13 = lead baru, lead pindah, dokumen; survey buat(2), survey simpan(2),
    // survey kunci, survey buka; sph baru, sph/spk final; po terbit, po revisi.
    expect(pemicu.length, `hanya ${pemicu.length} titik pemicu terbaca`).toBeGreaterThanOrEqual(13);
  });

  it('setiap jenis yang dipicu terdaftar di PENERIMA', () => {
    const asing = pemicu.filter(p => !jenisDikenal(p.jenis));
    expect(
      asing.map(p => `${p.jenis} (dari ${p.berkas}.ts)`),
      'jenis ini dikirim dari titik pemicu tapi tidak ada di PENERIMA — '
      + 'notifikasinya akan jatuh ke penerima cadangan tanpa ketahuan',
    ).toEqual([]);
  });

  it('setiap kunci PENERIMA benar-benar dipakai (tak ada sisa jenis mati)', () => {
    const dipakai = new Set(pemicu.map(p => p.jenis));
    const mati = Object.keys(PENERIMA).filter(k => !dipakai.has(k));
    expect(
      mati,
      'jenis ini terdaftar tapi tidak ada titik pemicunya — kemungkinan '
      + 'sisa rencana lama yang membuat daftar menyesatkan',
    ).toEqual([]);
  });
});
