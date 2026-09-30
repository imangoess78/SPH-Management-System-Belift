import type { PagesFunction } from '@cloudflare/workers-types';
import { boleh } from '../../shared/akses';
import { bolehSentuh, saringPemilik, wajibHalaman, type Akses } from '../lib/akses';

interface Env { sph_management_db: D1Database }

// ════════════════════════════════════════════════════════════
//  PO PABRIK — pemesanan ke pabrik + revisi + selisih
//  PRD: docs/PRD-Survey-Sales-Final-Survey-PO.md (6D, aturan PO1–PO6)
//
//  Yang dijaga di lapisan ini:
//   PO1  PO hanya boleh terbit bila Final Survey sudah dikunci
//   PO2  tiap PO terbit = satu baris revisi, menyimpan salinan data teknis
//   PO3  selisih dihitung otomatis dan disimpan bersama revisi
//   PO4  revisi melebihi batas butuh alasan yang tercatat
//   PO5  nomor PO berformat 001/PO/LIFT/BAI/IX/2026
//   PO6  seluruh aksi tercatat di survey_riwayat
// ════════════════════════════════════════════════════════════

const KOLOM = ['id_lead','kode_proyek','no_po','tgl_po','pabrik','pic','status','catatan'];
const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const BATAS_REVISI = 3;

function ok(data: unknown, status = 200) {
  return Response.json(data as object, { status, headers: { 'cache-control': 'no-store, no-cache, must-revalidate' } });
}

async function getSession(request: Request, env: Env) {
  const sid = (request.headers.get('cookie') || '').match(/(?:^|; )sph_session=([^;]+)/)?.[1];
  if (!sid) return null;
  return env.sph_management_db
    .prepare('SELECT user_id FROM app_sessions WHERE id=? AND expires_at>?')
    .bind(sid, new Date().toISOString()).first<{ user_id: string }>();
}

async function profilPemakai(userId: string, env: Env) {
  const p = await env.sph_management_db
    .prepare(`SELECT p.full_name, p.email, u.email AS email_login, u.role
              FROM profiles p LEFT JOIN app_users u ON u.id = p.user_id WHERE p.user_id=?`)
    .bind(userId).first<{ full_name: string | null; email: string | null; email_login: string | null; role: string | null }>();
  const email = (p?.email || p?.email_login || '').toLowerCase();
  const nama = p?.full_name || p?.email_login || 'Pengguna';
  if (email) {
    const ref = await env.sph_management_db
      .prepare('SELECT nama, peran FROM crm_ref_sales WHERE lower(email)=?')
      .bind(email).first<{ nama: string; peran: string }>();
    if (ref) return { nama: ref.nama, peran: ref.peran };
  }
  return { nama, peran: p?.role === 'admin' ? 'Admin Sistem' : 'Sales' };
}

/** Peran yang boleh menerbitkan PO ke pabrik (PRD 6D). */
const PERAN_PENERBIT = ['Operasional','Direktur','Manager','Admin Sistem'];

/** Pesan galat peran — dipakai aksi terbit maupun revisi (keduanya = menerbitkan). */
const pesanPeran = (peran: string) =>
  `Peran ${peran} tidak berwenang menerbitkan atau merevisi PO`;

