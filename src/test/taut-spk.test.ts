/**
 * UJI PERILAKU: Final Survey boleh dimulai dari dokumen SPK.
 *
 * Kenapa SQLite sungguhan, bukan tiruan: yang diuji adalah apakah perintah
 * SQL-nya benar-benar jalan — pencocokan nama, pembuatan lead baru, dan
 * penulisan balik `id_lead` ke dokumen. Tiruan hanya membuktikan tiruannya
 * sesuai harapan saya sendiri.
 *
 * Kenapa memanggil fungsi produksi (functions/lib/taut-spk.ts), bukan
 * salinan: supaya yang diuji adalah kode yang benar-benar dipakai server.
 *
 * Latar masalahnya: dokumen SPK tidak menyimpan `id_lead`, dan halaman
 * "Mulai Final Survey" hanya mencari di `crm_leads`. Jadi meski SPK-nya ada,
 * daftarnya kosong. Modul ini yang menjembatani keduanya.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { keD1 } from './bantu-d1';
import { tautkanSpkKeLead } from '../../functions/lib/taut-spk';
import { keSpkFinal, type BarisSph, type SpkFinal } from '../../shared/spk-dokumen';

let sqlite: DatabaseSync;
let env: { sph_management_db: D1Database };

/**
 * Dokumen SPK seperti tersimpan di D1: kolom `specs` masih TEXT mentah, dan
 * isinya array `{key,label,value}` dengan state form di dalam `value` ber-key
 * `__docstate` (JSON string lagi — jadi dua kali parse). Bentuk ini disalin
 * apa adanya dari baris `sph` produksi; helper tes yang memakai bentuk lain
 * akan lolos tanpa benar-benar menguji apa pun.
 */
function barisSpk(o: {
  id: string; nomor: string; customer: string; kota?: string;
  lead?: string | null; sales?: string; state?: Record<string, unknown>;
}): BarisSph {
  const state = {
    id: o.id,
    mode: 'SPK',
    tanggal: '2026-10-02',
    namaCustomer: o.customer,
    kotaProyek: o.kota ?? '',
    jenisLift: 'Home Lift',
    kapasitas: '400 Kg',
    sales: o.sales ?? 'Imam Solikhin',
    ...(o.state || {}),
  };
  return {
    id: o.id,
    nomor_sph: o.nomor,
    tanggal: '2026-10-02',
    kepada: o.customer,
    nama_pic: 'Bapak/Ibu PIC',
    status: 'final',
    nama_sales: o.sales ?? 'Imam Solikhin',
    id_lead: o.lead ?? null,
    specs: JSON.stringify([
      { key: '__docstate', label: 'Doc State', value: JSON.stringify(state) },
      { key: '__html', label: '', value: '<div class="page">…</div>' },
    ]),
  };
}

function spkDari(o: Parameters<typeof barisSpk>[0]): SpkFinal {
  const s = keSpkFinal(barisSpk(o));
  if (!s) throw new Error('dokumen uji ini tidak terbaca sebagai SPK');
  return s;
}

const adaLead = (id: string) =>
  sqlite.prepare('SELECT id, kode_lead, nama_prospek, status_terakhir, sales FROM crm_leads WHERE id=?')
    .get(id) as { id: string; kode_lead: string; nama_prospek: string; status_terakhir: string; sales: string | null } | undefined;

