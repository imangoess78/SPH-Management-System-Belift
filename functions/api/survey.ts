import type { PagesFunction } from '@cloudflare/workers-types';
import { boleh } from '../../shared/akses';
import { bolehSentuh, saringPemilik, wajibHalaman, wajibSalahSatu, type Akses } from '../lib/akses';
import { pindahkanStatus } from '../lib/riwayat';

interface Env { sph_management_db: D1Database }

// ════════════════════════════════════════════════════════════
//  SURVEY TEKNIS — Survey Sales & Final Survey
//  PRD: docs/PRD-Survey-Sales-Final-Survey-PO.md
//
//  Aturan yang dijaga di lapisan ini:
//   S6  survey terkunci tidak bisa diubah siapa pun
//   S7  hanya peran Surveyor (atau Direktur/Admin Sistem) yang boleh mengunci
//   S8  aksi kunci/buka kunci selalu tercatat di survey_riwayat
// ════════════════════════════════════════════════════════════

const KOLOM = ['id_lead','kode_proyek','jenis','no_survey','tgl_survey','surveyor','disurvey_oleh',
  'pj_lapangan','pj_telp','jam_kerja','dt','dokumentasi','video_link','pekerjaan_tambahan',
  'catatan_lapangan','catatan_desain','kesimpulan','ttd','terkunci','dikunci_oleh','dikunci_pada','status'];

const KOLOM_JSON = new Set(['dt','dokumentasi','pekerjaan_tambahan','kesimpulan','ttd']);

/** Di antara KOLOM_JSON, mana yang berbentuk array (sisanya objek). */
const KOLOM_JSON_ARRAY = new Set(['dokumentasi','pekerjaan_tambahan','kesimpulan']);

/** Peran yang boleh mengunci / membuka kunci Final Survey (PRD S7). */
const PERAN_PENGUNCI = ['Surveyor','Direktur','Manager','Admin Sistem'];

function ok(data: unknown, status = 200) {
  return Response.json(data as object, { status, headers: { 'cache-control': 'no-store, no-cache, must-revalidate' } });
}

async function getSession(request: Request, env: Env) {
  const sid = (request.headers.get('cookie') || '').match(/(?:^|; )sph_session=([^;]+)/)?.[1];
  if (!sid) return null;
  return env.sph_management_db
    .prepare('SELECT user_id FROM app_sessions WHERE id=? AND expires_at>?')
    .bind(sid, new Date().toISOString())
    .first<{ user_id: string }>();
}

/** Peran + nama pemakai dari crm_ref_sales (dicocokkan email lalu nama). */
async function profilPemakai(userId: string, env: Env) {
  // Sumber utama adalah app_users. Tabel `profiles` TIDAK PERNAH diisi oleh
  // aplikasi (tidak ada satu pun INSERT ke sana), jadi memulai query dari
  // `profiles` membuat seluruh pengambilan gagal dan nama selalu jatuh ke
  // 'Pengguna'. app_users selalu ada untuk setiap akun yang bisa login.
  const p = await env.sph_management_db
    .prepare(`SELECT p.full_name, COALESCE(u.email, p.email) AS email, u.email AS email_login, u.role
              FROM app_users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id=?`)
    .bind(userId).first<{ full_name: string | null; email: string | null; email_login: string | null; role: string | null }>();
  const email = (p?.email || p?.email_login || '').toLowerCase();
  const nama = p?.full_name || p?.email_login || 'Pengguna';
  let peran = p?.role === 'admin' ? 'Admin Sistem' : 'Sales';
  if (email) {
    const ref = await env.sph_management_db
      .prepare('SELECT nama, peran FROM crm_ref_sales WHERE lower(email)=? AND (status IS NULL OR status="Aktif")')
      .bind(email).first<{ nama: string; peran: string }>();
    if (ref) return { nama: ref.nama, peran: ref.peran, email };
  }
  return { nama, peran, email };
}