async function catat(idRef: string, aksi: string, oleh: string, alasan: string | null, env: Env, catatan?: string | null) {
  await env.sph_management_db
    .prepare(`INSERT INTO survey_riwayat (id, jenis, id_ref, aksi, oleh, alasan, catatan, waktu) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), 'po', idRef, aksi, oleh, alasan, catatan ?? null, new Date().toISOString()).run();
}

async function nomorPo(tgl: string, env: Env) {
  const d = new Date(tgl || Date.now());
  const suffix = `/PO/LIFT/BAI/${ROMAN[d.getMonth() + 1]}/${d.getFullYear()}`;
  const last = await env.sph_management_db
    .prepare(`SELECT no_po FROM po_pabrik WHERE no_po LIKE ? ORDER BY no_po DESC LIMIT 1`)
    .bind(`%${suffix}`).first<{ no_po: string }>();
  const next = last?.no_po ? Number(last.no_po.split('/')[0]) + 1 : 1;
  return String(next).padStart(3, '0') + suffix;
}

// ── Mesin selisih ───────────────────────────────────────────
// Label ramah dibaca; kunci yang tidak ada di sini tetap dibandingkan
// memakai nama kuncinya sendiri.
const LABEL: Record<string, string> = {
  jenisLift: 'Jenis Lift', model: 'Model', kapasitas: 'Kapasitas', penumpang: 'Penumpang',
  kecepatan: 'Kecepatan', sfd: 'Stops/Floors/Doors', tipeMesin: 'Tipe Mesin', drive: 'Sistem Penggerak',
  shaftSize: 'Ukuran Shaft', pitDepth: 'Kedalaman Pit', overhead: 'Overhead', travelling: 'Travelling Height',
  bahanShaft: 'Bahan Konstruksi Shaft', tebalDinding: 'Tebal Dinding', posisiHoistway: 'Posisi Hoistway',
  dindingFinish: 'Finishing Dinding Shaft', tipePintu: 'Tipe Pintu', bukaanPintu: 'Bukaan Pintu',
  tinggiPintu: 'Tinggi Pintu', lebarPintu: 'Lebar Pintu', jumlahPintu: 'Jumlah Pintu per Lantai',
  bahanPintu: 'Bahan Pintu', finishPintu: 'Finishing Pintu', sillPintu: 'Sill Pintu',
  cabinSize: 'Ukuran Cabin', tinggiCabin: 'Tinggi Cabin', bahanCabin: 'Bahan Cabin',
  finishCabin: 'Finishing Cabin', plafonCabin: 'Plafon Cabin', lantaiCabin: 'Lantai Cabin',
  handrail: 'Handrail', finishLantai: 'Finishing Lantai', finishDinding: 'Finishing Dinding',
  finishPlafon: 'Finishing Plafon', finishPintuLantai: 'Finishing Pintu per Lantai',
  warnaStruktur: 'Warna Struktur', finishingStruktur: 'Finishing Struktur', dayaMesin: 'Daya Mesin',
  traksi: 'Traction Ratio', power: 'Power Supply', mesinMerk: 'Merk Mesin', posisiMesin: 'Posisi Mesin',
  panelLokasi: 'Lokasi Panel', kabelMeter: 'Kebutuhan Kabel', grounding: 'Grounding',
  ard: 'ARD / MCB', emergencyBell: 'Emergency Bell', intercom: 'Intercom', alarmSistem: 'Sistem Alarm',
  governor: 'Governor', safetyGear: 'Safety Gear', aksesJalan: 'Akses Jalan ke Lokasi',
  ruangKerja: 'Ruang Kerja', listrikLokasi: 'Listrik di Lokasi', airLokasi: 'Air di Lokasi',
  cuaca: 'Kondisi Cuaca', lainLain: 'Catatan Teknis Lain',
};

function teks(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) return v.length ? v.map(x => JSON.stringify(x)).join('; ') : '—';
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (o.nama) return `${o.on ? '✓' : '✗'} ${o.nama}`;
    return JSON.stringify(v);
  }
  return String(v);
}

/** Bandingkan dua DataTeknis → daftar perubahan berlabel. */
function bandingkan(a: Record<string, unknown> | null, b: Record<string, unknown> | null) {
  const perubahan: { key: string; label: string; lama: string; baru: string }[] = [];
  const kunci = Array.from(new Set(Object.keys(a || {}).concat(Object.keys(b || {}))));
  for (const k of kunci) {
    if (k === 'lantai' || k === 'addon') continue;
    const lama = teks((a || {})[k]), baru = teks((b || {})[k]);
    if (lama !== baru) perubahan.push({ key: k, label: LABEL[k] || k, lama, baru });
  }
  // Tabel lantai
  const la = ((a || {}).lantai as Record<string, unknown>[]) || [];
  const lb = ((b || {}).lantai as Record<string, unknown>[]) || [];
  const n = Math.max(la.length, lb.length);
  if (n && JSON.stringify(la) !== JSON.stringify(lb)) {
    for (let i = 0; i < n; i++) {
      const sa = la[i] ? [la[i].lantai, la[i].tinggi, la[i].door, la[i].finishing].map(teks).join(' · ') : '—';
      const sb = lb[i] ? [lb[i].lantai, lb[i].tinggi, lb[i].door, lb[i].finishing].map(teks).join(' · ') : '—';
      if (sa !== sb) perubahan.push({ key: `lantai.${i}`, label: `Lantai ${i + 1}`, lama: sa, baru: sb });
    }
  }
  // Add-on
  const aa = ((a || {}).addon as Record<string, unknown>[]) || [];
  const ab = ((b || {}).addon as Record<string, unknown>[]) || [];
  const nama = Array.from(new Set(aa.map(x => String(x.nama)).concat(ab.map(x => String(x.nama)))));
  for (const nm of nama) {
    const da = aa.find(x => x.nama === nm), db = ab.find(x => x.nama === nm);
    const ta = da ? (da.on ? 'Dipesan' : 'Tidak') : '—';
    const tb = db ? (db.on ? 'Dipesan' : 'Tidak') : '—';
    if (ta !== tb) perubahan.push({ key: `addon.${nm}`, label: `Add-on: ${nm}`, lama: ta, baru: tb });
  }
  return perubahan;
}

// ── Handler ─────────────────────────────────────────────────

async function daftar(url: URL, env: Env, akses: Akses) {
  const idLead = url.searchParams.get('id_lead');
  // Batasan data: sales hanya melihat PO dari lead miliknya.
  const batas = saringPemilik(akses, 'l.sales');
  const where = idLead ? ` WHERE p.id_lead = ?${batas.sql}` : (batas.sql ? ` WHERE 1=1${batas.sql}` : '');
  const sql = `SELECT p.*, l.nama_prospek, l.kode_lead, l.kota,
                      (SELECT rev FROM po_revisi r WHERE r.id_po=p.id ORDER BY rev DESC LIMIT 1) AS rev_terakhir_dihitung,
                      (SELECT COUNT(*) FROM po_revisi r WHERE r.id_po=p.id) AS jml_revisi
               FROM po_pabrik p LEFT JOIN crm_leads l ON l.id=p.id_lead${where}
               ORDER BY datetime(p.created_at) DESC LIMIT 500`;
  const params = idLead ? [idLead, ...batas.params] : [...batas.params];
  const res = await env.sph_management_db.prepare(sql).bind(...params).all();
  return ok({ data: res.results || [] });
}

async function detail(id: string, env: Env, akses: Akses) {
  const po: any = await env.sph_management_db.prepare(
    `SELECT p.*, l.nama_prospek, l.kode_lead, l.kota, l.sales FROM po_pabrik p LEFT JOIN crm_leads l ON l.id=p.id_lead WHERE p.id=?`)
    .bind(id).first();
  if (!po) return ok({ error: 'PO tidak ditemukan' }, 404);

  // PO dari lead milik sales lain tidak boleh dibuka.
  if (!bolehSentuh(akses, po.sales, 'lihat')) {
    return ok({ error: 'PO ini bukan milik Anda.' }, 403);
  }

  const revisi = await env.sph_management_db
    .prepare('SELECT * FROM po_revisi WHERE id_po=? ORDER BY rev DESC').bind(id).all();
  const riwayat = await env.sph_management_db
    .prepare(`SELECT * FROM survey_riwayat WHERE jenis='po' AND id_ref=? ORDER BY datetime(waktu) DESC LIMIT 100`)
    .bind(id).all();
  const final = await env.sph_management_db
    .prepare(`SELECT dt, terkunci, dikunci_oleh, dikunci_pada, no_survey FROM survey_teknis WHERE id_lead=? AND jenis='final' LIMIT 1`)
    .bind((po as { id_lead: string }).id_lead).first<{ dt: string | null; terkunci: number }>();

  let dtFinal: Record<string, unknown> | null = null;
  if (final?.dt) { try { dtFinal = JSON.parse(final.dt) as Record<string, unknown>; } catch { dtFinal = null; } }
  const terbit = (revisi.results || [])[0] as { dt: string | null } | undefined;
  let dtPo: Record<string, unknown> | null = null;
  if (terbit?.dt) { try { dtPo = JSON.parse(terbit.dt) as Record<string, unknown>; } catch { dtPo = null; } }

  return ok({
    data: po,
    revisi: (revisi.results || []).map(r => ({
      ...(r as Record<string, unknown>),
      dt: typeof (r as { dt: unknown }).dt === 'string' ? JSON.parse((r as { dt: string }).dt) : (r as { dt: unknown }).dt,
      perubahan: typeof (r as { perubahan: unknown }).perubahan === 'string'
        ? JSON.parse((r as { perubahan: string }).perubahan) : ((r as { perubahan: unknown }).perubahan || []),
    })),
    riwayat: riwayat.results || [],
    selisih_final_ke_po: bandingkan(dtFinal, dtPo),
  });
}

async function simpan(method: string, id: string | null, body: Record<string, unknown>, env: Env, userId: string) {
  const aku = await profilPemakai(userId, env);
  const now = new Date().toISOString();
  const kolom: Record<string, unknown> = {};
  for (const k of KOLOM) if (k in body) kolom[k] = body[k];

  if (method === 'PUT') {
    if (!id) return ok({ error: 'id wajib diisi' }, 400);
    const lama = await env.sph_management_db.prepare('SELECT * FROM po_pabrik WHERE id=?').bind(id).first();
    if (!lama) return ok({ error: 'PO tidak ditemukan' }, 404);
    const entries = Object.entries({ ...kolom, updated_at: now });
    await env.sph_management_db
      .prepare(`UPDATE po_pabrik SET ${entries.map(([k]) => `${k}=?`).join(', ')} WHERE id=?`)
      .bind(...entries.map(([, v]) => v), id).run();
    await catat(id, 'Diubah', aku.nama, null, env);
    return ok({ ok: true, id });
  }

  const idLead = String(kolom.id_lead || '');
  if (!idLead) return ok({ error: 'id_lead wajib diisi' }, 400);

  // PO1 — Final Survey wajib sudah dikunci
  const final = await env.sph_management_db
    .prepare(`SELECT terkunci, id FROM survey_teknis WHERE id_lead=? AND jenis='final' LIMIT 1`)
    .bind(idLead).first<{ terkunci: number; id: string }>();
  if (!final) return ok({ error: 'Final Survey belum dibuat untuk proyek ini' }, 409);
  if (!final.terkunci) return ok({ error: 'Final Survey belum dikunci — PO tidak boleh terbit' }, 409);

  // Satu PO per lead
  const ada = await env.sph_management_db
    .prepare('SELECT id FROM po_pabrik WHERE id_lead=? LIMIT 1').bind(idLead).first<{ id: string }>();
  if (ada) return ok({ ok: true, id: ada.id, sudahAda: true });

  const proyek = await env.sph_management_db
    .prepare('SELECT kode_proyek, id FROM proyek WHERE id_lead=? LIMIT 1').bind(idLead).first<{ kode_proyek: string; id: string }>();

  const newId = crypto.randomUUID();
  const entries = Object.entries({
    ...kolom, id: newId, id_lead: idLead,
    kode_proyek: kolom.kode_proyek || proyek?.kode_proyek || null,
    no_po: kolom.no_po || await nomorPo((kolom.tgl_po as string) || now, env),
    status: 'Draft', rev_terakhir: 0,
    dibuat_oleh: aku.nama, created_at: now, updated_at: now,
  });
  await env.sph_management_db
    .prepare(`INSERT INTO po_pabrik (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`)
    .bind(...entries.map(([, v]) => v)).run();
  await catat(newId, 'Dibuat', aku.nama, null, env);
  return ok({ ok: true, id: newId, no_po: kolom.no_po });
}

/** Terbitkan PO — kunci barisnya sebagai revisi ke-1 (PRD PO1, PO2). */
async function terbitkan(id: string, body: Record<string, unknown>, env: Env, userId: string) {
  const aku = await profilPemakai(userId, env);
  if (!PERAN_PENERBIT.includes(aku.peran))
    return ok({ error: pesanPeran(aku.peran) }, 403);

  const po = await env.sph_management_db.prepare('SELECT * FROM po_pabrik WHERE id=?').bind(id)
    .first<{ id_lead: string; rev_terakhir: number; no_po: string }>();
  if (!po) return ok({ error: 'PO tidak ditemukan' }, 404);

  const final = await env.sph_management_db
    .prepare(`SELECT dt, terkunci FROM survey_teknis WHERE id_lead=? AND jenis='final' LIMIT 1`)
    .bind(po.id_lead).first<{ dt: string | null; terkunci: number }>();
  if (!final?.terkunci) return ok({ error: 'Final Survey belum dikunci — PO tidak boleh terbit' }, 409);

  let dt: Record<string, unknown> | null = null;
  if (final.dt) { try { dt = JSON.parse(final.dt) as Record<string, unknown>; } catch { dt = null; } }

  const rev = (po.rev_terakhir || 0) + 1;
  const now = new Date().toISOString();

  // Selisih terhadap revisi sebelumnya (kalau ada)
  let perubahan: unknown[] = [];
  if (rev > 1) {
    const sebelum = await env.sph_management_db
      .prepare('SELECT dt FROM po_revisi WHERE id_po=? ORDER BY rev DESC LIMIT 1').bind(id).first<{ dt: string | null }>();
    let dtSebelum: Record<string, unknown> | null = null;
    if (sebelum?.dt) { try { dtSebelum = JSON.parse(sebelum.dt) as Record<string, unknown>; } catch { dtSebelum = null; } }
    perubahan = bandingkan(dtSebelum, dt);
  }

  const alasan = (body.alasan as string) || null;
  if (rev > BATAS_REVISI && !alasan)
    return ok({ error: `Revisi ke-${rev} melebihi batas ${BATAS_REVISI} — alasan wajib diisi` }, 400);

  await env.sph_management_db
    .prepare(`INSERT INTO po_revisi (id, id_po, rev, tgl_revisi, oleh, alasan, dt, perubahan, jml_perubahan, perubahan_setelah_final, created_at)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), id, rev, now, aku.nama, alasan, dt ? JSON.stringify(dt) : null,
      JSON.stringify(perubahan), perubahan.length, (po.rev_terakhir || 0) > 0 ? 1 : 0, now).run();

  await env.sph_management_db
    .prepare(`UPDATE po_pabrik SET rev_terakhir=?, status='Terbit', tgl_po=COALESCE(tgl_po,?), updated_at=? WHERE id=?`)
    .bind(rev, now, now, id).run();

  await catat(id, rev === 1 ? 'Terbit' : `Revisi ${rev}`, aku.nama, alasan, env,
    perubahan.length ? `${perubahan.length} perubahan` : null);

  // Status lead & proyek
  await env.sph_management_db
    .prepare(`UPDATE crm_leads SET status_terakhir='PO Terbit ke Pabrik', status_po=?, updated_at=? WHERE id=?`)
    .bind(rev === 1 ? 'PO Terbit' : `PO Rev ${rev}`, now, po.id_lead).run();
  await env.sph_management_db.prepare('UPDATE proyek SET tahap_sekarang=?, updated_at=? WHERE id_lead=?')
    .bind('PO', now, po.id_lead).run();

  return ok({ ok: true, rev, jml_perubahan: perubahan.length, perubahan });
}

