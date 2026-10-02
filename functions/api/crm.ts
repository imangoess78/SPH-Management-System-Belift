import type { PagesFunction } from '@cloudflare/workers-types';
import { boleh } from '../../shared/akses';
import { bolehSentuh, saringPemilik, wajibHalaman, type Akses } from '../lib/akses';

interface Env { sph_management_db: D1Database }

// ════════════════════════════════════════════════════════════
// CRM LEADS — API modul CRM Sales
// Modul berdiri sendiri: tidak membaca/mengubah tabel sph/spk.
// ════════════════════════════════════════════════════════════

const KRITERIA = ['butuh_jelas', 'lokasi_siap', 'budget_masuk', 'rencana_6bulan', 'bicara_decider'] as const;
const POIN = 20;
const AMBANG_HOT = 80;
const AMBANG_WARM = 40;

const STATUS_SPH = ['SPH Terkirim', 'Negosiasi', 'Menunggu Approval Diskon', 'Deal - Menunggu Dokumen',
  'SPK Disusun', 'SPK Bernomor & Terkirim', 'SPK Ditandatangani + DP', 'KOM Terjadwal',
  'Selesai - Pindah ke File 00'];
const STATUS_DEAL = ['SPK Ditandatangani + DP', 'KOM Terjadwal', 'Selesai - Pindah ke File 00'];

const LEADS_COLS = ['kode_lead','waktu_masuk','kode_kanal','nama_prospek','no_hp','kota','kebutuhan','sales',
  'metode_assign','butuh_jelas','lokasi_siap','budget_masuk','rencana_6bulan','bicara_decider','waktu_kontak_pertama',
  'status_terakhir','no_sph','tgl_sph','nilai_sph','diskon_diminta','alasan_diskon','approver_wajib','status_approval',
  'tgl_approval','no_spk','tgl_spk','alasan_gugur','foto_lokasi','lokasi_gps','catatan'];

const DOKUMEN_COLS = ['id_lead','jenis_dokumen','masuk_meja','sla_jam','target_selesai','selesai','lama_jam',
  'status_sla','pic_admin','no_dokumen_terbit','catatan'];

// ── Utilitas ────────────────────────────────────────────────

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

/** Nama tampilan pemakai — untuk kolom "Diubah Oleh". */
async function namaPemakai(userId: string, env: Env): Promise<string> {
  // Utamakan nama dari app_users.full_name. Tabel `profiles` dibiarkan sebagai
  // cadangan saja: aplikasi tidak pernah mengisinya, dan memulai query dari
  // sana membuat kolom "Diubah Oleh" selalu tertulis 'Pengguna'.
  const p = await env.sph_management_db
    .prepare(`SELECT COALESCE(p.full_name, u.full_name) AS nama, u.email
              FROM app_users u LEFT JOIN profiles p ON p.user_id = u.id WHERE u.id=?`)
    .bind(userId)
    .first<{ nama: string | null; email: string | null }>();
  return p?.nama || p?.email || 'Pengguna';
}

/** Hitung skor: tiap kriteria "Ya" bernilai 20 poin. */
function hitungSkor(lead: Record<string, unknown>) {
  const skor = KRITERIA.reduce((t, k) => t + (lead[k] === 'Ya' ? POIN : 0), 0);
  const kualifikasi = skor >= AMBANG_HOT ? 'HOT' : skor >= AMBANG_WARM ? 'WARM' : 'COLD';
  return { skor, kualifikasi };
}

/** Selisih jam antara dua waktu ISO (dibulatkan 2 desimal). */
function selisihJam(dari?: string | null, ke?: string | null): number | null {
  if (!dari || !ke) return null;
  const a = new Date(dari).getTime(), b = new Date(ke).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round(((b - a) / 3_600_000) * 100) / 100;
}

/** Tentukan approver diskon dari tabel REF_DISKON. */
async function cariApprover(diskon: number | null | undefined, env: Env): Promise<string | null> {
  const d = Number(diskon || 0);
  if (!d || d <= 0) return 'Tidak Perlu';
  const rows = await env.sph_management_db
    .prepare('SELECT batas_bawah, batas_atas, approver FROM crm_ref_diskon ORDER BY batas_bawah').all();
  for (const r of (rows.results || []) as { batas_bawah: number; batas_atas: number; approver: string }[]) {
    if (d > Number(r.batas_bawah) && d <= Number(r.batas_atas)) return r.approver;
  }
  return 'Direktur';
}

/**
 * Nama kolom sebuah tabel, dibaca dari skema D1.
 *
 * Dipakai agar penulisan Master CRM hanya menyertakan kolom timestamp bila
 * tabelnya memang punya. Tabel acuan di sini tidak seragam: `crm_ref_sales`
 * dan `crm_biaya_iklan` punya `created_at`/`updated_at`, sedangkan
 * `crm_ref_kanal`, `crm_ref_diskon`, dan `crm_ref_status` tidak. Kode lama
 * mengasumsikan semuanya punya, sehingga menyimpan kanal/diskon/status selalu
 * gagal 500.
 *
 * Hasilnya di-cache per permintaan supaya tidak menembak D1 berulang kali.
 */