function urai(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };

  // Kolom JSON di D1 tersimpan sebagai TEXT. Kalau NULL (survey baru / kolom
  // belum pernah diisi) kita kirim bentuk kosong yang BENAR sesuai tipe
  // fieldnya — array tetap array, objek tetap objek. Kalau dikirim null,
  // pemanggil `.filter()` / `.length` di layar akan meledak.
  for (const k of Array.from(KOLOM_JSON)) {
    const kosong = KOLOM_JSON_ARRAY.has(k) ? [] : {};
    const v = out[k];
    if (v === null || v === undefined) { out[k] = kosong; continue; }

    if (typeof v === 'string') {
      const s = v.trim();
      if (!s) { out[k] = kosong; continue; }
      try {
        const u = JSON.parse(s);
        // Isi kolom bisa saja tidak sesuai bentuk yang diharapkan
        // (mis. kesimpulan lama tersimpan sebagai teks biasa).
        out[k] = Array.isArray(u) === KOLOM_JSON_ARRAY.has(k) ? u : kosong;
      } catch { out[k] = kosong; }
      continue;
    }

    // Sudah objek/array dari driver
    if (Array.isArray(v) !== KOLOM_JSON_ARRAY.has(k)) out[k] = kosong;
  }

  if (out.terkunci !== undefined) out.terkunci = !!out.terkunci;
  return out;
}

function rapikan(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of KOLOM) {
    if (!(k in body)) continue;
    const v = body[k];
    if (KOLOM_JSON.has(k)) out[k] = v === null || v === undefined ? null : JSON.stringify(v);
    else if (k === 'terkunci') out[k] = v ? 1 : 0;
    else out[k] = v;
  }
  return out;
}

async function catat(jenis: string, idRef: string, aksi: string, oleh: string, alasan: string | null, env: Env, catatan?: string | null) {
  await env.sph_management_db
    .prepare(`INSERT INTO survey_riwayat (id, jenis, id_ref, aksi, oleh, alasan, catatan, waktu) VALUES (?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), jenis, idRef, aksi, oleh, alasan, catatan ?? null, new Date().toISOString()).run();
}

/** Cari / buat baris proyek untuk sebuah lead. */
async function pastikanProyek(idLead: string, env: Env) {
  const ada = await env.sph_management_db
    .prepare('SELECT * FROM proyek WHERE id_lead=? ORDER BY created_at LIMIT 1').bind(idLead).first();
  if (ada) return ada;

  const lead = await env.sph_management_db
    .prepare('SELECT * FROM crm_leads WHERE id=?').bind(idLead)
    .first<{ nama_prospek: string; kota: string; status_terakhir: string; kode_proyek: string | null }>();
  if (!lead) return null;

  // Kode proyek: BLF-<tahun>-<urut 3 digit>
  let kode = lead.kode_proyek || null;
  if (!kode) {
    const th = new Date().getFullYear();
    const last = await env.sph_management_db
      .prepare(`SELECT kode_proyek FROM proyek WHERE kode_proyek LIKE ? ORDER BY kode_proyek DESC LIMIT 1`)
      .bind(`BLF-${th}-%`).first<{ kode_proyek: string }>();
    const next = last?.kode_proyek ? Number(last.kode_proyek.split('-')[2]) + 1 : 1;
    kode = `BLF-${th}-${String(next).padStart(3, '0')}`;
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await env.sph_management_db
    .prepare(`INSERT INTO proyek (id, kode_proyek, id_lead, nama_proyek, customer, kota, status_terakhir, tahap_sekarang, created_at, updated_at)
              VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, kode, idLead, lead.nama_prospek, lead.nama_prospek, lead.kota, lead.status_terakhir, 'CRM', now, now).run();
  await env.sph_management_db.prepare('UPDATE crm_leads SET kode_proyek=?, updated_at=? WHERE id=?').bind(kode, now, idLead).run();
  return env.sph_management_db.prepare('SELECT * FROM proyek WHERE id=?').bind(id).first();
}

