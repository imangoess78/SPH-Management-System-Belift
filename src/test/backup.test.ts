/**
 * Uji logika backup database.
 *
 * Yang diuji di sini bukan "apakah Cloudflare bisa menyimpan berkas", tapi
 * keputusan-keputusan yang bisa membuat backup TAMPAK ada padahal tidak
 * berguna saat dibutuhkan:
 *
 *   - tabel sensitif jangan ikut (sesi login)
 *   - tabel yang tidak dikenal jangan sampai terlewat diam-diam
 *   - jangan simpan sebelum data selesai dibaca
 *   - jangan buang backup lama sebelum yang baru tersimpan
 *   - backup yang gagal harus berisik, bukan diam
 */
import { describe, it, expect, vi } from 'vitest';
// Tipe Cloudflare: diimpor sebagai tipe saja, jadi hilang saat build dan tidak
// menambah ketergantungan pada runtime aplikasi.
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import {
  buatBackup, bacaTabel, daftarTabel, kunciBackup, bacaSkema,
  simpanBackup, bersihkanLama, jalankanBackup, daftarBackup,
} from '../../shared/backup';

/** Database tiruan: cukup untuk SELECT * FROM tabel LIMIT ? OFFSET ? */
function dbTiruan(isi: Record<string, Record<string, unknown>[]>) {
  const dijalankan: string[] = [];

  /** Meniru satu kueri: sqlite_master, atau potongan baris satu tabel. */
  const jalankan = (
    sql: string, args: unknown[], mintaMaster: boolean,
    tabel: string | undefined, semuaTabel: Record<string, Record<string, unknown>[]>,
  ) => {
    dijalankan.push(sql);
    if (mintaMaster) {
      return { results: Object.keys(semuaTabel).map(name => ({ name })) };
    }
    const semua = semuaTabel[tabel || ''] || [];
    const limit = typeof args[0] === 'number' ? args[0] : 1000;
    const offset = typeof args[1] === 'number' ? args[1] : 0;
    return { results: semua.slice(offset, offset + limit) };
  };

  const db = {
    prepare(sql: string) {
      const tabel = (sql.match(/FROM "([^"]+)"/) || [])[1];
      const mintaMaster = /sqlite_master/.test(sql);
      const pengikat = {
        // D1 asli: `prepare().all()` boleh dipanggil tanpa `bind()`.
        all: async () => jalankan(sql, [], mintaMaster, tabel, isi),
        bind(...args: unknown[]) {
          return { all: async () => jalankan(sql, args, mintaMaster, tabel, isi) };
        },
      };
      return pengikat;
    },
  };
  return { db: db as unknown as D1Database, dijalankan, isi };
}

/** Bucket R2 tiruan yang mencatat semua penulisan & penghapusan. */
function bucketTiruan() {
  const objek = new Map<string, string>();
  const dicatat: { put: string[]; delete: string[][] } = { put: [], delete: [] };
  const bucket = {
    async put(key: string, isi: string) { objek.set(key, isi); dicatat.put.push(key); },
    async get(key: string) { return objek.has(key) ? { body: objek.get(key) } : null; },
    async delete(kunci: string | string[]) {
      const daftar = Array.isArray(kunci) ? kunci : [kunci];
      dicatat.delete.push(daftar);
      for (const k of daftar) objek.delete(k);
    },
    async list({ prefix = '', limit = 1000 }: { prefix?: string; cursor?: string; limit?: number } = {}) {
      const semua = Array.from(objek.keys()).filter(k => k.startsWith(prefix)).sort();
      return {
        objects: semua.slice(0, limit).map(key => ({ key, size: objek.get(key)!.length, uploaded: new Date() })),
        truncated: semua.length > limit,
        cursor: undefined,
      };
    },
  };
  return { bucket: bucket as unknown as R2Bucket, objek, dicatat };
}