const cacheKolom = new Map<string, Set<string>>();
async function kolomTabel(env: Env, table: string): Promise<Set<string>> {
  const tersimpan = cacheKolom.get(table);
  if (tersimpan) return tersimpan;
  // Nama tabel berasal dari daftar tetap `pk`/`order` di atas, bukan masukan
  // pengguna, jadi aman disisipkan ke PRAGMA.
  const info = await env.sph_management_db.prepare(`PRAGMA table_info(${table})`).all();
  const baris = (info.results || []) as { name: string }[];
  const kolom = new Set<string>(baris.map(r => String(r.name)));
  cacheKolom.set(table, kolom);
  return kolom;
}

/** foto_lokasi disimpan sebagai JSON array — kembalikan sebagai array. */
function parseFoto(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v.trim()) { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } }
  return [];
}

/**
 * Bentuk baris lead sesudah dibersihkan.
 *
 * `status_terakhir` (dan kolom teks lain) sengaja ditulis eksplisit. Sebelumnya
 * fungsi ini mengembalikan tipe sempit yang HANYA memuat foto_lokasi dan
 * nilai_sph, sehingga pemakaian `l.status_terakhir` di tempat lain diperiksa
 * sebagai kolom yang tidak ada — padahal datanya jelas ada karena hasilnya
 * adalah gabungan seluruh kolom dari database.
 */
interface LeadBersih extends Record<string, unknown> {
  status_terakhir?: string | null;
  sales?: string | null;
  nilai_sph: number | null;
  foto_lokasi: unknown[];
}

function bersihkanLead(row: Record<string, unknown>): LeadBersih {
  return {
    ...row,
    foto_lokasi: parseFoto(row.foto_lokasi),
    nilai_sph: row.nilai_sph === null || row.nilai_sph === undefined ? null : Number(row.nilai_sph),
  };
}

/** Ambil nilai dari body, hanya untuk kolom yang dikenal. */
function ambilKolom(body: Record<string, unknown>, cols: string[]) {
  const out: Record<string, unknown> = {};
  for (const c of cols) if (c in body) out[c] = body[c] === '' ? null : body[c];
  return out;
}

// ── Handler per-resource ────────────────────────────────────

async function listLeads(url: URL, env: Env, akses: Akses) {
  const where: string[] = [], params: unknown[] = [];
  const status = url.searchParams.get('status');
  const sales = url.searchParams.get('sales');
  const kanal = url.searchParams.get('kode_kanal');
  const kual = url.searchParams.get('kualifikasi');
  const q = url.searchParams.get('q');
  const dari = url.searchParams.get('dari');
  const sampai = url.searchParams.get('sampai');

  if (status)   { where.push('status_terakhir = ?'); params.push(status); }
  if (sales)    { where.push('sales = ?');            params.push(sales); }
  if (kanal)    { where.push('kode_kanal = ?');       params.push(kanal); }
  if (kual)     { where.push('kualifikasi = ?');      params.push(kual); }
  if (dari)     { where.push('waktu_masuk >= ?');     params.push(dari); }
  if (sampai)   { where.push('waktu_masuk < ?');      params.push(sampai); }
  if (q) {
    where.push('(nama_prospek LIKE ? OR no_hp LIKE ? OR kota LIKE ? OR kode_lead LIKE ? OR kebutuhan LIKE ?)');
    const like = `%${q}%`; params.push(like, like, like, like, like);
  }

  // Batasan data: sales hanya boleh melihat lead miliknya sendiri.
  // Ini wajib di server — parameter `sales` di atas hanyalah filter tampilan
  // yang bisa dihilangkan siapa pun.
  const batas = saringPemilik(akses, 'sales');
  if (batas.sql) { where.push(batas.sql.replace(/^ AND /, '')); params.push(...batas.params); }

  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const countRow = await env.sph_management_db
    .prepare(`SELECT COUNT(*) AS n FROM crm_leads${clause}`).bind(...params)
    .first<{ n: number }>();

  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 500);
  const page = Math.max(Number(url.searchParams.get('page') || 1), 1);
  const offset = (page - 1) * limit;

  const rows = await env.sph_management_db
    .prepare(`SELECT * FROM crm_leads${clause} ORDER BY datetime(waktu_masuk) DESC, created_at DESC LIMIT ? OFFSET ?`)
    .bind(...params, limit, offset).all();

  return ok({
    data: (rows.results || []).map(r => bersihkanLead(r as Record<string, unknown>)),
    total: countRow?.n ?? 0, page, limit,
  });
}