/** Nomor form survey: 001/SVY/LIFT/BAI/IX/2026 */
const ROMAN = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
async function nomorSurvey(tgl: string, env: Env) {
  const d = new Date(tgl || Date.now());
  const suffix = `/SVY/LIFT/BAI/${ROMAN[d.getMonth() + 1]}/${d.getFullYear()}`;
  const last = await env.sph_management_db
    .prepare(`SELECT no_survey FROM survey_teknis WHERE no_survey LIKE ? ORDER BY no_survey DESC LIMIT 1`)
    .bind(`%${suffix}`).first<{ no_survey: string }>();
  const next = last?.no_survey ? Number(last.no_survey.split('/')[0]) + 1 : 1;
  return String(next).padStart(3, '0') + suffix;
}

// ── Handler ─────────────────────────────────────────────────

async function daftar(url: URL, env: Env, akses: Akses) {
  const jenis = url.searchParams.get('jenis');
  const idLead = url.searchParams.get('id_lead');
  const kunci = url.searchParams.get('terkunci');
  const q = url.searchParams.get('q');

  const where: string[] = [];
  const params: unknown[] = [];
  if (jenis) { where.push('s.jenis = ?'); params.push(jenis); }
  if (idLead) { where.push('s.id_lead = ?'); params.push(idLead); }
  if (kunci === '1' || kunci === '0') { where.push('s.terkunci = ?'); params.push(Number(kunci)); }
  if (q) {
    where.push('(l.nama_prospek LIKE ? OR l.kode_lead LIKE ? OR s.kode_proyek LIKE ? OR s.no_survey LIKE ?)');
    const like = `%${q}%`; params.push(like, like, like, like);
  }
  // Batasan data: sales hanya melihat survey miliknya. Pemilik survey
  // ditentukan oleh kolom `surveyor` (nama sales yang mengerjakan).
  const batas = saringPemilik(akses, 's.surveyor');
  if (batas.sql) { where.push(batas.sql.replace(/^ AND /, '')); params.push(...batas.params); }

  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const res = await env.sph_management_db.prepare(
    `SELECT s.id, s.id_lead, s.kode_proyek, s.jenis, s.no_survey, s.tgl_survey, s.tgl_survey AS tanggal,
            s.disurvey_oleh, s.surveyor, s.terkunci, s.dikunci_oleh, s.dikunci_pada, s.status, s.updated_at,
            l.nama_prospek, l.kode_lead, l.kota, l.status_terakhir,
            length(COALESCE(s.dt,''))  AS dt_len,
            length(COALESCE(s.dokumentasi,'')) AS dok_len
     FROM survey_teknis s LEFT JOIN crm_leads l ON l.id = s.id_lead${clause}
     ORDER BY datetime(COALESCE(s.tgl_survey, s.created_at)) DESC LIMIT 500`
  ).bind(...params).all();

  const data = (res.results || []).map(r => ({ ...r, terkunci: !!(r as { terkunci: number }).terkunci }));
  return ok({ data });
}

async function detail(id: string, env: Env, akses: Akses) {
  const row: any = await env.sph_management_db.prepare(
    `SELECT s.*, l.nama_prospek, l.kode_lead, l.kota, l.sales, l.status_terakhir, l.no_spk, l.tgl_spk
     FROM survey_teknis s LEFT JOIN crm_leads l ON l.id = s.id_lead WHERE s.id=?`).bind(id).first();
  if (!row) return ok({ error: 'Survey tidak ditemukan' }, 404);

  // Survey milik sales lain tidak boleh dibuka walau id-nya diketahui.
  if (!bolehSentuh(akses, row.surveyor, 'lihat') && !bolehSentuh(akses, row.sales, 'lihat')) {
    return ok({ error: 'Survey ini bukan milik Anda.' }, 403);
  }

  const riwayat = await env.sph_management_db
    .prepare(`SELECT * FROM survey_riwayat WHERE jenis='survey' AND id_ref=? ORDER BY waktu DESC LIMIT 100`)
    .bind(id).all();

  return ok({ data: urai(row as Record<string, unknown>), riwayat: riwayat.results || [] });
}