const idLeadDokumen = (id: string) =>
  (sqlite.prepare('SELECT id_lead FROM sph WHERE id=?').get(id) as { id_lead: string | null } | undefined)?.id_lead ?? null;

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  // Skema asli, disalin dari migration/d1 — hanya kolom yang tersentuh.
  sqlite.exec(`
    CREATE TABLE crm_leads (
      id              TEXT PRIMARY KEY,
      kode_lead       TEXT,
      waktu_masuk     TEXT,
      nama_prospek    TEXT NOT NULL,
      kota            TEXT,
      sales           TEXT,
      status_terakhir TEXT,
      kebutuhan       TEXT,
      catatan         TEXT,
      diubah_oleh     TEXT,
      waktu_diubah    TEXT,
      created_at      TEXT,
      updated_at      TEXT,
      id_proyek       TEXT,
      FOREIGN KEY (sales) REFERENCES crm_ref_sales(nama)
    );
    CREATE TABLE crm_ref_sales (
      nama   TEXT PRIMARY KEY,
      email  TEXT,
      peran  TEXT,
      status TEXT
    );
    CREATE TABLE crm_lead_riwayat (
      id          TEXT PRIMARY KEY,
      id_lead     TEXT NOT NULL,
      waktu       TEXT,
      dari_status TEXT,
      ke_status   TEXT,
      oleh        TEXT,
      catatan     TEXT
    );
    CREATE TABLE sph (
      id        TEXT PRIMARY KEY,
      nomor_sph TEXT,
      tanggal   TEXT,
      kepada    TEXT,
      nama_pic  TEXT,
      status    TEXT,
      nama_sales TEXT,
      jenis_lift TEXT,
      id_lead   TEXT,
      specs     TEXT,
      updated_at TEXT
    );
  `);
  sqlite.exec(`
    INSERT INTO crm_ref_sales (nama, email, peran, status) VALUES
      ('Imam Solikhin', 'imam@belift.co.id', 'Sales', 'Aktif');
  `);
  env = { sph_management_db: keD1(sqlite) };
});

/** Lead siap pakai, dengan kode lead berurutan supaya penomoran bisa diuji. */
function taruhLead(o: { id: string; kode: string; nama: string; kota?: string; lead?: string | null; proyek?: string | null }) {
  sqlite.prepare(
    `INSERT INTO crm_leads (id, kode_lead, nama_prospek, kota, sales, status_terakhir, waktu_masuk, id_proyek, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    o.id, o.kode, o.nama, o.kota ?? null, 'Imam Solikhin', 'SPH Terkirim',
    '2026-01-01T00:00:00.000Z', o.proyek ?? null, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z',
  );
}

function taruhDokumen(o: Parameters<typeof barisSpk>[0]) {
  const b = barisSpk(o);
  sqlite.prepare(
    `INSERT INTO sph (id, nomor_sph, tanggal, kepada, nama_pic, status, nama_sales, id_lead, specs, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(b.id, b.nomor_sph, b.tanggal, b.kepada, b.nama_pic, b.status, b.nama_sales, b.id_lead, b.specs as string, '2026-10-02T00:00:00.000Z');
}

describe('tautkanSpkKeLead — mencari lead yang sudah ada', () => {
  it('memakai id_lead dokumen bila sudah pernah ditautkan', async () => {
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'Budi Santoso' });
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso', lead: 'L1' });

    const h = await tautkanSpkKeLead(spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso', lead: 'L1' }), env);

    expect(h.id_lead).toBe('L1');
    expect(h.kode_lead).toBe('LEAD-0001');
    expect(h.baru).toBe(false);
    expect(h.cara).toBe('id_lead dokumen');
  });

  it('mencocokkan nama customer dengan nama_prospek lead', async () => {
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'PT Contoh Sejahtera' });
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'PT. Contoh Sejahtera' });

    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'PT. Contoh Sejahtera' }), env);

    // Titik tidak boleh memisahkan "PT Contoh Sejahtera" dari "PT. Contoh Sejahtera".
    expect(h.id_lead).toBe('L1');
    expect(h.baru).toBe(false);
    expect(h.cara).toBe('nama cocok');
  });

  it('mengabaikan besar-kecil huruf dan spasi berlebih', async () => {
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'Budi  Santoso' });
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: '  budi santoso ' });

    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: '  budi santoso ' }), env);
    expect(h.id_lead).toBe('L1');
  });

  it('bila nama kembar, kota yang sama menang', async () => {
    // "Budi Santoso" ada dua — ini yang membuat penautan nama saja berbahaya.
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'Budi Santoso', kota: 'Bandung' });
    taruhLead({ id: 'L2', kode: 'LEAD-0002', nama: 'Budi Santoso', kota: 'Lamongan' });
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso', kota: 'Lamongan' });

    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso', kota: 'Lamongan' }), env);

    expect(h.id_lead).toBe('L2');
    expect(h.cara).toBe('nama+kota cocok');
  });

  it('menulis balik id_lead ke dokumen supaya pencarian berikutnya langsung kena', async () => {
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'Budi Santoso' });
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso' });

    expect(idLeadDokumen('D1')).toBeNull();
    await tautkanSpkKeLead(spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso' }), env);
    expect(idLeadDokumen('D1')).toBe('L1');
  });

  it('tidak membuat lead baru bila yang cocok sudah ada', async () => {
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'Budi Santoso' });
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso' });
    await tautkanSpkKeLead(spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso' }), env);

    const n = sqlite.prepare('SELECT COUNT(*) AS n FROM crm_leads').get() as { n: number };
    expect(n.n).toBe(1);
  });
});