// Revisi PO = terbitkan ulang memakai data Final Survey terkini (PRD PO2).
// Fungsi terpisah hanya untuk kejelasan nama aksi di sisi layar.
const revisiBaru = terbitkan;

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const cek = await wajibHalaman(request, env, 'po');
  if ('tolak' in cek) return cek.tolak;
  const akses = cek.akses;
  const session = { user_id: akses.userId };

  const url = new URL(request.url);
  const method = request.method;
  const id = url.searchParams.get('id');
  const resource = url.searchParams.get('resource') || 'po';

  let body: Record<string, unknown> = {};
  if (method === 'POST' || method === 'PUT') body = await request.json().catch(() => ({})) as Record<string, unknown>;

  try {
    switch (resource) {
      case 'po':
        if (method === 'GET') return id ? detail(id, env, akses) : daftar(url, env, akses);
        if (method === 'POST' || method === 'PUT') return simpan(method, id, body, env, session.user_id);
        if (method === 'DELETE') {
          if (!id) return ok({ error: 'id wajib diisi' }, 400);
          await env.sph_management_db.prepare('DELETE FROM po_revisi WHERE id_po=?').bind(id).run();
          await env.sph_management_db.prepare(`DELETE FROM survey_riwayat WHERE jenis='po' AND id_ref=?`).bind(id).run();
          await env.sph_management_db.prepare('DELETE FROM po_pabrik WHERE id=?').bind(id).run();
          return ok({ ok: true });
        }
        break;
      case 'terbit': {
        if (method !== 'POST') break;
        if (!id) return ok({ error: 'id wajib diisi' }, 400);
        return terbitkan(id, body, env, session.user_id);
      }
      case 'revisi': {
        if (method !== 'POST') break;
        if (!id) return ok({ error: 'id wajib diisi' }, 400);
        return revisiBaru(id, body, env, session.user_id);
      }
    }
    return ok({ error: `Aksi tidak dikenal: ${method} ${resource}` }, 405);
  } catch (e) {
    return ok({ error: (e as Error).message || 'Kesalahan server' }, 500);
  }
};