async function simpan(method: string, id: string | null, body: Record<string, unknown>, env: Env, userId: string) {
  const aku = await profilPemakai(userId, env);
  const now = new Date().toISOString();
  const kolom = rapikan(body);

  if (method === 'PUT') {
    if (!id) return ok({ error: 'id wajib diisi' }, 400);
    const lama = await env.sph_management_db.prepare('SELECT * FROM survey_teknis WHERE id=?').bind(id)
      .first<{ terkunci: number; jenis: string }>();
    if (!lama) return ok({ error: 'Survey tidak ditemukan' }, 404);
    if (lama.terkunci) return ok({ error: 'Survey terkunci — buka kunci dulu untuk mengubah' }, 409);

    // Nomor survey dibuat sekali, saat pertama kali disimpan
    if (!kolom.no_survey) {
      const cek = await env.sph_management_db.prepare('SELECT no_survey FROM survey_teknis WHERE id=?')
        .bind(id).first<{ no_survey: string | null }>();
      kolom.no_survey = cek?.no_survey || await nomorSurvey((kolom.tgl_survey as string) || now, env);
    }
    const entries = Object.entries({ ...kolom, diubah_oleh: aku.nama, updated_at: now });
    await env.sph_management_db
      .prepare(`UPDATE survey_teknis SET ${entries.map(([k]) => `${k}=?`).join(', ')} WHERE id=?`)
      .bind(...entries.map(([, v]) => v), id).run();
    await catat('survey', id, 'Diubah', aku.nama, null, env);
    return ok({ ok: true, id });
  }

  // POST — buat baru
  const idLead = String(kolom.id_lead || '');
  if (!idLead) return ok({ error: 'id_lead wajib diisi' }, 400);
  const jenis = (kolom.jenis === 'final' ? 'final' : 'sales');

  const proyek = await pastikanProyek(idLead, env);
  if (!proyek) return ok({ error: 'Lead tidak ditemukan' }, 404);

  // Satu survey per jenis per lead — kalau sudah ada, pakai baris itu
  const ada = await env.sph_management_db
    .prepare('SELECT id FROM survey_teknis WHERE id_lead=? AND jenis=? LIMIT 1').bind(idLead, jenis).first<{ id: string }>();
  if (ada) return ok({ ok: true, id: ada.id, sudahAda: true });

  const newId = crypto.randomUUID();
  kolom.id_lead = idLead;
  kolom.jenis = jenis;
  kolom.kode_proyek = kolom.kode_proyek || (proyek as { kode_proyek: string }).kode_proyek;
  kolom.no_survey = await nomorSurvey((kolom.tgl_survey as string) || now, env);
  kolom.status = 'Draft';

  const entries = Object.entries({ ...kolom, id: newId, dibuat_oleh: aku.nama, diubah_oleh: aku.nama, created_at: now, updated_at: now });
  await env.sph_management_db
    .prepare(`INSERT INTO survey_teknis (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`)
    .bind(...entries.map(([, v]) => v)).run();

  await catat('survey', newId, 'Dibuat', aku.nama, null, env, jenis === 'final' ? 'Final Survey' : 'Survey Sales');

  // Tahap proyek & status lead ikut bergerak
  await env.sph_management_db.prepare(`UPDATE proyek SET tahap_sekarang=?, updated_at=? WHERE id_lead=?`)
    .bind(jenis === 'final' ? 'FinalSurvey' : 'Survey', now, idLead).run();
  if (jenis === 'sales') {
    // Status lead ikut maju, dan perpindahannya WAJIB meninggalkan jejak —
    // dulu tidak, sehingga lead berpindah kolom di Kanban tanpa catatan.
    await pindahkanStatus(env, idLead, 'Survey Dijadwalkan', aku.nama,
      'Survey Sales dibuat',
      { statusAwal: ['Lead Baru', 'Kontak Pertama Dilakukan', 'Survey Dijadwalkan'], waktu: now, hanyaMaju: true });
  }

  return ok({ ok: true, id: newId, kode_proyek: kolom.kode_proyek });
}

