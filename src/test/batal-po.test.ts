/**
 * PEMBATALAN PO — uji perilaku terhadap SQLite sungguhan.
 *
 * Membatalkan PO adalah satu-satunya tempat `bolehMundur` dipakai: status
 * lead memang HARUS turun dari 'PO Terbit ke Pabrik' (125) ke
 * 'Final Survey Selesai' (122). Kalau penjaga mundur ikut berlaku di sini,
 * pembatalan akan gagal dan lead tertinggal di status PO — itu yang diuji.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { pindahkanStatus } from '../../functions/lib/riwayat';
import { keD1 } from './bantu-d1';

let sqlite: DatabaseSync;
let env: { sph_management_db: ReturnType<typeof keD1> };

const URUTAN: [string, number][] = [
  ['Lead Baru', 10], ['Survey Dijadwalkan', 30], ['SPH Terkirim', 60],
  ['Negosiasi', 70], ['Final Survey Dijadwalkan', 121],
  ['Final Survey Selesai', 122], ['PO Terbit ke Pabrik', 125],
  ['Selesai - Pindah ke File 00', 140],
];

function statusLead(id: string) {
  return (sqlite.prepare('SELECT status_terakhir FROM crm_leads WHERE id=?')
    .get(id) as { status_terakhir: string | null } | undefined)?.status_terakhir ?? null;
}

function riwayat(id: string) {
  return sqlite.prepare('SELECT * FROM crm_lead_riwayat WHERE id_lead=? ORDER BY waktu ASC')
    .all(id) as { dari_status: string | null; ke_status: string; oleh: string; catatan: string | null }[];
}

function taruhLead(id: string, status: string) {
  sqlite.prepare('INSERT INTO crm_leads (id, nama_prospek, status_terakhir, updated_at) VALUES (?,?,?,?)')
    .run(id, 'PT Contoh', status, '2026-01-01T00:00:00.000Z');
}

beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE crm_leads (
      id TEXT PRIMARY KEY, nama_prospek TEXT NOT NULL,
      status_terakhir TEXT, status_po TEXT, updated_at TEXT
    );
    CREATE TABLE crm_lead_riwayat (
      id TEXT PRIMARY KEY, id_lead TEXT NOT NULL, waktu TEXT,
      dari_status TEXT, ke_status TEXT, oleh TEXT, catatan TEXT
    );
    CREATE TABLE crm_ref_status (status TEXT PRIMARY KEY, urutan INTEGER NOT NULL);
  `);
  const ins = sqlite.prepare('INSERT INTO crm_ref_status (status, urutan) VALUES (?,?)');
  for (const [s, u] of URUTAN) ins.run(s, u);
  env = { sph_management_db: keD1(sqlite) };
});

describe('pembatalan PO menarik status lead mundur', () => {
  it('bolehMundur:true MENURUNKAN status dari PO ke Final Survey Selesai', async () => {
    taruhLead('L1', 'PO Terbit ke Pabrik');

    // Inilah yang dipanggil batalkan() di functions/api/po.ts.
    const hasil = await pindahkanStatus(
      env, 'L1', 'Final Survey Selesai', 'Adhie Kurnia',
      'PO dibatalkan: pabrik menolak spesifikasi', { bolehMundur: true });

    expect(hasil).toBe('berpindah');
    expect(statusLead('L1')).toBe('Final Survey Selesai');
  });

  it('★ tanpa bolehMundur pembatalan GAGAL — ini yang bikin fitur ini perlu', async () => {
    taruhLead('L2', 'PO Terbit ke Pabrik');

    const hasil = await pindahkanStatus(
      env, 'L2', 'Final Survey Selesai', 'Adhie Kurnia', 'PO dibatalkan');

    expect(hasil).toBe('mundur');
    expect(statusLead('L2')).toBe('PO Terbit ke Pabrik');
  });

  it('penurunan tetap BERJEJAK dengan alasan pembatalannya', async () => {
    taruhLead('L3', 'PO Terbit ke Pabrik');
    await pindahkanStatus(env, 'L3', 'Final Survey Selesai', 'Adhie Kurnia',
      'PO dibatalkan: pabrik menolak spesifikasi', { bolehMundur: true });

    const r = riwayat('L3');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      dari_status: 'PO Terbit ke Pabrik',
      ke_status: 'Final Survey Selesai',
      oleh: 'Adhie Kurnia',
    });
    expect(r[0].catatan).toContain('pabrik menolak spesifikasi');
  });

  it('membatalkan dua kali tidak menggandakan riwayat (status sama = tetap)', async () => {
    taruhLead('L4', 'PO Terbit ke Pabrik');
    await pindahkanStatus(env, 'L4', 'Final Survey Selesai', 'A', 'batal 1', { bolehMundur: true });
    const lagi = await pindahkanStatus(env, 'L4', 'Final Survey Selesai', 'A', 'batal 2', { bolehMundur: true });

    expect(lagi).toBe('tetap');
    expect(riwayat('L4')).toHaveLength(1);
  });

  it('setelah batal, PO bisa terbit lagi (naik dari Final Survey Selesai)', async () => {
    taruhLead('L5', 'PO Terbit ke Pabrik');
    await pindahkanStatus(env, 'L5', 'Final Survey Selesai', 'A', 'batal', { bolehMundur: true });
    const naik = await pindahkanStatus(env, 'L5', 'PO Terbit ke Pabrik', 'A',
      'PO diterbitkan ulang', { hanyaMaju: true });

    expect(naik).toBe('berpindah');
    expect(statusLead('L5')).toBe('PO Terbit ke Pabrik');
    expect(riwayat('L5')).toHaveLength(2);
  });
});
