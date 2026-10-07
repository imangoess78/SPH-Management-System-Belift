import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { keD1 } from './bantu-d1';
import { kirim, PENERIMA, jenisDikenal, type Env } from '../../functions/lib/notifikasi';
import { PERAN, IZIN_PER_PERAN, SEMUA } from '../../shared/akses';

/**
 * Notifikasi — lonceng dalam aplikasi.
 *
 * Dua sifat yang diuji di sini menentukan apakah fitur ini berguna atau
 * justru mengganggu. Keduanya adalah jebakan yang mudah terlewat:
 *
 *   1. KEMBAR. Layar menyimpan dokumen berkali-kali, dan setiap simpan
 *      memanggil `kirim()`. Tanpa penahan, pengawas menerima lima lonceng
 *      untuk satu pekerjaan — dan orang belajar mengabaikan lonceng.
 *
 *   2. PEMBACAAN OLEH ORANG LAIN. Notifikasi memuat arahan pengawas. Kalau
 *      penyaringan penerima bocor, siapa pun yang punya izin halaman bisa
 *      membaca pesan milik orang lain.
 *
 * `kirim()` sengaja TIDAK PERNAH melempar. Sifat itu juga diuji di sini:
 * kegagalan notifikasi tidak boleh menggagalkan aksi utama.
 */

/** Bangun Env di atas SQLite sungguhan, dengan skema yang sama seperti migrasi. */
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

/** Penerima tersimpan sebagai daftar id dipisah koma. */
function penerimaDari(db: DatabaseSync, kunci: string): string[] {
  const r = db.prepare('SELECT penerima FROM app_notifikasi WHERE kunci_event=?').get(kunci) as
    { penerima?: string } | undefined;
  return (r?.penerima || '').split(',').filter(Boolean).sort();
}

describe('notifikasi — anti kembar', () => {
  it('kunci kejadian sama hanya tercatat sekali', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');

    const opsi = {
      jenis: 'lead_baru', kunciEvent: 'lead:abc', judul: 'Lead baru', pesan: 'x',
    };
    const pertama = await kirim(env, opsi);
    const kedua = await kirim(env, opsi);

    // Yang kedua harus menulis NOL baris — itulah penahan kembarnya.
    expect(pertama, 'pemberitahuan pertama tidak tercatat').toBe(1);
    expect(kedua, 'pemberitahuan kembar ikut tercatat').toBe(0);
    const n = db.prepare('SELECT COUNT(*) AS n FROM app_notifikasi').get() as { n: number };
    expect(n.n, 'ada baris kembar di tabel').toBe(1);
  });

  it('kunci berbeda tetap tercatat masing-masing', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');

    await kirim(env, { jenis: 'lead_baru', kunciEvent: 'lead:a', judul: 'A' });
    await kirim(env, { jenis: 'lead_baru', kunciEvent: 'lead:b', judul: 'B' });

    const n = db.prepare('SELECT COUNT(*) AS n FROM app_notifikasi').get() as { n: number };
    expect(n.n, 'kejadian berbeda ikut tertelan penahan kembar').toBe(2);
  });

  it('kunciEvent kosong ditolak tanpa melempar', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');
    const n = await kirim(env, { jenis: 'lead_baru', kunciEvent: '   ', judul: 'x' });
    expect(n).toBe(0);
    const c = db.prepare('SELECT COUNT(*) AS n FROM app_notifikasi').get() as { n: number };
    expect(c.n).toBe(0);
  });
});