async function detailLead(id: string, env: Env, akses: Akses) {
  const row = await env.sph_management_db.prepare('SELECT * FROM crm_leads WHERE id=?').bind(id).first<any>();
  if (!row) return ok({ error: 'Lead tidak ditemukan' }, 404);

  // Lead milik sales lain tidak boleh dibuka, walau id-nya diketahui.
  if (!bolehSentuh(akses, row.sales, 'lihat')) {
    return ok({ error: 'Lead ini bukan milik Anda.' }, 403);
  }
  const riwayat = await env.sph_management_db
    // Urutkan dengan kolom teks ISO apa adanya. datetime(waktu) memotong
    // milidetik, sehingga beberapa perubahan di detik yang sama tampil
    // dalam urutan acak — jejak audit jadi menyesatkan.
    .prepare('SELECT * FROM crm_lead_riwayat WHERE id_lead=? ORDER BY waktu DESC LIMIT 50').bind(id).all();
  const dokumen = await env.sph_management_db
    .prepare('SELECT * FROM crm_dokumen WHERE id_lead=? ORDER BY datetime(created_at) DESC').bind(id).all();
  return ok({ data: bersihkanLead(row as Record<string, unknown>), riwayat: riwayat.results || [], dokumen: dokumen.results || [] });
}

async function simpanLead(method: string, id: string | null, body: Record<string, unknown>, env: Env, userId: string) {
  const kolom = ambilKolom(body, LEADS_COLS);

  // Ambil baris lama dulu. Untuk PUT, skor/approver harus dihitung dari data
  // GABUNGAN (lama + yang diubah) — kalau tidak, update parsial seperti
  // "ubah status saja" akan menghitung skor dari 0 kriteria dan menimpanya jadi 0.
  const lama = method === 'PUT' && id
    ? await env.sph_management_db.prepare(
        'SELECT butuh_jelas, lokasi_siap, budget_masuk, rencana_6bulan, bicara_decider, ' +
        'diskon_diminta, waktu_masuk, waktu_kontak_pertama, alasan_gugur, nilai_sph, status_terakhir, no_sph ' +
        'FROM crm_leads WHERE id=?').bind(id)
        .first<Record<string, unknown>>()
    : null;
  if (method === 'PUT' && !lama) return ok({ error: 'Lead tidak ditemukan' }, 404);

  const gabung: Record<string, unknown> = { ...(lama || {}), ...kolom };

  // 1. Skor & kualifikasi selalu dihitung di server dari data gabungan
  const { skor, kualifikasi } = hitungSkor(gabung);
  kolom.skor = skor;
  kolom.kualifikasi = kualifikasi;

  // 2. Respons jam dihitung dari waktu masuk -> kontak pertama
  const responsJam = selisihJam(gabung.waktu_masuk as string, gabung.waktu_kontak_pertama as string);
  if (responsJam !== null) kolom.respons_jam = responsJam;

  // 3. Approver diskon mengikuti jenjang REF_DISKON
  if ('diskon_diminta' in kolom) kolom.approver_wajib = await cariApprover(gabung.diskon_diminta as number, env);

  // 4. Gugur wajib ada alasan
  if (gabung.status_terakhir === 'Gugur' && !String(gabung.alasan_gugur || '').trim())
    return ok({ error: 'Alasan gugur wajib diisi' }, 400);

  // 5. Nilai SPH wajib begitu penawaran sudah terkirim ke prospek.
  //    Dicek dari data gabungan supaya update status saja tidak bisa
  //    menyelundupkan lead ke status penawaran tanpa nominal.
  const statusBaru = gabung.status_terakhir as string | undefined;
  if (statusBaru && STATUS_SPH.includes(statusBaru)) {
    const nilaiAkhir = 'nilai_sph' in kolom ? kolom.nilai_sph : (lama?.nilai_sph ?? undefined);
    if (nilaiAkhir === undefined || nilaiAkhir === null || Number(nilaiAkhir) <= 0)
      return ok({ error: `Nilai SPH wajib diisi untuk status "${statusBaru}"` }, 400);
  }

  // 5b. Nomor SPH wajib ada kalau nilai SPH diisi
  if ('nilai_sph' in kolom && Number(kolom.nilai_sph) > 0 && !String(gabung.no_sph || '').trim())
    return ok({ error: 'No SPH wajib diisi kalau Nilai SPH diisi' }, 400);

  // 5c. Status wajib salah satu status resmi di Master CRM.
  //     LOMPAT status diperbolehkan (alur tidak kaku) — lead boleh maju
  //     beberapa langkah sekaligus, itu keputusan tim. Yang ditolak hanya
  //     status KARANGAN: dulu server menerima apa saja, dan lead dengan
  //     status tak dikenal hilang dari seluruh kolom Kanban lalu mendarat di
  //     keranjang "Status tak dikenal" — tim sales tidak bisa menemukannya.
  if (statusBaru) {
    const resmi = await env.sph_management_db
      .prepare('SELECT 1 FROM crm_ref_status WHERE status=? LIMIT 1').bind(statusBaru).first();
    if (!resmi) return ok({ error: `Status "${statusBaru}" tidak dikenal di Master CRM` }, 400);
  }

  // 6. Foto lokasi disimpan sebagai JSON
  if ('foto_lokasi' in kolom) kolom.foto_lokasi = JSON.stringify(parseFoto(kolom.foto_lokasi));

  const now = new Date().toISOString();
  const oleh = await namaPemakai(userId, env);
  kolom.diubah_oleh = oleh;
  kolom.waktu_diubah = now;

  if (method === 'POST') {
    const newId = String(body.id || crypto.randomUUID());
    // Kode lead otomatis: LEAD-0001, LEAD-0002, ...
    let kode = kolom.kode_lead as string | undefined;
    if (!kode) {
      const last = await env.sph_management_db
        .prepare("SELECT kode_lead FROM crm_leads WHERE kode_lead LIKE 'LEAD-%' ORDER BY kode_lead DESC LIMIT 1")
        .first<{ kode_lead: string }>();
      const next = last?.kode_lead ? Number(last.kode_lead.split('-')[1]) + 1 : 1;
      kode = `LEAD-${String(next).padStart(4, '0')}`;
    }
    // Status awal WAJIB ikut tersimpan di barisnya, bukan hanya di riwayat.
    // Dulu kolomnya dibiarkan NULL dan riwayat menulis 'Lead Baru', sehingga
    // catatan riwayat tidak cocok dengan datanya sendiri: perubahan status
    // pertama mencatat dari_status=NULL (seolah belum pernah punya status),
    // padahal lead baru selalu mulai dari 'Lead Baru'.
    if (!kolom.status_terakhir) kolom.status_terakhir = 'Lead Baru';
    const entries = Object.entries({ ...kolom, kode_lead: kode, id: newId, created_at: now, updated_at: now });
    await env.sph_management_db
      .prepare(`INSERT INTO crm_leads (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`)
      .bind(...entries.map(([, v]) => v)).run();
    await catatRiwayat(newId, null, kolom.status_terakhir as string, oleh, 'Lead dibuat', env);
    return ok({ ok: true, id: newId, kode_lead: kode, skor, kualifikasi });
  }
  // PUT
  if (!id) return ok({ error: 'id wajib diisi' }, 400);

  // Sampai di sini method pasti PUT, dan baris lama sudah dijamin ada oleh
  // pemeriksaan di atas. Ditegaskan lagi di sini supaya pemeriksa tipe ikut
  // yakin — bukan karena ada kemungkinan lain.
  if (!lama) return ok({ error: 'Lead tidak ditemukan' }, 404);

  const entries = Object.entries(kolom);
  if (!entries.length) return ok({ error: 'Tidak ada kolom yang diubah' }, 400);
  await env.sph_management_db
    .prepare(`UPDATE crm_leads SET ${entries.map(([k]) => `${k}=?`).join(',')}, updated_at=? WHERE id=?`)
    .bind(...entries.map(([, v]) => v), now, id).run();

  // Catat perubahan status ke riwayat
  if ('status_terakhir' in kolom && kolom.status_terakhir !== lama.status_terakhir) {
    await catatRiwayat(id, (lama.status_terakhir as string | null) ?? null,
      kolom.status_terakhir as string, oleh, String(body.catatan_riwayat || ''), env);
    // Pemicu: status "Deal - Menunggu Dokumen" -> buat baris antrean di Meja Dokumen
    if (kolom.status_terakhir === 'Deal - Menunggu Dokumen') {
      const ada = await env.sph_management_db
        .prepare('SELECT 1 FROM crm_dokumen WHERE id_lead=? AND (selesai IS NULL OR selesai=?)').bind(id, '').first();
      if (!ada) {
        const masuk = now, sla = 24;
        await env.sph_management_db.prepare(
          `INSERT INTO crm_dokumen (id,id_lead,jenis_dokumen,masuk_meja,sla_jam,target_selesai,status_sla,created_at,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)`
        ).bind(crypto.randomUUID(), id, 'SPK Induk', masuk, sla,
               new Date(new Date(masuk).getTime() + sla * 3_600_000).toISOString(), 'Menunggu diproses', now, now).run();
      }
    }
  }
  return ok({ ok: true, skor, kualifikasi });
}