/** Kunci / buka kunci Final Survey (PRD S6–S8). */
async function kunci(id: string, aksi: 'kunci' | 'buka', body: Record<string, unknown>, env: Env, userId: string) {
  const aku = await profilPemakai(userId, env);
  if (!PERAN_PENGUNCI.includes(aku.peran))
    return ok({ error: `Peran ${aku.peran} tidak berwenang ${aksi === 'kunci' ? 'mengunci' : 'membuka kunci'} Final Survey` }, 403);

  const row = await env.sph_management_db.prepare('SELECT * FROM survey_teknis WHERE id=?').bind(id)
    .first<{ terkunci: number; jenis: string; id_lead: string }>();
  if (!row) return ok({ error: 'Survey tidak ditemukan' }, 404);

  const now = new Date().toISOString();
  const alasan = (body.alasan as string) || null;

  if (aksi === 'kunci') {
    if (row.terkunci) return ok({ ok: true, sudah: true });
    await env.sph_management_db
      .prepare(`UPDATE survey_teknis SET terkunci=1, status='Terkunci', dikunci_oleh=?, dikunci_pada=?, diubah_oleh=?, updated_at=? WHERE id=?`)
      .bind(aku.nama, now, aku.nama, now, id).run();
    await catat('survey', id, 'Dikunci', aku.nama, alasan, env);
    await env.sph_management_db.prepare('UPDATE proyek SET tahap_sekarang=?, updated_at=? WHERE id_lead=?')
      .bind('PO', now, row.id_lead).run();
    await pindahkanStatus(env, row.id_lead, 'Final Survey Selesai', aku.nama,
      'Final Survey dikunci', { waktu: now, hanyaMaju: true });
    return ok({ ok: true, terkunci: true, dikunci_oleh: aku.nama, dikunci_pada: now });
  }

  if (!row.terkunci) return ok({ ok: true, sudah: true });
  if (!alasan) return ok({ error: 'Alasan buka kunci wajib diisi' }, 400);
  await env.sph_management_db
    .prepare(`UPDATE survey_teknis SET terkunci=0, status='Draft', diubah_oleh=?, updated_at=? WHERE id=?`)
    .bind(aku.nama, now, id).run();
  await catat('survey', id, 'Dibuka', aku.nama, alasan, env);
  await env.sph_management_db.prepare('UPDATE proyek SET tahap_sekarang=?, updated_at=? WHERE id_lead=?')
    .bind('FinalSurvey', now, row.id_lead).run();
  return ok({ ok: true, terkunci: false });
}

async function hapus(id: string, env: Env, userId: string) {
  const aku = await profilPemakai(userId, env);
  const row = await env.sph_management_db.prepare('SELECT terkunci FROM survey_teknis WHERE id=?').bind(id)
    .first<{ terkunci: number }>();
  if (!row) return ok({ error: 'Survey tidak ditemukan' }, 404);
  if (row.terkunci) return ok({ error: 'Survey terkunci tidak bisa dihapus' }, 409);
  await env.sph_management_db.prepare('DELETE FROM survey_riwayat WHERE jenis="survey" AND id_ref=?').bind(id).run();
  await env.sph_management_db.prepare('DELETE FROM survey_teknis WHERE id=?').bind(id).run();
  await catat('survey', id, 'Dihapus', aku.nama, null, env);
  return ok({ ok: true });
}

