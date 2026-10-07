/**
 * UJI KEAMANAN GANTI PASSWORD — memakai SQLITE SUNGGUHAN.
 *
 * Alasannya sama seperti uji pemulihan: yang diuji adalah apakah perintah
 * SQL-nya benar-benar jalan dan datanya benar-benar kembali sesuai aturan.
 * Tiruan hanya membuktikan tiruannya sesuai harapan saya sendiri.
 *
 * Yang diuji di sini adalah mesin yang dipakai fitur ganti-password dan
 * lupa-password (fungsi-fungsi di functions/lib/keamanan.ts):
 *
 *   1. Password disimpan sebagai hash — teks aslinya tidak pernah masuk DB.
 *   2. Password yang salah TIDAK cocok; yang benar cocok.
 *   3. Kode reset hanya tersimpan sebagai hash, dan cocokSandi menemukannya.
 *   4. `kodeHidup` menghormati tiga keadaan mati: dipakai, dibatalkan,
 *      kedaluwarsa — masing-masing diuji terpisah karena ketiganya jalur
 *      yang berbeda di dalam query.
 *   5. Satu akun hanya punya SATU kode hidup (yang terbaru menang).
 *   6. Pembatas percobaan benar-benar menutup setelah batasnya, jendelanya
 *      bisa dipulihkan setelah lewat waktu, dan `lupakanPercobaan`
 *      membersihkan penghitung sesudah berhasil.
 *   7. Kode reset memakai acak crypto, selalu 8 angka, tidak seluruhnya
 *      sama (kalau sumber acaknya rusak, uji ini yang menangkapnya).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import {
  hashSandi, cocokSandi, samaAman, kodeBaru, kodeHidup, sisaDetikKode,
  catatPercobaan, lupakanPercobaan, periksaSandiBaru, KODE_BERLAKU_MENIT,
  MIN_PANJANG, catatKeamanan,
} from '../../functions/lib/keamanan';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Jembatan tipis: bikin DatabaseSync tampil seperti D1.
 *
 * Cukup untuk prepare().bind().first()/run() yang dipakai lib keamanan.
 * Dipakai supaya kode produksi yang diuji tetap kode yang sama — bukan
 * salinannya. `run()` mengembalikan `changes` seperti D1, karena beberapa
 * pemanggil memakainya untuk melaporkan jumlah sesi yang diputus.
 */
function keD1(sqlite: DatabaseSync): D1Database {
  const buat = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => buat(sql, a),
    first: async () => (sqlite.prepare(sql).get(...(args as never[])) ?? null) as never,
    run: async () => {
      const r = sqlite.prepare(sql).run(...(args as never[]));
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return { prepare: (sql: string) => buat(sql) } as unknown as D1Database;
}

/** Skema diambil dari berkas migrasi aslinya, bukan disalin ulang. */
const MIGRASI = readFileSync(
  resolve(process.cwd(), 'migration/d1/2026-10-07-reset-password.sql'),
  'utf8',
);

function siapkan() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(MIGRASI);
  sqlite.exec(`CREATE TABLE app_users (
    id TEXT PRIMARY KEY, email TEXT, password_hash TEXT, status TEXT DEFAULT 'approved'
  );`);
  return { sqlite, env: { sph_management_db: keD1(sqlite) } };
}

let db: ReturnType<typeof siapkan>;

beforeEach(() => { db = siapkan(); });

// ── 1 & 2. Password ─────────────────────────────────────────

describe('penyimpanan password', () => {
  it('hanya hash yang tersimpan — password asli tidak ada di database', async () => {
    const sandi = 'Rahasia2026ku';
    const hash = await hashSandi(sandi);

    expect(hash).not.toContain(sandi);
    expect(hash).toMatch(/^[^$]+\$[^$]+$/); // '<garam>$<hash>'
  });

  it('dua penyimpanan password yang sama menghasilkan hash berbeda (garam acak)', async () => {
    const a = await hashSandi('Rahasia2026ku');
    const b = await hashSandi('Rahasia2026ku');
    expect(a).not.toBe(b);

    // Tapi keduanya tetap cocok dengan password yang sama.
    expect(await cocokSandi('Rahasia2026ku', a)).toBe(true);
    expect(await cocokSandi('Rahasia2026ku', b)).toBe(true);
  });

  it('password yang salah tidak cocok', async () => {
    const hash = await hashSandi('Rahasia2026ku');
    expect(await cocokSandi('Rahasia2026kU', hash)).toBe(false); // beda besar-kecil
    expect(await cocokSandi('Rahasia2026ku ', hash)).toBe(false); // spasi di ujung
    expect(await cocokSandi('', hash)).toBe(false);
  });

  it('hash rusak/kosong ditolak, bukan bikin cocok', async () => {
    expect(await cocokSandi('apa saja', '')).toBe(false);
    expect(await cocokSandi('apa saja', 'tanpa-pemisah')).toBe(false);
  });

  it('samaAman: panjang berbeda tetap tidak sama', async () => {
    // Ini yang bikin kode reset 8 angka tidak bisa dipakai untuk kode 7 angka.
    expect(samaAman('12345678', '1234567')).toBe(false);
    expect(samaAman('12345678', '12345678')).toBe(true);
  });
});