async function catatRiwayat(idLead: string, dari: string | null, ke: string, oleh: string, catatan: string, env: Env) {
  await env.sph_management_db.prepare(
    'INSERT INTO crm_lead_riwayat (id,id_lead,waktu,dari_status,ke_status,oleh,catatan) VALUES (?,?,?,?,?,?,?)'
  ).bind(crypto.randomUUID(), idLead, new Date().toISOString(), dari, ke, oleh, catatan || null).run();
}

/** Kanban: lead dikelompokkan per status, urut sesuai REF_STATUS. */
async function kanban(url: URL, env: Env, akses: Akses) {
  const sales = url.searchParams.get('sales');
  const kanal = url.searchParams.get('kode_kanal');
  const where: string[] = ["COALESCE(status_terakhir,'Lead Baru') <> 'Gugur'"], params: unknown[] = [];
  if (sales) { where.push('sales = ?'); params.push(sales); }
  if (kanal) { where.push('kode_kanal = ?'); params.push(kanal); }

  // Sales hanya melihat papan miliknya sendiri.
  const batas = saringPemilik(akses, 'sales');
  if (batas.sql) { where.push(batas.sql.replace(/^ AND /, '')); params.push(...batas.params); }

  const statuses = await env.sph_management_db
    .prepare('SELECT * FROM crm_ref_status WHERE status <> ? ORDER BY urutan').bind('Gugur').all();
  const rows = await env.sph_management_db
    .prepare(`SELECT * FROM crm_leads WHERE ${where.join(' AND ')} ORDER BY datetime(waktu_masuk) DESC LIMIT 1000`)
    .bind(...params).all();

  const leads = (rows.results || []).map(r => bersihkanLead(r as Record<string, unknown>));
  const kolom = ((statuses.results || []) as { status: string; urutan: number; pemilik: string }[]).map(s => ({
    status: s.status, urutan: Number(s.urutan), pemilik: s.pemilik,
    leads: leads.filter(l => (l.status_terakhir || 'Lead Baru') === s.status),
  }));

  // Lead dengan status yang tidak ada di REF_STATUS jangan sampai hilang
  const dikenal = new Set(kolom.map(k => k.status));
  const nyasar = leads.filter(l => !dikenal.has((l.status_terakhir as string) || 'Lead Baru'));
  if (nyasar.length) kolom.push({ status: 'Status tak dikenal', urutan: 9999, pemilik: '-', leads: nyasar });

  return ok({ kolom, total: leads.length });
}