/** Proyek + seluruh tonggak tahap — untuk halaman Lacak (PRD 6F). */
async function lacak(idLead: string, env: Env, akses: Akses) {
  const proyek = await env.sph_management_db.prepare('SELECT * FROM proyek WHERE id_lead=?').bind(idLead).first();
  const lead = await env.sph_management_db.prepare('SELECT * FROM crm_leads WHERE id=?').bind(idLead).first<{ sales: string | null }>();
  if (!lead) return ok({ error: 'Lead tidak ditemukan' }, 404);

  // Batas kepemilikan. Halaman /lacak/:idLead dibuka untuk pemilik izin `crm`
  // MAUPUN `po` — dan sales memang punya `crm` — jadi tanpa pemeriksaan ini
  // seorang sales bisa menulis id_lead milik sales lain di URL dan melihat
  // seluruh dokumennya (SPH, PO, data teknis). Endpoint daftar/detail sudah
  // disaring lewat `saringPemilik`; endpoint ini dulu terlewat.
  if (!bolehSentuh(akses, lead.sales, 'lihat')) {
    return ok({ error: 'Lead ini bukan milik Anda.' }, 403);
  }

  const survey = await env.sph_management_db
    .prepare(`SELECT id, jenis, no_survey, tgl_survey, terkunci, dikunci_oleh, dikunci_pada, disurvey_oleh, surveyor, dt, updated_at
              FROM survey_teknis WHERE id_lead=? ORDER BY jenis`).bind(idLead).all();
  const po = await env.sph_management_db
    .prepare('SELECT * FROM po_pabrik WHERE id_lead=? ORDER BY datetime(created_at) DESC LIMIT 1').bind(idLead).first();
  const revisi = po ? await env.sph_management_db
    .prepare('SELECT id, rev, tgl_revisi, oleh, alasan, jml_perubahan, perubahan_setelah_final FROM po_revisi WHERE id_po=? ORDER BY rev')
    .bind((po as { id: string }).id).all() : { results: [] };
  const sph = await env.sph_management_db
    .prepare('SELECT id, nomor_sph, tanggal, status, items, lump_sum_total FROM sph WHERE id_lead=? ORDER BY datetime(created_at) DESC LIMIT 1')
    .bind(idLead).first();
  const riwayat = await env.sph_management_db
    .prepare(`SELECT r.* FROM survey_riwayat r
              WHERE (r.jenis='survey' AND r.id_ref IN (SELECT id FROM survey_teknis WHERE id_lead=?))
                 OR (r.jenis='po'     AND r.id_ref IN (SELECT id FROM po_pabrik    WHERE id_lead=?))
              ORDER BY r.waktu DESC LIMIT 200`).bind(idLead, idLead).all();

  const surveys = (survey.results || []).map(s => urai(s as Record<string, unknown>));
  const sales = surveys.find(s => (s as { jenis: string }).jenis === 'sales') || null;
  const final = surveys.find(s => (s as { jenis: string }).jenis === 'final') || null;

  return ok({
    proyek, lead, survey_sales: sales, final_survey: final,
    po: po ? { ...po, revisi: revisi.results || [] } : null,
    sph, riwayat: riwayat.results || [],
  });
}