// ── 3. Kode reset tersimpan sebagai hash ────────────────────

describe('kode reset', () => {
  it('selalu 8 angka, dan tidak seluruhnya sama', () => {
    const kode = kodeBaru();
    expect(kode).toMatch(/^\d{8}$/);
    expect(kode).not.toMatch(/^(\d)\1{7}$/);
  });

  it('20 kode berturut-turut tidak ada yang kembar', () => {
    // Sumber acak yang rusak (mis. selalu mengembalikan angka yang sama)
    // akan langsung kelihatan di sini.
    const himpunan = new Set(Array.from({ length: 20 }, () => kodeBaru()));
    expect(himpunan.size).toBe(20);
  });

  it('kode mentah tidak masuk database — hanya hash-nya yang cocok', async () => {
    const kode = kodeBaru();
    db.sqlite.prepare(
      `INSERT INTO app_reset_kode (id,user_id,kode_hash,created_at,expires_at)
       VALUES (?,?,?,?,?)`
    ).run('k1', 'u1', await hashSandi(kode),
      new Date().toISOString(), new Date(Date.now() + 60000).toISOString());

    const baris = db.sqlite.prepare('SELECT kode_hash FROM app_reset_kode WHERE id=?').get('k1') as
      { kode_hash: string };
    expect(baris.kode_hash).not.toContain(kode);

    expect(await cocokSandi(kode, baris.kode_hash)).toBe(true);
    // Kode lain (beda satu angka) ditolak.
    const lain = String((Number(kode) + 1) % 100000000).padStart(8, '0');
    expect(await cocokSandi(lain, baris.kode_hash)).toBe(false);
  });
});

// ── 4 & 5. Kode hidup: tiga cara mati, dan satu hidup per akun ──