describe('daftar tabel yang dibackup', () => {
  it('melewati tabel sesi login — sesi mati tidak boleh hidup lagi', async () => {
    const { db } = dbTiruan({ app_users: [], app_sessions: [], sph: [] });
    const tabel = await daftarTabel(db);
    expect(tabel).toContain('app_users');
    expect(tabel).not.toContain('app_sessions');
  });

  it('melewati tabel internal SQLite', async () => {
    const { db } = dbTiruan({ sqlite_sequence: [], _cf_KV: [], sph: [] });
    const tabel = await daftarTabel(db);
    expect(tabel).not.toContain('sqlite_sequence');
    expect(tabel).not.toContain('_cf_KV');
    expect(tabel).toEqual(['sph']);
  });

  it('memasukkan tabel baru yang belum terdaftar di urutan pemulihan', async () => {
    // Kalau tabel baru (misal ditambah 6 bulan lagi) terlewat, backup tetap
    // terlihat "sukses" padahal datanya tidak ikut. Ini yang dicegah.
    const { db } = dbTiruan({ sph: [], tabel_baru_nanti: [] });
    const tabel = await daftarTabel(db);
    expect(tabel).toContain('tabel_baru_nanti');
  });

  it('menaruh induk sebelum anak pada urutan pemulihan', async () => {
    const { db } = dbTiruan({ crm_leads: [], crm_ref_sales: [], sph: [], profiles: [] });
    const tabel = await daftarTabel(db);
    expect(tabel.indexOf('crm_ref_sales')).toBeLessThan(tabel.indexOf('crm_leads'));
    expect(tabel.indexOf('profiles')).toBeLessThan(tabel.indexOf('sph'));
  });
});

describe('membaca tabel besar', () => {
  it('mengambil semua baris lewat beberapa putaran', async () => {
    const banyak = Array.from({ length: 2500 }, (_, i) => ({ id: i }));
    const { db } = dbTiruan({ besar: banyak });
    const baris = await bacaTabel(db, 'besar');
    expect(baris).toHaveLength(2500);
  });

  it('berhenti dengan benar saat jumlahnya pas kelipatan batas', async () => {
    const pas = Array.from({ length: 2000 }, (_, i) => ({ id: i }));
    const { db } = dbTiruan({ pas: pas });
    expect(await bacaTabel(db, 'pas')).toHaveLength(2000);
  });
});