describe('tautkanSpkKeLead — membuat lead bila memang belum ada', () => {
  it('membuat lead dari data SPK dan menautkannya, bukan menyerah', async () => {
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania', kota: 'Lamongan' });

    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania', kota: 'Lamongan' }), env);

    expect(h.baru).toBe(true);
    expect(h.cara).toBe('dibuat baru');

    const l = adaLead(h.id_lead);
    expect(l?.nama_prospek).toBe('Yessitania');
    expect(l?.kode_lead).toBe('LEAD-0001');
    // Statusnya harus status alur CRM yang dikenal, BUKAN 'Lead Baru': Final
    // Survey berangkat dari SPK, yang jelas sudah lewat tahap awal.
    expect(l?.status_terakhir).toBe('SPK Disusun');
    expect(idLeadDokumen('D1')).toBe(h.id_lead);
  });

  it('lead baru memperoleh penjelasan di riwayat statusnya', async () => {
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania' });
    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania' }), env);

    const r = sqlite.prepare('SELECT dari_status, ke_status, oleh, catatan FROM crm_lead_riwayat WHERE id_lead=?')
      .all(h.id_lead) as Array<Record<string, string | null>>;
    expect(r).toHaveLength(1);
    expect(r[0].dari_status).toBeNull();
    expect(r[0].ke_status).toBe('SPK Disusun');
    expect(r[0].catatan).toContain('7826/SPK/LIFT/BAI/X/2026');
  });

  it('kode lead lanjut dari nomor terakhir yang ada', async () => {
    taruhLead({ id: 'L7', kode: 'LEAD-0007', nama: 'Klien Lama' });
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania' });

    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania' }), env);
    expect(h.kode_lead).toBe('LEAD-0008');
  });

  it('mengosongkan kolom sales bila namanya tidak ada di referensi sales', async () => {
    // Dokumen lama sering memuat nama sales yang sudah tidak terdaftar.
    // Memaksakan nama itu akan melanggar foreign key crm_leads.sales.
    taruhDokumen({
      id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania',
      sales: 'Sales Sudah Resign',
    });

    const h = await tautkanSpkKeLead(spkDari({
      id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania', sales: 'Sales Sudah Resign',
    }), env);

    const l = adaLead(h.id_lead);
    expect(l?.sales).toBeNull();
    expect(l?.nama_prospek).toBe('Yessitania');
  });

  it('memakai nama sales yang terdaftar apa adanya', async () => {
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania', sales: 'Imam Solikhin' });
    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania', sales: 'Imam Solikhin' }), env);
    expect(adaLead(h.id_lead)?.sales).toBe('Imam Solikhin');
  });

  it('mendahulukan lead yang sudah jalan sebagai proyek saat namanya kembar tanpa kota', async () => {
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'Budi Santoso' });
    taruhLead({ id: 'L2', kode: 'LEAD-0002', nama: 'Budi Santoso', proyek: 'PRJ-0009' });
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso' });

    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Budi Santoso' }), env);
    expect(h.id_lead).toBe('L2');
  });

  it('id_lead yang menunjuk lead hilang tidak diikuti — dicari ulang', async () => {
    // Dokumen pernah ditautkan, lalu lead-nya terhapus. Kalau id_lead mati itu
    // tetap dipakai, Final Survey akan menunjuk lead yang tidak ada.
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania', lead: 'L-HANTU' });

    const h = await tautkanSpkKeLead(
      spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania', lead: 'L-HANTU' }), env);

    expect(h.id_lead).not.toBe('L-HANTU');
    expect(adaLead(h.id_lead)?.nama_prospek).toBe('Yessitania');
    expect(idLeadDokumen('D1')).toBe(h.id_lead);
  });

  it('memanggil dua kali tidak menghasilkan lead kembar', async () => {
    taruhDokumen({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania' });
    const spk = spkDari({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania' });

    const a = await tautkanSpkKeLead(spk, env);
    // Panggilan kedua memakai baris dokumen yang sudah tertaut (dibaca ulang
    // seperti server membacanya).
    const lagi = keSpkFinal({
      ...barisSpk({ id: 'D1', nomor: '7826/SPK/LIFT/BAI/X/2026', customer: 'Yessitania' }),
      id_lead: idLeadDokumen('D1'),
    })!;
    const b = await tautkanSpkKeLead(lagi, env);

    expect(b.id_lead).toBe(a.id_lead);
    const n = sqlite.prepare('SELECT COUNT(*) AS n FROM crm_leads').get() as { n: number };
    expect(n.n).toBe(1);
  });
});

describe('tautkanSpkKeLead — satu customer, dua SPK (dua lift)', () => {
  // Kasus nyata di produksi: satu customer memesan 2 lift dengan spesifikasi
  // berbeda, sehingga terbit 2 SPK dengan nama & kota yang sama persis.
  // Keduanya proyek terpisah, masing-masing punya Final Survey sendiri.
  //
  // Kalau lead-nya direbut, dua proyek hanya akan punya SATU Final Survey —
  // dan salah satu lift tidak pernah disurvey. Kesalahannya tidak akan
  // kelihatan sebagai galat: halaman cuma diam-diam menautkan ke proyek yang
  // salah.
  const d1 = {
    id: 'D1', nomor: '8926/SPK/LIFT/BAI/X/2026', customer: 'Suharjito SE',
    kota: 'Bekasi', state: { kapasitas: '450 Kg' },
  };
  const d2 = {
    id: 'D2', nomor: '8927/SPK/LIFT/BAI/X/2026', customer: 'Suharjito SE',
    kota: 'Bekasi', state: { kapasitas: '300 Kg' },
  };

  it('menghasilkan DUA lead, bukan satu', async () => {
    taruhDokumen(d1);
    taruhDokumen(d2);

    const a = await tautkanSpkKeLead(spkDari(d1), env);
    const b = await tautkanSpkKeLead(spkDari(d2), env);

    expect(a.id_lead).not.toBe(b.id_lead);
    const n = sqlite.prepare('SELECT COUNT(*) AS n FROM crm_leads').get() as { n: number };
    expect(n.n).toBe(2);
  });

  it('tiap dokumen menunjuk lead-nya sendiri', async () => {
    taruhDokumen(d1);
    taruhDokumen(d2);

    const a = await tautkanSpkKeLead(spkDari(d1), env);
    const b = await tautkanSpkKeLead(spkDari(d2), env);

    expect(idLeadDokumen('D1')).toBe(a.id_lead);
    expect(idLeadDokumen('D2')).toBe(b.id_lead);
  });

  it('SPK kedua tidak merebut lead yang sudah dipakai SPK pertama', async () => {
    // Lead sudah ada lebih dulu (mis. dibuat sales), dan sudah dipakai SPK 8926.
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'Suharjito SE', kota: 'Bekasi' });
    taruhDokumen({ ...d1, lead: 'L1' });
    taruhDokumen(d2);

    const b = await tautkanSpkKeLead(spkDari(d2), env);

    expect(b.id_lead).not.toBe('L1');
    expect(b.baru).toBe(true);
    expect(adaLead(b.id_lead)?.nama_prospek).toBe('Suharjito SE');
  });

  it('SPK pertama tetap memakai lead yang sudah ada, tidak dibuatkan baru', async () => {
    taruhLead({ id: 'L1', kode: 'LEAD-0001', nama: 'Suharjito SE', kota: 'Bekasi' });
    taruhDokumen(d1);

    const a = await tautkanSpkKeLead(spkDari(d1), env);

    expect(a.id_lead).toBe('L1');
    expect(a.baru).toBe(false);
  });
});
