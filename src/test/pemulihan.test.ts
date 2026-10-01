/**
 * UJI PEMULIHAN dengan SQLITE SUNGGUHAN.
 *
 * Kenapa memakai SQLite asli, bukan tiruan: yang sedang diuji adalah apakah
 * perintah SQL-nya benar-benar bisa dijalankan dan datanya benar-benar kembali
 * sama. Tiruan hanya membuktikan tiruannya sesuai harapan saya sendiri — bukan
 * bahwa pemulihannya bekerja.
 *
 * Alur yang diuji utuh:
 *   database asli (ada isi) → backup → hapus database (database "hilang")
 *   → pulihkan dari backup → bandingkan isi sesudah vs sebelum, byte per byte.
 */
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { buatBackup, simpanBackup, URUTAN_PEMULIHAN, bacaSkema, perintahPemulihan } from '../../shared/backup';
import {
  pulihkanBackup, pastikanBukanProduksi, pastikanKosong,
} from '../../shared/pulihkan';
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

/**
 * Jembatan tipis: bikin DatabaseSync tampil seperti D1.
 *
 * Cukup untuk prepare().bind().all()/first()/run() yang dipakai modul backup
 * dan pemulihan. Dipakai supaya kode produksi yang diuji tetap kode yang sama —
 * bukan salinannya.
 */
function keD1(sqlite: DatabaseSync): D1Database {
  const buat = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => buat(sql, a),
    all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) as never[] }),
    first: async () => (sqlite.prepare(sql).get(...(args as never[])) ?? null) as never,
    run: async () => sqlite.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql: string) => buat(sql) } as unknown as D1Database;
}

/** Bucket R2 tiruan: cukup put/get/list/delete. */
function bucketTiruan() {
  const isi = new Map<string, string>();
  const bucket = {
    put: async (k: string, v: string) => { isi.set(k, v); },
    get: async (k: string) => (isi.has(k) ? { text: async () => isi.get(k) as string } : null),
    list: async ({ prefix = '' }: { prefix?: string } = {}) => ({
      objects: Array.from(isi.keys()).filter(k => k.startsWith(prefix))
        .map(k => ({ key: k, size: (isi.get(k) as string).length, uploaded: new Date() })),
    }),
    delete: async (k: string) => { isi.delete(k); },
  };
  return { bucket: bucket as unknown as R2Bucket, isi };
}

/** Database percobaan yang menyerupai produksi: induk + anak + kolom aneka tipe. */
function siapkanDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE profiles (id TEXT PRIMARY KEY, nama TEXT);
    CREATE TABLE crm_ref_sales (id TEXT PRIMARY KEY, nama TEXT, email TEXT);
    CREATE TABLE crm_leads (
      id TEXT PRIMARY KEY, kode_lead TEXT NOT NULL, nama_prospek TEXT,
      sales TEXT REFERENCES crm_ref_sales(id), nilai_sph REAL,
      foto_lokasi TEXT, status_terakhir TEXT, dibuat TEXT
    );
    CREATE TABLE survey_teknis (
      id TEXT PRIMARY KEY, id_lead TEXT REFERENCES crm_leads(id),
      jenis TEXT, terkunci INTEGER, kota TEXT
    );
    CREATE INDEX idx_leads_sales ON crm_leads(sales);
    CREATE INDEX idx_survey_lead ON survey_teknis(id_lead);
  `);
  db.exec(`
    INSERT INTO profiles VALUES ('p1','Admin');
    INSERT INTO crm_ref_sales VALUES ('s1','Budi','budi@x.id');
    INSERT INTO crm_ref_sales VALUES ('s2','Sari','sari@x.id');
  `);
  // Nilai yang gampang rusak kalau pemulihan salah: tanda kutip, unicode,
  // angka desimal, null, dan teks panjang. Bukan data rapi yang kebetulan lolos.
  db.prepare('INSERT INTO crm_leads VALUES (?,?,?,?,?,?,?,?)').run(
    'l1', 'LD-001', 'Hotel "Bintang" — Jl. Merdeka No. 5', 's1', 1234567.89,
    '["foto/a.jpg","foto/b.jpg"]', 'survey', '2026-09-01T10:00:00.000Z');
  db.prepare('INSERT INTO crm_leads VALUES (?,?,?,?,?,?,?,?)').run(
    'l2', 'LD-002', 'Apartemen Ōsaka 東京', 's2', null, null, null, null);
  db.prepare('INSERT INTO survey_teknis VALUES (?,?,?,?,?)').run(
    'v1', 'l1', 'sales', 0, 'Banda Aceh');
  db.prepare('INSERT INTO survey_teknis VALUES (?,?,?,?,?)').run(
    'v2', 'l1', 'final', 1, 'Banda Aceh');
  return db;
}

/** Isi semua tabel sebagai teks, untuk dibandingkan sebelum vs sesudah. */
function rekamIsi(db: DatabaseSync): Record<string, string> {
  const tabel = (db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table'
     AND name NOT LIKE 'sqlite_%' ORDER BY name`).all() as { name: string }[])
    .map(r => r.name);
  const out: Record<string, string> = {};
  for (const t of tabel) {
    const baris = db.prepare(`SELECT * FROM "${t}" ORDER BY rowid`).all();
    out[t] = JSON.stringify(baris);
  }
  return out;
}