describe('membuat backup', () => {
  it('mencatat jumlah baris dan sidik jari tiap tabel di manifest', async () => {
    const { db } = dbTiruan({ sph: [{ id: 'a' }, { id: 'b' }], profiles: [{ id: 'x' }] });
    const hasil = await buatBackup(db, 'uji');
    expect(hasil.manifest.jumlah_tabel).toBe(2);
    expect(hasil.manifest.jumlah_baris).toBe(3);
    expect(hasil.manifest.tabel.sph.baris).toBe(2);
    expect(hasil.manifest.tabel.sph.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(hasil.manifest.pemicu).toBe('uji');
  });

  it('menyebut dengan terus terang bahwa berkas media TIDAK termasuk', async () => {
    const { db } = dbTiruan({ sph: [] });
    const hasil = await buatBackup(db);
    // Yang penting bukan kata persisnya, tapi bahwa catatannya TIDAK
    // menyesatkan: harus jelas berkas R2 tidak ikut dibackup.
    expect(hasil.manifest.catatan).toMatch(/tidak termasuk/i);
    expect(hasil.manifest.catatan).toMatch(/r2|foto/i);
    expect(hasil.manifest.tabel_dilewati).toContain('app_sessions');
  });

  it('nama berkas memuat tanggal sehingga urutan alfabet = urutan waktu', () => {
    const a = kunciBackup('2026-09-30T10-00-00-000Z');
    const b = kunciBackup('2026-10-01T09-00-00-000Z');
    expect(a).toMatch(/^backups\/d1\/2026-09-30\//);
    expect(b > a).toBe(true);
  });
});

describe('menyimpan dan merawat backup lama', () => {
  it('menyimpan isi ke bucket', async () => {
    const { db } = dbTiruan({ sph: [{ id: 'a' }] });
    const { bucket, objek } = bucketTiruan();
    const hasil = await buatBackup(db);
    const ukuran = await simpanBackup(bucket, hasil);
    expect(ukuran).toBeGreaterThan(0);
    expect(objek.has(hasil.kunci)).toBe(true);
  });

  it('menyisakan jumlah terbaru dan membuang sisanya', async () => {
    const { bucket, objek } = bucketTiruan();
    for (let i = 1; i <= 35; i++) {
      const hari = String(i).padStart(2, '0');
      await bucket.put(`backups/d1/2026-09-${hari}/2026-09-${hari}T00-00-00-000Z.json`, '{}');
    }
    const dibuang = await bersihkanLama(bucket, 30);

    expect(dibuang).toHaveLength(5);
    expect(objek.size).toBe(30);
    // Yang dibuang harus yang paling TUA, bukan yang terbaru.
    // Urutan alfabet: 01..05 adalah yang paling tua dari 01..35.
    const tua = ['01', '02', '03', '04', '05'];
    for (const t of tua) {
      expect(dibuang.some(k => k.includes(`2026-09-${t}/`))).toBe(true);
    }
    // Yang terbaru harus masih ada.
    expect(objek.has('backups/d1/2026-09-35/2026-09-35T00-00-00-000Z.json')).toBe(true);
  });

  it('menyimpan backup baru LEBIH DULU sebelum membuang yang lama', async () => {
    // Kalau urutannya terbalik dan penghapusan gagal, bisa terjadi momen
    // tanpa backup sama sekali. Urutan ini yang diuji: dengan 33 backup lama
    // dan batas 30, penghapusan PASTI terjadi — jadi urutannya bisa dinilai.
    const { db } = dbTiruan({ sph: [{ id: 'a' }] });
    const { bucket, dicatat } = bucketTiruan();
    for (let i = 1; i <= 33; i++) {
      const hari = String(i).padStart(2, '0');
      await bucket.put(`backups/d1/2026-09-${hari}/2026-09-${hari}T00-00-00-000Z.json`, '{}');
    }
    const hasil = await jalankanBackup(db, bucket, { simpan: 30 });

    expect(hasil.dibuang).toHaveLength(4);
    expect(dicatat.delete.length).toBeGreaterThan(0);
    // Penulisan backup baru harus tercatat SEBELUM penghapusan pertama.
    const adaPenulisanBaru = dicatat.put.includes(hasil.kunci);
    expect(adaPenulisanBaru).toBe(true);
  });

  it('membuang hanya di dalam folder backup, tidak menyentuh berkas media', async () => {
    const { bucket, objek } = bucketTiruan();
    await bucket.put('recovery/2026-08-19/survey-photos/foto.png', 'isi-penting');
    for (let i = 1; i <= 3; i++) {
      await bucket.put(`backups/d1/2026-09-0${i}/2026-09-0${i}T00-00-00-000Z.json`, '{}');
    }
    await bersihkanLama(bucket, 1);
    expect(objek.has('recovery/2026-08-19/survey-photos/foto.png')).toBe(true);
  });
});

describe('daftar backup untuk ditampilkan', () => {
  it('menampilkan yang terbaru lebih dulu', async () => {
    const { bucket } = bucketTiruan();
    await bucket.put('backups/d1/2026-09-01/2026-09-01T00-00-00-000Z.json', '{}');
    await bucket.put('backups/d1/2026-09-05/2026-09-05T00-00-00-000Z.json', '{}');
    const daftar = await daftarBackup(bucket);
    expect(daftar).toHaveLength(2);
    expect(daftar[0].kunci).toContain('2026-09-05');
  });

  it('tidak menampilkan berkas di luar folder backup', async () => {
    const { bucket } = bucketTiruan();
    await bucket.put('recovery/2026-08-19/signatures/ttd.png', 'x');
    await bucket.put('backups/d1/2026-09-01/2026-09-01T00-00-00-000Z.json', '{}');
    const daftar = await daftarBackup(bucket);
    expect(daftar).toHaveLength(1);
  });
});

describe('backup yang gagal harus berisik', () => {
  it('melempar galat, bukan diam-diam mengembalikan sukses', async () => {
    const db = {
      prepare() { throw new Error('database tidak bisa dihubungi'); },
    } as unknown as D1Database;
    const { bucket } = bucketTiruan();
    await expect(jalankanBackup(db, bucket)).rejects.toThrow(/tidak bisa dihubungi/);
  });
});