describe('notifikasi — penerima', () => {
  it('jenis pengawasan menyasar admin, manager, direktur — bukan staff', async () => {
    const { db, env } = envUji();
    for (const r of ['admin', 'manager', 'direktur', 'staff', 'sales']) tambahPengguna(db, r, r);

    await kirim(env, { jenis: 'lead_baru', kunciEvent: 'k:1', judul: 'Lead baru' });

    const penerima = penerimaDari(db, 'k:1');
    expect(penerima, 'pengawas tidak menerima').toEqual(['admin', 'direktur', 'manager']);
    // Inilah jebakan yang dihindari: `staff` juga memegang izin `lihat_semua`,
    // jadi kalau penerima ditentukan lewat izin itu, staff akan kebanjiran.
    expect(penerima, 'staff menerima pemberitahuan pengawasan').not.toContain('staff');
    expect(penerima, 'sales menerima pemberitahuan pengawasan').not.toContain('sales');
  });

  it('jenis meja dokumen ikut menyertakan staff', async () => {
    const { db, env } = envUji();
    for (const r of ['admin', 'manager', 'direktur', 'staff', 'sales']) tambahPengguna(db, r, r);

    await kirim(env, { jenis: 'dokumen_baru', kunciEvent: 'k:2', judul: 'Dokumen masuk' });

    expect(penerimaDari(db, 'k:2')).toEqual(['admin', 'direktur', 'manager', 'staff']);
  });

  it('akun belum disetujui tidak menerima apa pun', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');
    tambahPengguna(db, 'man', 'manager', 'pending');

    await kirim(env, { jenis: 'lead_baru', kunciEvent: 'k:3', judul: 'x' });

    // Yang disetujui tetap menerima; yang masih `pending` tidak boleh ikut.
    // Kalau akun yang belum disetujui ikut jadi penerima, orang yang belum
    // diverifikasi bisa membaca arahan internal begitu ia diterima.
    expect(penerimaDari(db, 'k:3')).toEqual(['adm']);
  });

  it('peran dicocokkan tanpa peduli besar-kecil huruf dan spasi', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', ' Admin ');

    await kirim(env, { jenis: 'lead_baru', kunciEvent: 'k:4', judul: 'x' });
    expect(penerimaDari(db, 'k:4')).toEqual(['adm']);
  });

  it('penerimaKhusus mengganti bawaan jenis, bukan menambah', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');
    tambahPengguna(db, 'sales1', 'sales');

    await kirim(env, {
      jenis: 'lead_baru', kunciEvent: 'k:5', judul: 'Lead ini milik Anda',
      penerimaKhusus: ['sales1'],
    });

    // Pesan pribadi tidak boleh ikut terkirim ke pengawas.
    expect(penerimaDari(db, 'k:5')).toEqual(['sales1']);
  });

  it('penerimaTambahan menambah di luar bawaan jenis', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');
    tambahPengguna(db, 'sales1', 'sales');

    await kirim(env, {
      jenis: 'lead_baru', kunciEvent: 'k:6', judul: 'x',
      penerimaTambahan: ['sales1', 'sales1', ''],
    });

    // Id kembar dan id kosong dibuang.
    expect(penerimaDari(db, 'k:6')).toEqual(['adm', 'sales1']);
  });
});

describe('notifikasi — tidak pernah menggagalkan aksi utama', () => {
  it('tabel belum dimigrasi: kirim() balas 0, tidak melempar', async () => {
    // Env tanpa tabel sama sekali — meniru keadaan sebelum migrasi dijalankan.
    const db = new DatabaseSync(':memory:');
    const env = { sph_management_db: keD1(db) } as unknown as Env;

    await expect(kirim(env, { jenis: 'lead_baru', kunciEvent: 'k', judul: 'x' }))
      .resolves.toBe(0);
  });

  it('judul dan pesan dipotong, bukan dibiarkan membanjiri kolom', async () => {
    const { db, env } = envUji();
    tambahPengguna(db, 'adm', 'admin');

    await kirim(env, {
      jenis: 'lead_baru', kunciEvent: 'k:panjang',
      judul: 'J'.repeat(500), pesan: 'P'.repeat(2000),
    });

    const r = db.prepare('SELECT judul, pesan FROM app_notifikasi WHERE kunci_event=?')
      .get('k:panjang') as { judul: string; pesan: string };
    expect(r.judul.length).toBeLessThanOrEqual(300);
    expect(r.pesan.length).toBeLessThanOrEqual(600);
  });
});

describe('notifikasi — daftar jenis selaras dengan titik pemicu', () => {
  it('setiap jenis yang dikenal punya penerima', () => {
    for (const jenis of Object.keys(PENERIMA)) {
      expect(jenisDikenal(jenis), `jenis ${jenis} tidak dikenali`).toBe(true);
      expect(PENERIMA[jenis].length, `jenis ${jenis} tanpa penerima`).toBeGreaterThan(0);
    }
  });

  it('jenis di luar daftar tidak dikenali', () => {
    expect(jenisDikenal('entah_apa')).toBe(false);
  });

  it('SEMUA peran bisa membuka halaman notifikasi', () => {
    // Lonceng hanya berguna kalau setiap peran bisa membukanya. Kalau ada
    // satu peran yang jadi penerima tapi tidak punya izin halamannya,
    // pemberitahuan untuknya menumpuk tanpa pernah bisa dibaca.
    for (const peran of PERAN) {
      const izin = IZIN_PER_PERAN[peran];
      const punya = izin === SEMUA || (izin as string[]).includes('notifikasi');
      expect(punya, `peran "${peran}" tidak bisa membuka halaman notifikasi`).toBe(true);
    }
  });

  it('peran bawaan yang menerima pemberitahuan memang punya izin halaman notifikasi', () => {
    // Kalau sebuah peran jadi penerima tapi tidak bisa membuka halaman
    // notifikasi, loncengnya berbunyi untuk orang yang tidak bisa melihatnya.
    const semuaPenerima = new Set(Object.values(PENERIMA).flat());
    for (const peran of semuaPenerima) {
      const izin = IZIN_PER_PERAN[peran as keyof typeof IZIN_PER_PERAN];
      expect(izin, `peran penerima "${peran}" tidak punya bawaan izin`).toBeDefined();
      // `admin` memegang SEMUA ('*'), jadi tidak perlu dicari satu-satu.
      const punya = izin === SEMUA || (izin as string[]).includes('notifikasi');
      expect(
        punya,
        `peran "${peran}" menerima notifikasi tapi tidak bisa membuka halamannya`,
      ).toBe(true);
    }
  });
});
