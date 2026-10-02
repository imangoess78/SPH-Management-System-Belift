/**
 * UJI PERILAKU: setiap perpindahan status lead WAJIB meninggalkan jejak.
 *
 * Kenapa SQLite sungguhan, bukan tiruan: yang diuji adalah apakah perintah
 * SQL-nya benar-benar jalan dan barisnya benar-benar tertulis. Tiruan hanya
 * membuktikan tiruannya sesuai harapan saya sendiri.
 *
 * Kenapa memanggil fungsi produksi (functions/lib/riwayat.ts), bukan salinan:
 * supaya yang diuji adalah kode yang benar-benar dipakai server.
 *
 * Berkas ini melengkapi alur-lintas-tahap.test.ts. Tes di sana membaca TEKS
 * kode sumber — membuktikan kodenya berbunyi begitu. Berkas ini menjalankan
 * kodenya — membuktikan perilakunya begitu.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';
import { pindahkanStatus, catatPerpindahanStatus } from '../../functions/lib/riwayat';

/** Jembatan tipis: DatabaseSync tampil seperti D1 (prepare/bind/first/run). */
function keD1(sqlite: DatabaseSync): D1Database {
  const buat = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => buat(sql, a),
    all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) as never[] }),
    first: async () => (sqlite.prepare(sql).get(...(args as never[])) ?? null) as never,
    run: async () => sqlite.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql: string) => buat(sql) } as unknown as D1Database;
}

let sqlite: DatabaseSync;
let env: { sph_management_db: D1Database };

/** Baris riwayat sebuah lead, terurut waktu naik. */
function riwayat(idLead: string) {
  return sqlite
    .prepare('SELECT dari_status, ke_status, oleh, catatan, waktu FROM crm_lead_riwayat WHERE id_lead=? ORDER BY waktu ASC')
    .all(idLead) as Array<Record<string, string | null>>;
}

function statusLead(idLead: string) {
  const r = sqlite.prepare('SELECT status_terakhir FROM crm_leads WHERE id=?').get(idLead) as
    | { status_terakhir: string | null }
    | undefined;
  return r?.status_terakhir ?? null;
}

function taruhLead(id: string, status: string | null) {
  sqlite.prepare('INSERT INTO crm_leads (id, nama_prospek, status_terakhir, updated_at) VALUES (?,?,?,?)')
    .run(id, 'PT Contoh Sejahtera', status, '2026-01-01T00:00:00.000Z');
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  // Skema asli, disalin apa adanya dari migration/d1/2026-09-21-crm-leads.sql
  sqlite.exec(`
    CREATE TABLE crm_leads (
      id              TEXT PRIMARY KEY,
      nama_prospek    TEXT NOT NULL,
      status_terakhir TEXT,
      status_po       TEXT,
      updated_at      TEXT
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
  `);
  env = { sph_management_db: keD1(sqlite) };
});

describe('pindahkanStatus — perpindahan benar-benar terjadi & berjejak', () => {
  it('memindahkan status DAN menulis satu baris riwayat', async () => {
    taruhLead('L1', 'Lead Baru');
    const hasil = await pindahkanStatus(
      env, 'L1', 'Survey Dijadwalkan', 'Adhie Kurnia', 'Survey Sales dibuat');

    expect(hasil).toBe('berpindah');
    expect(statusLead('L1')).toBe('Survey Dijadwalkan');

    const r = riwayat('L1');
    expect(r).toHaveLength(1);
    expect(r[0].dari_status).toBe('Lead Baru');
    expect(r[0].ke_status).toBe('Survey Dijadwalkan');
    expect(r[0].oleh).toBe('Adhie Kurnia');
    expect(r[0].catatan).toBe('Survey Sales dibuat');
  });

  it('lead berstatus NULL (data lama) tetap tercatat dari_status NULL', async () => {
    taruhLead('L2', null);
    await pindahkanStatus(env, 'L2', 'Survey Dijadwalkan', 'Surveyor A', 'Survey Sales dibuat');
    const r = riwayat('L2');
    expect(r).toHaveLength(1);
    expect(r[0].dari_status).toBeNull();
    expect(r[0].ke_status).toBe('Survey Dijadwalkan');
  });

  it('TIDAK mencatat kalau statusnya tidak berubah', async () => {
    taruhLead('L3', 'Survey Dijadwalkan');
    const hasil = await pindahkanStatus(
      env, 'L3', 'Survey Dijadwalkan', 'Adhie Kurnia', 'Survey Sales dibuat');
    expect(hasil).toBe('tetap');
    expect(riwayat('L3')).toHaveLength(0);
  });

  it('menghormati batas statusAwal — status yang sudah maju tidak ditarik mundur', async () => {
    taruhLead('L4', 'SPH Terkirim');
    const hasil = await pindahkanStatus(
      env, 'L4', 'Survey Dijadwalkan', 'Adhie Kurnia', 'Survey Sales dibuat',
      { statusAwal: ['Lead Baru', 'Kontak Pertama Dilakukan', 'Survey Dijadwalkan'] });

    expect(hasil).toBe('tidak-cocok');
    expect(statusLead('L4')).toBe('SPH Terkirim');   // tidak mundur
    expect(riwayat('L4')).toHaveLength(0);           // dan tidak berjejak palsu
  });

  it('lead yang tidak ada tidak membuat baris riwayat yatim', async () => {
    const hasil = await pindahkanStatus(env, 'TIDAK-ADA', 'Selesai', 'Adhie Kurnia', 'x');
    expect(hasil).toBe('tidak-cocok');
    expect(riwayat('TIDAK-ADA')).toHaveLength(0);
  });

  it('memakai cap waktu yang dikirim pemanggil — jam satu permintaan tetap seragam', async () => {
    taruhLead('L5', 'Lead Baru');
    const now = '2026-10-02T07:00:00.000Z';
    await pindahkanStatus(env, 'L5', 'Survey Dijadwalkan', 'Adhie Kurnia', 'Survey Sales dibuat', { waktu: now });

    expect(riwayat('L5')[0].waktu).toBe(now);
    const baris = sqlite.prepare('SELECT updated_at FROM crm_leads WHERE id=?').get('L5') as { updated_at: string };
    expect(baris.updated_at).toBe(now);
  });
});