/** Dashboard efektivitas iklan: CPL, CAC, konversi, ROAS per kanal. */
async function dashboard(url: URL, env: Env, akses: Akses) {
  const periode = url.searchParams.get('periode') || new Date().toISOString().slice(0, 7);
  const dari = `${periode}-01T00:00:00.000Z`;
  const [y, m] = periode.split('-').map(Number);
  const sampai = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1)).toISOString();

  const inSph = STATUS_SPH.map(() => '?').join(',');
  const inDeal = STATUS_DEAL.map(() => '?').join(',');

  // Angka efektivitas iklan juga ikut dibatasi: sales hanya melihat
  // kanal dari lead miliknya, bukan seluruh perusahaan.
  const batas = saringPemilik(akses, 'sales');
  const batasSql = batas.sql ? ` AND 1=1${batas.sql}` : '';

  const agg = await env.sph_management_db.prepare(`
    SELECT kode_kanal,
      COUNT(*) AS jml_lead,
      SUM(CASE WHEN kualifikasi='HOT'  THEN 1 ELSE 0 END) AS jml_hot,
      SUM(CASE WHEN kualifikasi='WARM' THEN 1 ELSE 0 END) AS jml_warm,
      SUM(CASE WHEN kualifikasi='COLD' THEN 1 ELSE 0 END) AS jml_cold,
      SUM(CASE WHEN status_terakhir='Gugur' THEN 1 ELSE 0 END) AS jml_gugur,
      SUM(CASE WHEN status_terakhir IN (${inSph}) THEN 1 ELSE 0 END) AS jml_sph,
      SUM(CASE WHEN status_terakhir IN (${inDeal}) THEN 1 ELSE 0 END) AS jml_deal,
      SUM(CASE WHEN status_terakhir IN (${inSph})  THEN COALESCE(nilai_sph,0) ELSE 0 END) AS nilai_penawaran,
      SUM(CASE WHEN status_terakhir IN (${inDeal}) THEN COALESCE(nilai_sph,0) ELSE 0 END) AS nilai_deal
    FROM crm_leads WHERE waktu_masuk >= ? AND waktu_masuk < ?${batasSql}
    GROUP BY kode_kanal`
  ).bind(...STATUS_SPH, ...STATUS_DEAL, ...STATUS_SPH, ...STATUS_DEAL, dari, sampai, ...batas.params).all();
  const biaya = await env.sph_management_db
    .prepare('SELECT kode_kanal, SUM(biaya) AS biaya FROM crm_biaya_iklan WHERE periode=? GROUP BY kode_kanal')
    .bind(periode).all();

  const kanal = await env.sph_management_db.prepare('SELECT kode, kelompok, kanal FROM crm_ref_kanal').all();
  const mapBiaya = new Map<string, number>();
  for (const b of (biaya.results || []) as { kode_kanal: string; biaya: number }[]) mapBiaya.set(b.kode_kanal, Number(b.biaya));
  const mapKanal = new Map<string, { kelompok: string; kanal: string }>();
  for (const k of (kanal.results || []) as { kode: string; kelompok: string; kanal: string }[]) mapKanal.set(k.kode, { kelompok: k.kelompok, kanal: k.kanal });

  const hasil = ((agg.results || []) as Record<string, number | string>[]).map(r => {
    const kode = String(r.kode_kanal || '');
    const jmlLead = Number(r.jml_lead) || 0;
    const jmlSph = Number(r.jml_sph) || 0;
    const jmlDeal = Number(r.jml_deal) || 0;
    const b = mapBiaya.get(kode) || 0;
    const nilaiDeal = Number(r.nilai_deal) || 0;
    return {
      kode_kanal: kode,
      nama_kanal: mapKanal.get(kode)?.kanal || kode || '(tanpa kanal)',
      kelompok: mapKanal.get(kode)?.kelompok || 'Lainnya',
      jml_lead: jmlLead,
      jml_hot: Number(r.jml_hot) || 0,
      jml_warm: Number(r.jml_warm) || 0,
      jml_cold: Number(r.jml_cold) || 0,
      jml_gugur: Number(r.jml_gugur) || 0,
      jml_sph: jmlSph,
      jml_deal: jmlDeal,
      biaya: b,
      cpl: jmlLead ? b / jmlLead : null,
      cac: jmlDeal ? b / jmlDeal : null,
      konversi_sph: jmlLead ? jmlSph / jmlLead : null,
      konversi_deal: jmlLead ? jmlDeal / jmlLead : null,
      nilai_penawaran: Number(r.nilai_penawaran) || 0,
      nilai_deal: nilaiDeal,
      roas: b ? nilaiDeal / b : null,
    };
  }).sort((a, b) => b.jml_lead - a.jml_lead);

  // Ringkasan seluruh kanal
  const jumlah = (f: (k: typeof hasil[number]) => number) => hasil.reduce((t, k) => t + f(k), 0);
  const totalBiaya = jumlah(k => k.biaya), totalLead = jumlah(k => k.jml_lead), totalDeal = jumlah(k => k.jml_deal);
  const totalNilaiDeal = jumlah(k => k.nilai_deal);
  const totalSph = jumlah(k => k.jml_sph);

  // Lead yang sudah dapat penawaran tapi Nilai SPH belum diisi -> laporan bisa kurang hitung
  const nilaiKosong = await env.sph_management_db.prepare(`
    SELECT COUNT(*) AS n FROM crm_leads
    WHERE waktu_masuk >= ? AND waktu_masuk < ? AND status_terakhir IN (${inSph})
      AND (nilai_sph IS NULL OR nilai_sph = 0)`
  ).bind(dari, sampai, ...STATUS_SPH).first<{ n: number }>();

  return ok({
    periode,
    ringkasan: {
      total_biaya: totalBiaya, total_lead: totalLead, total_sph: totalSph, total_deal: totalDeal,
      cpl: totalLead ? totalBiaya / totalLead : null,
      cac: totalDeal ? totalBiaya / totalDeal : null,
      konversi_sph: totalLead ? totalSph / totalLead : null,
      konversi_deal: totalLead ? totalDeal / totalLead : null,
      nilai_deal: totalNilaiDeal,
      roas: totalBiaya ? totalNilaiDeal / totalBiaya : null,
      lead_tanpa_nilai: nilaiKosong?.n ?? 0,
    },
    per_kanal: hasil,
  });
}

