import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { keD1 } from './bantu-d1';
import { kirim, type Env } from '../../functions/lib/notifikasi';

/**
 * Notifikasi — SISI BACA (penyaringan penerima oleh API).
 *
 * ⚠️ Berkas ini lahir dari bug produksi yang nyata.
 *
 * `src/test/notifikasi.test.ts` hanya menguji `kirim()` — sisi TULIS. Tidak
 * ada satu pun tes yang memeriksa bagaimana API MEMBACA kembali barisnya.
 * Celah itu menutupi kesalahan yang sangat merugikan:
 *
 *   Kolom `penerima` disimpan sebagai `a,b,c` — tanpa koma di ujung — tetapi
 *   dibaca dengan `penerima LIKE '%,id,%'`. Pola itu menuntut koma di kedua
 *   SISI id. Akibatnya elemen PERTAMA dan TERAKHIR tidak pernah cocok.
 *
 * Karena id admin selalu berada di urutan pertama (PENGAWAS = admin, manager,
 * direktur), ADMIN — pemilik sistem — tidak melihat satu pun notifikasi,
 * sementara staff yang kebetulan ada di tengah melihat semuanya. Gejalanya
 * menipu: API membalas HTTP 200 dan izin lolos, jadi tak ada galat apa pun
 * yang bisa ditelusuri — hanya daftar yang kosong.
 *
 * Tes di bawah mengunci perilaku BENAR: siapa pun yang namanya ada di kolom
 * `penerima` harus melihat barisnya, DI POSISI MANA PUN ia berada.
 *
 * Uji ini memakai pernyataan SQL yang sama persis dengan `functions/api/notifikasi.ts`.
 * Kalau bentuk penyimpanan atau pola pencariannya berubah, uji ini gagal —
 * itulah maksudnya.
 */

const COCOK_PENERIMA = `(',' || n.penerima || ',') LIKE ?`;
const penerimaSaya = (userId: string) => `%,${userId},%`;