describe('pemulihan backup — SQLite sungguhan', () => {
  it('KEHILANGAN DATABASE TOTAL: backup memulihkan isi persis sama', async () => {
    // 1. Database asli, berisi.
    const asli = siapkanDatabase();
    const sebelum = rekamIsi(asli);

    // 2. Backup.
    const backup = await buatBackup(keD1(asli));

    // 3. Database "hilang" — benar-benar dibuang, seperti kejadian sungguhan.
    asli.close();
    const tujuan = new DatabaseSync(':memory:');

    // 4. Pulihkan ke database kosong.
    const laporan = await pulihkanBackup(
      keD1(tujuan), backup, { namaDatabase: 'db-percobaan', urutan: URUTAN_PEMULIHAN });

    // 5. Isi harus IDENTIK dengan sebelum database hilang.
    const sesudah = rekamIsi(tujuan);
    expect(Object.keys(sesudah).sort()).toEqual(Object.keys(sebelum).sort());
    for (const t of Object.keys(sebelum)) {
      expect(sesudah[t], `tabel ${t} tidak sama`).toBe(sebelum[t]);
    }

    // 6. Laporan harus jujur: semua cocok, tanpa selisih.
    expect(laporan.cocok_semua).toBe(true);
    expect(laporan.selisih).toEqual([]);
    expect(laporan.jumlah_tabel).toBe(Object.keys(sebelum).length);
    expect(laporan.skema_dibuat).toBeGreaterThan(0);
    tujuan.close();
  });

  it('nilai yang gampang rusak tetap utuh: kutip, unicode, desimal, null', async () => {
    const asli = siapkanDatabase();
    const backup = await buatBackup(keD1(asli));
    asli.close();

    const tujuan = new DatabaseSync(':memory:');
    await pulihkanBackup(keD1(tujuan), backup,
      { namaDatabase: 'db-percobaan', urutan: URUTAN_PEMULIHAN });

    const baris = tujuan.prepare(
      'SELECT nama_prospek, nilai_sph, foto_lokasi, status_terakhir FROM crm_leads WHERE id=?'
    ).get('l1') as Record<string, unknown>;
    expect(baris.nama_prospek).toBe('Hotel "Bintang" — Jl. Merdeka No. 5');
    expect(baris.nilai_sph).toBe(1234567.89);
    expect(baris.foto_lokasi).toBe('["foto/a.jpg","foto/b.jpg"]');

    const kosong = tujuan.prepare('SELECT * FROM crm_leads WHERE id=?').get('l2') as Record<string, unknown>;
    expect(kosong.nilai_sph).toBeNull();
    expect(kosong.status_terakhir).toBeNull();
    tujuan.close();
  });

  it('index dan kunci asing (foreign key) ikut terbentuk', async () => {
    const asli = siapkanDatabase();
    const backup = await buatBackup(keD1(asli));
    asli.close();
    const tujuan = new DatabaseSync(':memory:');
    await pulihkanBackup(keD1(tujuan), backup,
      { namaDatabase: 'db-percobaan', urutan: URUTAN_PEMULIHAN });

    const idx = (tujuan.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'`
    ).all() as { name: string }[]).map(r => r.name).sort();
    expect(idx).toEqual(['idx_leads_sales', 'idx_survey_lead']);

    // Urutan induk-sebelum-anak membuat foreign key bisa ditegakkan.
    tujuan.exec('PRAGMA foreign_keys = ON');
    expect(() => tujuan.prepare('INSERT INTO survey_teknis VALUES (?,?,?,?,?)')
      .run('v9', 'TIDAK-ADA', 'sales', 0, 'X')).toThrow();
    tujuan.close();
  });

  it('backup TANPA skema ditolak, bukan dipulihkan diam-diam', async () => {
    const tujuan = new DatabaseSync(':memory:');
    // Backup gaya lama: data saja, tanpa skema.
    await expect(pulihkanBackup(
      keD1(tujuan),
      { data: { crm_leads: [{ id: 'l1' }] }, manifest: { tabel: {} } },
      { namaDatabase: 'db-percobaan', urutan: URUTAN_PEMULIHAN },
    )).rejects.toThrow(/tidak memuat skema/i);
    tujuan.close();
  });

  it('DITOLAK bila sasarannya database produksi', async () => {
    const tujuan = new DatabaseSync(':memory:');
    await expect(pulihkanBackup(
      keD1(tujuan), { skema: [{ sql: 'CREATE TABLE a (id TEXT)' }], data: {} },
      { namaDatabase: 'sph-management-db', urutan: [] },
    )).rejects.toThrow(/produksi/i);
    tujuan.close();
  });

  it('DITOLAK bila database tujuan sudah berisi', async () => {
    const tujuan = siapkanDatabase(); // sudah ada isinya
    const backup = await buatBackup(keD1(tujuan));
    await expect(pulihkanBackup(
      keD1(tujuan), backup, { namaDatabase: 'db-percobaan', urutan: URUTAN_PEMULIHAN },
    )).rejects.toThrow(/sudah berisi/i);
    tujuan.close();
  });

  it('penjaga nama menolak berbagai bentuk nama produksi', () => {
    expect(() => pastikanBukanProduksi('sph-management-db')).toThrow();
    expect(() => pastikanBukanProduksi('SPH-Management-DB')).toThrow();
    expect(() => pastikanBukanProduksi('')).toThrow();
    // Yang jelas bukan produksi harus lolos.
    expect(() => pastikanBukanProduksi('sph-management-db-uji')).not.toThrow();
    expect(() => pastikanBukanProduksi('db-percobaan')).not.toThrow();
  });

  it('pastikanKosong membaca jumlah tabel dengan benar', async () => {
    const kosong = new DatabaseSync(':memory:');
    await expect(pastikanKosong(keD1(kosong))).resolves.toBeUndefined();
    const berisi = siapkanDatabase();
    await expect(pastikanKosong(keD1(berisi))).rejects.toThrow();
    kosong.close(); berisi.close();
  });

  it('berkas backup yang DISIMPAN benar-benar memuat skema', async () => {
    // Regresi: sempat terjadi `simpanBackup` hanya menulis manifest+data,
    // sehingga berkas di R2 tidak bisa membangun ulang database.
    const asli = siapkanDatabase();
    const backup = await buatBackup(keD1(asli));
    const { bucket, isi } = bucketTiruan();
    await simpanBackup(bucket, backup);

    const teks = isi.get(backup.kunci) as string;
    const dibaca = JSON.parse(teks);
    expect(Array.isArray(dibaca.skema)).toBe(true);
    expect(dibaca.skema.length).toBeGreaterThan(0);
    const sqlGabung = dibaca.skema.map((x: { sql: string }) => x.sql).join(' ');
    expect(sqlGabung).toContain('CREATE TABLE');
    expect(sqlGabung).toContain('crm_leads');
    asli.close();
  });

  it('pulihkan dari BERKAS yang disimpan (bukan objek di memori)', async () => {
    // Uji paling mirip keadaan darurat: yang tersedia hanya berkas di R2.
    const asli = siapkanDatabase();
    const sebelum = rekamIsi(asli);
    const backup = await buatBackup(keD1(asli));
    const { bucket, isi } = bucketTiruan();
    await simpanBackup(bucket, backup);
    asli.close();

    // Seolah-olah mengambil berkas dari R2 dan membacanya sebagai teks.
    const teks = isi.get(backup.kunci) as string;
    const dariBerkas = JSON.parse(teks);

    const tujuan = new DatabaseSync(':memory:');
    const laporan = await pulihkanBackup(keD1(tujuan), dariBerkas,
      { namaDatabase: 'db-percobaan', urutan: URUTAN_PEMULIHAN });

    const sesudah = rekamIsi(tujuan);
    for (const t of Object.keys(sebelum)) {
      expect(sesudah[t], `tabel ${t} dari berkas tidak sama`).toBe(sebelum[t]);
    }
    expect(laporan.cocok_semua).toBe(true);
    tujuan.close();
  });
});