// ── Router ──────────────────────────────────────────────────

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  // Hak akses diperiksa di server. Menyembunyikan menu di tampilan tidak
  // mengamankan apa pun — API tetap harus menolak.
  const cek = await wajibHalaman(request, env, 'crm');
  if ('tolak' in cek) return cek.tolak;
  const akses = cek.akses;
  const session = { user_id: akses.userId };

  const url = new URL(request.url);
  const resource = url.searchParams.get('resource') || 'leads';
  const id = url.searchParams.get('id');
  const method = request.method;

  let body: Record<string, unknown> = {};
  if (method === 'POST' || method === 'PUT') {
    body = await request.json().catch(() => ({})) as Record<string, unknown>;
  }

  try {
    switch (resource) {
      // ── LEADS ──
      case 'leads':
        if (method === 'GET') return id ? detailLead(id, env, akses) : listLeads(url, env, akses);
        if (method === 'POST' || method === 'PUT') {
          // Ubah data: butuh wewenang ubah, dan hanya untuk lead sendiri
          // kecuali punya izin ubah_semua.
          if (akses.cakupanUbah === 'tidak') {
            return ok({ error: 'Peran Anda tidak berwenang mengubah data.' }, 403);
          }
          if (method === 'PUT' && id) {
            const milik = await env.sph_management_db.prepare('SELECT sales FROM crm_leads WHERE id=?')
              .bind(id).first<{ sales: string | null }>();
            if (!milik) return ok({ error: 'Lead tidak ditemukan' }, 404);
            if (!bolehSentuh(akses, milik.sales, 'ubah')) {
              return ok({ error: 'Lead ini bukan milik Anda, tidak dapat diubah.' }, 403);
            }
          }
          // Hanya yang berwenang memindahkan lead boleh menetapkan sales lain.
          if (body.sales !== undefined && !boleh(akses.izin, 'reassign_lead')) {
            return ok({ error: 'Anda tidak berwenang memindahkan lead ke sales lain.' }, 403);
          }
          if (method === 'POST' && body.sales === undefined && !boleh(akses.izin, 'reassign_lead')) {
            body.sales = akses.namaSales;  // lead baru otomatis milik pembuatnya
          }
          return simpanLead(method, id, body, env, session.user_id);
        }
        if (method === 'DELETE') {
          if (!id) return ok({ error: 'id wajib diisi' }, 400);
          if (!boleh(akses.izin, 'hapus_data')) {
            return ok({ error: 'Peran Anda tidak berwenang menghapus data.' }, 403);
          }
          const milik = await env.sph_management_db.prepare('SELECT sales FROM crm_leads WHERE id=?')
            .bind(id).first<{ sales: string | null }>();
          if (!milik) return ok({ error: 'Lead tidak ditemukan' }, 404);
          if (!bolehSentuh(akses, milik.sales, 'ubah')) {
            return ok({ error: 'Lead ini bukan milik Anda, tidak dapat dihapus.' }, 403);
          }
          await env.sph_management_db.prepare('DELETE FROM crm_lead_riwayat WHERE id_lead=?').bind(id).run();
          await env.sph_management_db.prepare('DELETE FROM crm_dokumen WHERE id_lead=?').bind(id).run();
          const r = await env.sph_management_db.prepare('DELETE FROM crm_leads WHERE id=?').bind(id).run();
          if (!r.meta?.changes) return ok({ error: 'Lead tidak ditemukan' }, 404);
          return ok({ ok: true });
        }
        break;

      case 'kanban':
        if (method === 'GET') return kanban(url, env, akses);
        break;

      case 'dashboard':
        if (method === 'GET') return dashboard(url, env, akses);
        break;

      // ── DOKUMEN ──
      case 'dokumen': {
        if (method === 'GET') {
          const idLead = url.searchParams.get('id_lead');
          const sql = `SELECT d.*, l.nama_prospek, l.kode_lead, l.sales, l.kode_kanal
                       FROM crm_dokumen d LEFT JOIN crm_leads l ON l.id = d.id_lead
                       ${idLead ? 'WHERE d.id_lead = ?' : ''} ORDER BY datetime(d.masuk_meja) DESC LIMIT 300`;
          const stmt = env.sph_management_db.prepare(sql);
          const res = await (idLead ? stmt.bind(idLead) : stmt).all();
          return ok({ data: res.results || [] });
        }
        if (method === 'POST' || method === 'PUT') {
          const kolom = ambilKolom(body, DOKUMEN_COLS);
          // Lama jam & status SLA dihitung otomatis dari masuk meja -> selesai
          const lama = selisihJam(kolom.masuk_meja as string, kolom.selesai as string);
          if (lama !== null) {
            kolom.lama_jam = lama;
            const sla = Number(kolom.sla_jam || 24);
            kolom.status_sla = lama <= sla ? 'Selesai tepat waktu' : 'Melebihi SLA';
          }
          const now = new Date().toISOString();
          if (method === 'POST') {
            const entries = Object.entries({ ...kolom, id: String(body.id || crypto.randomUUID()), created_at: now, updated_at: now });
            await env.sph_management_db
              .prepare(`INSERT INTO crm_dokumen (${entries.map(([k]) => k).join(',')}) VALUES (${entries.map(() => '?').join(',')})`)
              .bind(...entries.map(([, v]) => v)).run();
            return ok({ ok: true });
          }
          if (!id) return ok({ error: 'id wajib diisi' }, 400);
          const entries = Object.entries(kolom);
          if (!entries.length) return ok({ error: 'Tidak ada kolom yang diubah' }, 400);
          await env.sph_management_db
            .prepare(`UPDATE crm_dokumen SET ${entries.map(([k]) => `${k}=?`).join(',')}, updated_at=? WHERE id=?`)
            .bind(...entries.map(([, v]) => v), now, id).run();
          return ok({ ok: true });
        }
        if (method === 'DELETE') {
          if (!id) return ok({ error: 'id wajib diisi' }, 400);
          await env.sph_management_db.prepare('DELETE FROM crm_dokumen WHERE id=?').bind(id).run();
          return ok({ ok: true });
        }
        break;
      }

      // ── MASTER / REFERENSI ──
      case 'ref_kanal': case 'ref_sales': case 'ref_diskon': case 'ref_status': case 'biaya_iklan': {
        const order: Record<string, string> = {
          ref_kanal: 'urutan', ref_sales: 'peran, nama', ref_diskon: 'batas_bawah',
          ref_status: 'urutan', biaya_iklan: 'periode DESC, kode_kanal',
        };
        const pk: Record<string, string> = {
          ref_kanal: 'kode', ref_sales: 'id', ref_diskon: 'id', ref_status: 'status', biaya_iklan: 'id',
        };
        const key = pk[resource], table = `crm_${resource}`;

        if (method === 'GET') {
          const where = resource === 'biaya_iklan' && url.searchParams.get('periode') ? ' WHERE periode=?' : '';
          const stmt = env.sph_management_db.prepare(`SELECT * FROM ${table}${where} ORDER BY ${order[resource]}`);
          const res = await (where ? stmt.bind(url.searchParams.get('periode')) : stmt).all();
          return ok({ data: res.results || [] });
        }
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          // LUBANG YANG PERNAH ADA: cabang ini dulu hanya dijaga `crm`, sehingga
          // peran sales (punya `crm`, TIDAK punya `master`) bisa menambah,
          // mengubah, dan menghapus Master CRM — kanal, batas diskon, daftar
          // sales, status, biaya iklan. Menu "Master CRM" memang tersembunyi
          // dari sales, tapi menyembunyikan menu bukan pengamanan: API-nya
          // tetap bisa ditembak langsung. Sekarang tulis master wajib `master`.
          if (!boleh(akses.izin, 'master')) {
            return ok({ error: 'Akses ditolak: hanya pengelola Master Data yang boleh mengubah data acuan.', kode: 'TIDAK_BERHAK' }, 403);
          }
        }
        if (method === 'POST' || method === 'PUT') {
          const now = new Date().toISOString();
          const bodyClean = { ...body };
          if (method === 'POST' && !bodyClean[key]) bodyClean[key] = resource === 'ref_kanal' ? bodyClean.kode : crypto.randomUUID();
          delete bodyClean.created_at; delete bodyClean.updated_at;
          const entries = Object.entries(bodyClean);
          if (!entries.length) return ok({ error: 'Tidak ada data' }, 400);

          // BUG YANG PERNAH ADA: kode ini selalu menulis `created_at` dan
          // `updated_at`, padahal tiga tabel acuan (crm_ref_kanal,
          // crm_ref_diskon, crm_ref_status) TIDAK punya kolom itu. Akibatnya
          // setiap tambah/ubah di Master CRM gagal dengan 500
          // "table crm_ref_kanal has no column named created_at" — tombol
          // Simpan tampak rusak total. Diperiksa dulu, baru ditulis, supaya
          // aman untuk tabel yang punya maupun tidak punya kolom timestamp.
          const kolomAda = await kolomTabel(env, table);

          if (method === 'POST') {
            const all: Record<string, unknown> = { ...Object.fromEntries(entries) };
            if (kolomAda.has('created_at')) all.created_at = now;
            if (kolomAda.has('updated_at')) all.updated_at = now;
            const e2 = Object.entries(all);
            await env.sph_management_db
              .prepare(`INSERT INTO ${table} (${e2.map(([k]) => k).join(',')}) VALUES (${e2.map(() => '?').join(',')})`)
              .bind(...e2.map(([, v]) => v)).run();
            return ok({ ok: true, id: bodyClean[key] });
          }
          const target = id || bodyClean[key];
          if (!target) return ok({ error: `${key} wajib diisi` }, 400);
          const set = entries.map(([k]) => `${k}=?`);
          const nilai: unknown[] = entries.map(([, v]) => v);
          if (kolomAda.has('updated_at')) { set.push('updated_at=?'); nilai.push(now); }
          await env.sph_management_db
            .prepare(`UPDATE ${table} SET ${set.join(',')} WHERE ${key}=?`)
            .bind(...nilai, target).run();
          return ok({ ok: true });
        }
        if (method === 'DELETE') {
          const target = id || url.searchParams.get(key);
          if (!target) return ok({ error: `${key} wajib diisi` }, 400);
          await env.sph_management_db.prepare(`DELETE FROM ${table} WHERE ${key}=?`).bind(target).run();
          return ok({ ok: true });
        }
        break;
      }

      // ── META: semua referensi sekaligus untuk dropdown form ──
      case 'meta': {
        const [kanal, sales, diskon, status] = await Promise.all([
          env.sph_management_db.prepare('SELECT * FROM crm_ref_kanal WHERE aktif=1 ORDER BY urutan').all(),
          env.sph_management_db.prepare('SELECT * FROM crm_ref_sales ORDER BY peran, nama').all(),
          env.sph_management_db.prepare('SELECT * FROM crm_ref_diskon ORDER BY batas_bawah').all(),
          env.sph_management_db.prepare('SELECT * FROM crm_ref_status ORDER BY urutan').all(),
        ]);
        return ok({
          kanal: kanal.results || [], sales: sales.results || [],
          diskon: diskon.results || [], status: status.results || [],
        });
      }
    }
    return ok({ error: `Resource tidak dikenal: ${resource}` }, 400);
  } catch (e) {
    return ok({ error: 'Kesalahan server: ' + (e instanceof Error ? e.message : String(e)) }, 500);
  }
};