function envUji() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE app_users (id TEXT PRIMARY KEY, email TEXT, full_name TEXT, role TEXT, status TEXT);
    CREATE TABLE app_notifikasi (
      id TEXT PRIMARY KEY, jenis TEXT NOT NULL, kunci_event TEXT NOT NULL,
      judul TEXT NOT NULL, pesan TEXT NOT NULL DEFAULT '', penerima TEXT NOT NULL,
      tautan TEXT NOT NULL DEFAULT '', oleh_nama TEXT NOT NULL DEFAULT '',
      tingkat TEXT NOT NULL DEFAULT 'info', created_at TEXT NOT NULL);
    CREATE TABLE app_notifikasi_baca (
      id_notif TEXT NOT NULL, user_id TEXT NOT NULL, dibaca_at TEXT NOT NULL,
      PRIMARY KEY (id_notif, user_id));
  `);
  return { db, env: { sph_management_db: keD1(db) } as unknown as Env };
}

function tambahPengguna(db: DatabaseSync, id: string, role: string, status = 'approved') {
  db.prepare('INSERT INTO app_users (id,email,full_name,role,status) VALUES (?,?,?,?,?)')
    .run(id, `${id}@contoh.id`, id, role, status);
}

/** Meniru query daftar di `functions/api/notifikasi.ts`. */
function daftarUntuk(db: DatabaseSync, userId: string) {
  return db.prepare(
    `SELECT n.id, n.judul FROM app_notifikasi n
      WHERE ${COCOK_PENERIMA}
      ORDER BY n.created_at DESC`,
  ).all(penerimaSaya(userId)) as { id: string; judul: string }[];
}

/** Meniru query jumlah belum dibaca di `functions/api/notifikasi.ts`. */
function jumlahUntuk(db: DatabaseSync, userId: string) {
  const r = db.prepare(
    `SELECT COUNT(*) AS n FROM app_notifikasi n
      WHERE ${COCOK_PENERIMA}
        AND NOT EXISTS (SELECT 1 FROM app_notifikasi_baca b
                        WHERE b.id_notif=n.id AND b.user_id=?)`,
  ).get(penerimaSaya(userId), userId) as { n: number };
  return r.n;
}

describe('notifikasi — penerima di posisi PERTAMA tetap melihat (bug admin)', () => {
  it('admin di urutan pertama menerima notifikasi SPH/SPK — bukan nol', async () => {
    const { db, env } = envUji();
    // Urutan peran inilah yang membuat id admin selalu berada di depan.
    tambahPengguna(db, 'adm', 'admin');
    tambahPengguna(db, 'mgr', 'manager');
    tambahPengguna(db, 'dir', 'direktur');

    await kirim(env, {
      jenis: 'spk_final', kunciEvent: 'spk:1',
      judul: 'SPK FINAL: PT Contoh', pesan: 'x', olehNama: 'Staf',
    });

    const tersimpan = (db.prepare('SELECT penerima FROM app_notifikasi').get() as { penerima: string }).penerima;
    expect(tersimpan.split(',')[0]).toBe('adm'); // pemastian prasyarat: admin memang di depan

    expect(daftarUntuk(db, 'adm').length).toBe(1);
    expect(jumlahUntuk(db, 'adm')).toBe(1);
  });

  it('penerima di posisi TERAKHIR juga tetap melihat', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');
    tambahPengguna(db, 'mgr', 'manager');
    tambahPengguna(db, 'dir', 'direktur');

    await kirim(env, {
      jenis: 'spk_final', kunciEvent: 'spk:2',
      judul: 'SPK FINAL: PT Contoh', pesan: 'x', olehNama: 'Staf',
    });

    const tersimpan = (db.prepare('SELECT penerima FROM app_notifikasi').get() as { penerima: string }).penerima;
    const terakhir = tersimpan.split(',').at(-1)!;
    expect(terakhir).toBe('dir');

    expect(daftarUntuk(db, 'dir').length).toBe(1);
    expect(jumlahUntuk(db, 'dir')).toBe(1);
  });

  it('SEMUA penerima melihat barisnya, berapa pun panjang daftarnya', async () => {
    const { db, env } = envUji();
    for (const [i, peran] of ['admin', 'manager', 'direktur', 'staff'].entries())
      tambahPengguna(db, `u${i}`, peran);

    await kirim(env, {
      jenis: 'dokumen_baru', kunciEvent: 'dok:1',
      judul: 'Dokumen menunggu', pesan: 'x', olehNama: 'Sales',
    });

    for (const id of ['u0', 'u1', 'u2', 'u3']) {
      expect(daftarUntuk(db, id).length, `${id} seharusnya melihat`).toBe(1);
    }
  });
});

describe('notifikasi — penyaringan tetap ketat', () => {
  it('orang di luar daftar penerima tidak melihat apa pun', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');
    tambahPengguna(db, 'sls', 'sales');

    await kirim(env, {
      jenis: 'spk_final', kunciEvent: 'spk:3',
      judul: 'SPK FINAL: PT Contoh', pesan: 'x', olehNama: 'Staf',
    });

    expect(daftarUntuk(db, 'sls').length).toBe(0);
    expect(jumlahUntuk(db, 'sls')).toBe(0);
  });

  it('id yang menjadi bagian id lain TIDAK ikut cocok', async () => {
    const { db, env } = envUji();
    // Kasus yang mendasari pemakaian koma: 'abc' tidak boleh cocok ke 'abc-1'
    // (atau ke id mana pun yang memuatnya sebagai potongan).
    db.prepare(
      `INSERT INTO app_notifikasi (id,jenis,kunci_event,judul,pesan,penerima,tautan,oleh_nama,tingkat,created_at)
       VALUES ('n1','spk_final','spk:4','Judul','',?, '', '', 'info', '2026-01-01T00:00:00Z')`,
    ).run('abc-1,xyz');

    expect(daftarUntuk(db, 'abc').length).toBe(0);
    expect(daftarUntuk(db, 'abc-1').length).toBe(1);
    expect(daftarUntuk(db, 'xyz').length).toBe(1);
  });

  it('baris tanpa penerima tidak bocor ke siapa pun', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');
    db.prepare(
      `INSERT INTO app_notifikasi (id,jenis,kunci_event,judul,pesan,penerima,tautan,oleh_nama,tingkat,created_at)
       VALUES ('n2','spk_final','spk:5','Judul','', '', '', '', 'info', '2026-01-01T00:00:00Z')`,
    ).run();

    expect(daftarUntuk(db, 'adm').length).toBe(0);
  });

  it('notifikasi yang sudah dibaca tidak lagi dihitung belum dibaca', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');

    await kirim(env, {
      jenis: 'spk_final', kunciEvent: 'spk:6',
      judul: 'SPK FINAL: PT Contoh', pesan: 'x', olehNama: 'Staf',
    });
    expect(jumlahUntuk(db, 'adm')).toBe(1);

    const id = (db.prepare('SELECT id FROM app_notifikasi').get() as { id: string }).id;
    db.prepare('INSERT INTO app_notifikasi_baca (id_notif,user_id,dibaca_at) VALUES (?,?,?)')
      .run(id, 'adm', '2026-01-01T00:00:00Z');

    expect(jumlahUntuk(db, 'adm')).toBe(0);
    expect(daftarUntuk(db, 'adm').length).toBe(1); // tetap terlihat di daftar
  });
});