// ── Router ──────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const method = request.method;
  const id = url.searchParams.get('id');
  const resource = url.searchParams.get('resource') || 'survey';
  const jenis = url.searchParams.get('jenis');

  // Hak akses per jenis survey: Survey Sales dan Final Survey punya
  // halaman sendiri, jadi bisa dibuka/ditutup terpisah per akun.
  //
  // `resource=lacak` dikecualikan: isinya bukan survey, melainkan rangkuman
  // seluruh tonggak (SPH → Final Survey → PO). Kalau ikut aturan di atas,
  // `jenis` kosong membuat izin yang ditegakkan jatuh ke `survey_sales` —
  // sehingga staff (punya survey_sales, tapi halaman Lacak dibuka dari detail
  // PO) dan pengguna yang hanya punya `po` ditolak 403 tanpa alasan yang jelas.
  let akses: Akses;
  if (resource === 'lacak') {
    const cekLacak = await wajibSalahSatu(request, env, ['crm', 'po']);
    if ('tolak' in cekLacak) return cekLacak.tolak;
    akses = cekLacak.akses;
  } else {
    const halaman = resource === 'survey' && jenis === 'final' ? 'survey_final' : 'survey_sales';
    const cek = await wajibHalaman(request, env, halaman);
    if ('tolak' in cek) return cek.tolak;
    akses = cek.akses;
  }
  const session = { user_id: akses.userId };

  let body: Record<string, unknown> = {};
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    body = await request.json().catch(() => ({})) as Record<string, unknown>;
  }

  try {
    switch (resource) {
      case 'survey':
        if (method === 'GET') return id ? detail(id, env, akses) : daftar(url, env, akses);
        if (method === 'POST' || method === 'PUT') {
          if (akses.cakupanUbah === 'tidak') {
            return ok({ error: 'Peran Anda tidak berwenang mengubah data.' }, 403);
          }
          if (method === 'PUT' && id) {
            const milik: any = await env.sph_management_db
              .prepare('SELECT surveyor FROM survey_teknis WHERE id=?').bind(id).first();
            if (!milik) return ok({ error: 'Survey tidak ditemukan' }, 404);
            if (!bolehSentuh(akses, milik.surveyor, 'ubah')) {
              return ok({ error: 'Survey ini bukan milik Anda, tidak dapat diubah.' }, 403);
            }
          }
          return simpan(method, id, body, env, session.user_id);
        }
        if (method === 'DELETE') {
          if (!id) return ok({ error: 'id wajib diisi' }, 400);
          if (!boleh(akses.izin, 'hapus_data')) {
            return ok({ error: 'Peran Anda tidak berwenang menghapus data.' }, 403);
          }
          const milik: any = await env.sph_management_db
            .prepare('SELECT surveyor FROM survey_teknis WHERE id=?').bind(id).first();
          if (!milik) return ok({ error: 'Survey tidak ditemukan' }, 404);
          if (!bolehSentuh(akses, milik.surveyor, 'ubah')) {
            return ok({ error: 'Survey ini bukan milik Anda, tidak dapat dihapus.' }, 403);
          }
          return hapus(id, env, session.user_id);
        }
        break;
      case 'kunci': {
        if (method !== 'POST') break;
        if (!id) return ok({ error: 'id wajib diisi' }, 400);
        // Hanya yang berwenang mengunci Final Survey.
        if (!boleh(akses.izin, 'kunci_final')) {
          return ok({ error: 'Peran Anda tidak berwenang mengunci Final Survey.' }, 403);
        }
        const aksi = url.searchParams.get('aksi') === 'buka' ? 'buka' : 'kunci';
        return kunci(id, aksi, body, env, session.user_id);
      }
      case 'lacak': {
        if (method !== 'GET') break;
        const idLead = url.searchParams.get('id_lead');
        if (!idLead) return ok({ error: 'id_lead wajib diisi' }, 400);
        return lacak(idLead, env, akses);
      }
      case 'proyek': {
        if (method === 'GET') {
          // Proyek hanya menampilkan lead yang boleh dilihat pengguna.
          const batas = saringPemilik(akses, 'l.sales');
          const res = await env.sph_management_db.prepare(
            `SELECT p.*, l.nama_prospek, l.kode_lead FROM proyek p LEFT JOIN crm_leads l ON l.id=p.id_lead
             WHERE 1=1${batas.sql}
             ORDER BY datetime(p.created_at) DESC LIMIT 500`).bind(...batas.params).all();
          return ok({ data: res.results || [] });
        }
        break;
      }
    }
    return ok({ error: `Aksi tidak dikenal: ${method} ${resource}` }, 405);
  } catch (e) {
    return ok({ error: (e as Error).message || 'Kesalahan server' }, 500);
  }
};