describe('skema yang dibaca untuk backup', () => {
  it('MEMBUANG tabel internal — kalau ikut, D1 menolak dengan SQLITE_AUTH', async () => {
    // Kejadian nyata: `_cf_KV` ikut terbaca, lalu D1 menolak membuatnya dengan
    // galat "not authorized: SQLITE_AUTH" — dan itu baru ketahuan saat uji
    // pemulihan ke D1 sungguhan, tidak terlihat di uji lokal.
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE _cf_KV (key TEXT PRIMARY KEY, value BLOB) WITHOUT ROWID;
      CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY, name TEXT);
      CREATE TABLE crm_leads (id TEXT PRIMARY KEY, nama TEXT);
      CREATE INDEX idx_nama ON crm_leads(nama);
    `);
    const skema = await bacaSkema(keD1(db));
    const nama = skema.map(x => x.nama).sort();

    expect(nama).not.toContain('_cf_KV');
    expect(nama).not.toContain('d1_migrations');
    // Tabel sungguhan tetap terbawa, termasuk index-nya.
    expect(nama).toContain('crm_leads');
    expect(nama).toContain('idx_nama');
    db.close();
  });

  it('tetap membawa STRUKTUR app_sessions walau isinya sengaja dilewati', async () => {
    // Yang tidak dibawa hanya isinya (sesi login), bukan tabelnya — supaya
    // database hasil pemulihan tetap lengkap dan aplikasi tidak error.
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE app_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE TABLE app_users (id TEXT PRIMARY KEY, email TEXT);
    `);
    const skema = await bacaSkema(keD1(db));
    expect(skema.map(x => x.nama)).toContain('app_sessions');
    db.close();
  });

  it('urutan pembuatan: tabel dulu, index belakangan', async () => {
    // Index merujuk tabel; kalau dibuat lebih dulu, pemulihan gagal.
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE crm_leads (id TEXT PRIMARY KEY, nama TEXT);
      CREATE INDEX idx_nama ON crm_leads(nama);
    `);
    const perintah = perintahPemulihan(await bacaSkema(keD1(db)));
    const iTabel = perintah.findIndex(s => /CREATE TABLE crm_leads/i.test(s));
    const iIndex = perintah.findIndex(s => /CREATE INDEX idx_nama/i.test(s));
    expect(iTabel).toBeGreaterThanOrEqual(0);
    expect(iIndex).toBeGreaterThan(iTabel);
    db.close();
  });
});