describe('alur penuh — tiga perpindahan otomatis, tiga jejak', () => {
  it('Survey Sales → Final Survey → PO terbit: riwayat tumbuh berurutan', async () => {
    taruhLead('L9', 'Lead Baru');

    // Tahap 1 — Survey Sales dibuat
    await pindahkanStatus(env, 'L9', 'Survey Dijadwalkan', 'Surveyor A', 'Survey Sales dibuat',
      { statusAwal: ['Lead Baru', 'Kontak Pertama Dilakukan', 'Survey Dijadwalkan'], waktu: '2026-10-02T01:00:00.000Z' });
    // Tahap 2 — Final Survey dikunci
    await pindahkanStatus(env, 'L9', 'Final Survey Selesai', 'Surveyor A', 'Final Survey dikunci',
      { waktu: '2026-10-02T02:00:00.000Z' });
    // Tahap 3 — PO terbit
    await pindahkanStatus(env, 'L9', 'PO Terbit ke Pabrik', 'Adhie Kurnia', 'PO diterbitkan ke pabrik',
      { waktu: '2026-10-02T03:00:00.000Z' });

    const r = riwayat('L9');
    expect(r).toHaveLength(3);
    expect(r.map((x) => [x.dari_status, x.ke_status])).toEqual([
      ['Lead Baru', 'Survey Dijadwalkan'],
      ['Survey Dijadwalkan', 'Final Survey Selesai'],
      ['Final Survey Selesai', 'PO Terbit ke Pabrik'],
    ]);
    expect(r.map((x) => x.oleh)).toEqual(['Surveyor A', 'Surveyor A', 'Adhie Kurnia']);
    expect(statusLead('L9')).toBe('PO Terbit ke Pabrik');
  });

  it('mengulang aksi yang sama tidak menggandakan riwayat', async () => {
    taruhLead('L10', 'Lead Baru');
    await pindahkanStatus(env, 'L10', 'Survey Dijadwalkan', 'A', 'Survey Sales dibuat');
    await pindahkanStatus(env, 'L10', 'Survey Dijadwalkan', 'A', 'Survey Sales dibuat');
    await pindahkanStatus(env, 'L10', 'Survey Dijadwalkan', 'A', 'Survey Sales dibuat');
    expect(riwayat('L10')).toHaveLength(1);
  });
});

describe('catatPerpindahanStatus', () => {
  it('melewati pencatatan kalau dari == ke', async () => {
    taruhLead('L11', 'Selesai');
    await catatPerpindahanStatus(env, 'L11', 'Selesai', 'Selesai', 'A', 'tidak ada perubahan');
    expect(riwayat('L11')).toHaveLength(0);
  });

  it('catatan kosong disimpan sebagai NULL, bukan string kosong', async () => {
    taruhLead('L12', 'Lead Baru');
    await catatPerpindahanStatus(env, 'L12', 'Lead Baru', 'Selesai', 'A', '');
    const r = sqlite.prepare('SELECT catatan FROM crm_lead_riwayat WHERE id_lead=?').get('L12') as { catatan: string | null };
    expect(r.catatan).toBeNull();
  });
});