describe('kodeHidup', () => {
  const isi = async (id: string, opsi: {
    dipakai?: string | null; dibatalkan?: string | null;
    expiresMs?: number; dibuatMs?: number;
  } = {}) => {
    const sekarang = new Date().toISOString();
    db.sqlite.prepare(
      `INSERT INTO app_reset_kode
       (id,user_id,kode_hash,dibuat_oleh,dibuat_nama,created_at,expires_at,dipakai_at,dibatalkan_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    ).run(
      id, 'u1', await hashSandi('12345678'), 'admin-1', 'Admin',
      new Date(Date.now() + (opsi.dibuatMs ?? 0)).toISOString(),
      new Date(Date.now() + (opsi.expiresMs ?? 600000)).toISOString(),
      opsi.dipakai ?? null, opsi.dibatalkan ?? null,
    );
    void sekarang;
  };

  it('kode yang masih berlaku dianggap hidup', async () => {
    await isi('k1');
    expect(await kodeHidup(db.env as never, 'u1')).not.toBeNull();
  });

  it('kode yang sudah DIPAKAI tidak dianggap hidup', async () => {
    await isi('k1', { dipakai: new Date().toISOString() });
    expect(await kodeHidup(db.env as never, 'u1')).toBeNull();
  });

  it('kode yang DIBATALKAN tidak dianggap hidup', async () => {
    await isi('k1', { dibatalkan: new Date().toISOString() });
    expect(await kodeHidup(db.env as never, 'u1')).toBeNull();
  });

  it('kode yang KEDALUWARSA tidak dianggap hidup', async () => {
    await isi('k1', { expiresMs: -1000 });
    expect(await kodeHidup(db.env as never, 'u1')).toBeNull();
  });

  it('hanya SATU kode hidup per akun — yang terbaru yang dipakai', async () => {
    // Kode lama masih berlaku, lalu Admin membuat kode baru. Yang lama
    // seharusnya sudah dibatalkan oleh endpoint; uji ini memastikan
    // kalau pun ada dua baris, yang dikembalikan adalah yang terbaru.
    await isi('lama', { dibuatMs: -60000, expiresMs: 600000 });
    await isi('baru', { dibuatMs: 0, expiresMs: 600000 });

    const hidup = await kodeHidup(db.env as never, 'u1');
    expect(hidup?.id).toBe('baru');
  });

  it('sisaDetikKode melaporkan sisa waktu, dan 0 kalau tidak ada kode', async () => {
    expect(await sisaDetikKode(db.env as never, 'u1')).toBe(0);

    await isi('k1', { expiresMs: 120000 });
    const sisa = await sisaDetikKode(db.env as never, 'u1');
    expect(sisa).toBeGreaterThan(60);
    expect(sisa).toBeLessThanOrEqual(120);
  });

  it('masa berlaku kode 30 menit', () => {
    expect(KODE_BERLAKU_MENIT).toBe(30);
  });
});

// ── 6. Pembatas percobaan ───────────────────────────────────

describe('pembatas percobaan', () => {
  it('mengizinkan sampai batas, lalu menutup', async () => {
    const batas = 3;
    for (let i = 0; i < batas; i++) {
      const r = await catatPercobaan(db.env as never, 'lupa:ip:1.2.3.4', batas, 15);
      expect(r.boleh).toBe(true);
    }
    const kelebihan = await catatPercobaan(db.env as never, 'lupa:ip:1.2.3.4', batas, 15);
    expect(kelebihan.boleh).toBe(false);
    expect(kelebihan.tungguDetik).toBeGreaterThan(0);
  });

  it('penghitung per akun+IP tidak saling mengunci antar IP', async () => {
    // Kantor berbagi satu IP dan banyak akun; akun lain dari IP lain harus
    // tetap bisa mencoba. Kalau penghitungnya salah kunci, uji ini gagal.
    for (let i = 0; i < 5; i++) await catatPercobaan(db.env as never, 'lupa:akun:a@b.c:1.1.1.1', 5, 15);
    const lain = await catatPercobaan(db.env as never, 'lupa:akun:a@b.c:2.2.2.2', 5, 15);
    expect(lain.boleh).toBe(true);
  });

  it('jendela yang sudah lewat memulai penghitungan baru', async () => {
    await catatPercobaan(db.env as never, 'kunci', 1, 15);
    // Habiskan jendela dengan memundurkan reset_at, seperti waktu berjalan.
    db.sqlite.prepare('UPDATE app_percobaan SET reset_at=? WHERE kunci=?')
      .run(new Date(Date.now() - 1000).toISOString(), 'kunci');

    const lagi = await catatPercobaan(db.env as never, 'kunci', 1, 15);
    expect(lagi.boleh).toBe(true);
  });

  it('lupakanPercobaan membersihkan penghitung setelah berhasil', async () => {
    await catatPercobaan(db.env as never, 'kunci', 1, 15);
    expect((await catatPercobaan(db.env as never, 'kunci', 1, 15)).boleh).toBe(false);

    await lupakanPercobaan(db.env as never, 'kunci');
    expect((await catatPercobaan(db.env as never, 'kunci', 1, 15)).boleh).toBe(true);
  });
});

// ── 7. Aturan password baru ─────────────────────────────────

describe('periksaSandiBaru', () => {
  it('menolak yang terlalu pendek', () => {
    expect(periksaSandiBaru('a'.repeat(MIN_PANJANG - 1))).toMatch(/minimal/i);
    expect(periksaSandiBaru('a1b2c3d')).toMatch(/minimal/i); // 7 karakter
  });

  it('menerima yang cukup panjang dan tidak mudah ditebak', () => {
    expect(periksaSandiBaru('Kantor2026Banda')).toBeNull();
  });

  it('menolak daftar password yang mudah ditebak', () => {
    expect(periksaSandiBaru('password123')).toMatch(/mudah ditebak/i);
    expect(periksaSandiBaru('belift123')).toMatch(/mudah ditebak/i);
  });

  it('menolak password yang memuat alamat email', () => {
    expect(periksaSandiBaru('budi12345', 'budi@belift.co.id')).toMatch(/email/i);
  });

  it('menolak spasi di ujung dan karakter berulang', () => {
    expect(periksaSandiBaru(' SandiBagus2026 ')).toMatch(/spasi/i);
    expect(periksaSandiBaru('SandiBagus2026 ')).toMatch(/spasi/i);
    expect(periksaSandiBaru('aaaaaaaa')).toMatch(/berulang/i);
  });

  it('menolak deret beruntun yang tidak ada di daftar terlarang', () => {
    // Sengaja BUKAN '123456789': angka itu sudah ditolak lebih dulu sebagai
    // "terlalu mudah ditebak", sehingga aturan deret tidak sempat teruji.
    // Deret di bawah ini lolos daftar terlarang, jadi yang menangkapnya
    // benar-benar aturan beruntun.
    expect(periksaSandiBaru('23456789')).toMatch(/berurutan/i);
    expect(periksaSandiBaru('98765432')).toMatch(/berurutan/i);
    expect(periksaSandiBaru('hgfedcba')).toMatch(/berurutan/i);
  });
});

// ── 8. Riwayat keamanan ─────────────────────────────────────

describe('catatKeamanan', () => {
  it('mencatat peristiwa dan tidak melempar kalau tabelnya bermasalah', async () => {
    await catatKeamanan(db.env as never, {
      userId: 'u1', email: 'budi@belift.co.id', jenis: 'kode_reset_dibuat',
      olehUserId: 'admin-1', olehNama: 'Admin', catatan: 'berlaku 30 menit',
    });

    const baris = db.sqlite.prepare(
      'SELECT user_id, jenis, oleh_nama FROM app_keamanan_riwayat WHERE user_id=?'
    ).get('u1') as { user_id: string; jenis: string; oleh_nama: string };
    expect(baris.jenis).toBe('kode_reset_dibuat');
    expect(baris.oleh_nama).toBe('Admin');

    // Meja dijatuhkan: pencatatan gagal, tapi pemanggilnya tidak boleh
    // ikut gagal — riwayat tidak boleh lebih penting dari aksinya.
    db.sqlite.exec('DROP TABLE app_keamanan_riwayat');
    await expect(catatKeamanan(db.env as never, {
      userId: 'u1', email: 'budi@belift.co.id', jenis: 'password_direset',
    })).resolves.toBeUndefined();
  });
});
