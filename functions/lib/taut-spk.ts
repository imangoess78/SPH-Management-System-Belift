// ============================================================
//  PENAUT SPK → LEAD
//
//  Dipakai saat Final Survey dimulai dari sebuah dokumen SPK, bukan dari
//  lead. Di lapangan tim kerap melompat: langsung SPH → SPK, lalu baru
//  Final Survey. Dokumen SPK itu sendiri tidak menyimpan `id_lead` (fungsi
//  `saveDocument()` tidak pernah menulisnya), sehingga tidak ada jalan dari
//  dokumen kembali ke lead.
//
//  Tugas modul ini: mencari lead yang cocok untuk sebuah SPK, dan bila
//  memang belum ada, membuatnya — supaya Final Survey selalu punya id_lead
//  (kolom itu NOT NULL) dan seluruh alur lain (PO, Lacak, Dasbor) tetap
//  berjalan tanpa diubah.
//
//  Modul ini HANYA mengurus pemetaan SPK → lead. Pembuatan baris `proyek`
//  tetap di `pastikanProyek()` (functions/api/survey.ts); UI hanya memakai
//  mesin nama di sini agar yang ditampilkan sama persis dengan yang dicari.
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import { namaCustomerDokumen, rapikanNama, type SpkFinal } from '../../shared/spk-dokumen';

export interface HasilTaut {
  id_lead: string;
  kode_lead: string | null;
  /** true bila lead-nya baru dibuat oleh pemanggilan ini. */
  baru: boolean;
  /** 'id_lead dokumen' | 'nama cocok' | 'nama+kota cocok' | 'dibuat baru'. */
  cara: string;
}

/**
 * Cocokkan nama customer SPK dengan `crm_leads.nama_prospek`.
 * Dibandingkan setelah tanda baca & spasi dirapikan, dan huruf besar/kecil
 * diabaikan. Baris yang sudah punya `id_proyek` didahulukan karena itulah
 * lead yang benar-benar sudah jalan sebagai proyek.
 */
async function cocokkanLead(
  spk: SpkFinal, env: { sph_management_db: D1Database },
): Promise<{ id: string; kode_lead: string | null; kota: string | null } | null> {
  const nama = rapikanNama(spk.customer);
  if (!nama) return null;

  // Normalkan di sisi SQL juga: buang titik & koma, ratakan spasi berlebih.
  // Spasi WAJIB diratakan di sini, bukan hanya di JS: "Budi  Santoso" (spasi
  // dobel) dan "Budi Santoso" adalah klien yang sama bagi mata manusia, dan
  // bila SQL tidak menyamakannya, barisnya tidak akan pernah ketemu — pesan
  // galatnya pun tidak muncul, daftar hanya tampak kosong.
  const kunci = (kolom: string) =>
    `replace(replace(replace(lower(trim(coalesce(${kolom},''))),'.',''),',',''),'  ',' ')`;
  const norm = (v: string) => v.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim();

  const kandidat = await env.sph_management_db.prepare(
    `SELECT id, kode_lead, kota, nama_prospek, id_proyek
     FROM crm_leads
     WHERE ${kunci('nama_prospek')} = ?
     ORDER BY (id_proyek IS NULL OR id_proyek='') ASC, datetime(waktu_masuk) DESC, id ASC
     LIMIT 10`,
  ).bind(norm(nama)).all<{ id: string; kode_lead: string | null; kota: string | null; nama_prospek: string; id_proyek: string | null }>();

  const baris = kandidat.results || [];
  if (!baris.length) return null;

  // Satu kandidat → langsung pakai. Lebih dari satu → dahulukan yang kotanya
  // sama dengan kota proyek di SPK; kalau tetap seri, ambil yang teratas
  // (sudah diurutkan: punya proyek lebih dulu, lalu yang terbaru).
  const kotaSpk = rapikanNama(spk.kota);
  if (baris.length > 1 && kotaSpk) {
    const sekota = baris.find(b => rapikanNama(b.kota) === kotaSpk);
    if (sekota) return { id: sekota.id, kode_lead: sekota.kode_lead, kota: sekota.kota };
  }
  return { id: baris[0].id, kode_lead: baris[0].kode_lead, kota: baris[0].kota };
}

/** Kode lead berikutnya: LEAD-0001, LEAD-0002, ... */
async function kodeLeadBaru(env: { sph_management_db: D1Database }): Promise<string> {
  const last = await env.sph_management_db
    .prepare("SELECT kode_lead FROM crm_leads WHERE kode_lead LIKE 'LEAD-%' ORDER BY kode_lead DESC LIMIT 1")
    .first<{ kode_lead: string }>();
  const next = last?.kode_lead ? Number(last.kode_lead.split('-')[1]) + 1 : 1;
  return `LEAD-${String(next).padStart(4, '0')}`;
}

/**
 * Lead baru dari data SPK. Statusnya 'SPK Disusun' — salah satu status yang
 * memang dikenal alur CRM (lihat STATUS_SPH_KEATAS). Final Survey yang
 * dijalankan dari sini memang terjadi SETELAH SPK terbit, jadi menandainya
 * 'Lead Baru' akan membuat papan Kanban berbohong; memakai status karangan
 * akan membuat lead nyasar tak dikenal.
 *
 * Penjagaan FK: kolom `sales` di crm_leads menunjuk ke crm_ref_sales. Bila
 * namanya tidak terdaftar di sana (mis. dokumen lama dengan nama berbeda),
 * kolom itu dikosongkan daripada membuat baris yang melanggar FK.
 */
async function buatLead(spk: SpkFinal, env: { sph_management_db: D1Database }): Promise<string> {
  const nama = rapikanNama(spk.customer);
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const kode = await kodeLeadBaru(env);

  let sales: string | null = rapikanNama(spk.sales) || null;
  if (sales) {
    const ref = await env.sph_management_db
      .prepare('SELECT nama FROM crm_ref_sales WHERE lower(trim(nama))=lower(trim(?)) LIMIT 1')
      .bind(sales).first<{ nama: string }>();
    if (!ref) sales = null;
  }

  await env.sph_management_db.prepare(
    `INSERT INTO crm_leads
       (id, kode_lead, waktu_masuk, nama_prospek, kota, sales, status_terakhir,
        kebutuhan, catatan, diubah_oleh, waktu_diubah, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).bind(
    id, kode, now, nama, rapikanNama(spk.kota) || null, sales, 'SPK Disusun',
    rapikanNama(spk.jenis_lift) || null,
    `Dibuat otomatis dari SPK ${spk.nomor_spk} saat memulai Final Survey.`,
    'Sistem', now, now, now,
  ).run();

  // Jejak perubahan status — lead yang lahir sudah berstatus "SPK Disusun"
  // tidak boleh muncul tanpa penjelasan di riwayatnya.
  await env.sph_management_db.prepare(
    `INSERT INTO crm_lead_riwayat (id, id_lead, dari_status, ke_status, oleh, catatan, waktu)
     VALUES (?,?,?,?,?,?,?)`,
  ).bind(
    crypto.randomUUID(), id, null, 'SPK Disusun', 'Sistem',
    `Lead dibuat otomatis dari SPK ${spk.nomor_spk}`, now,
  ).run().catch(() => { /* riwayat jangan menggagalkan penautan */ });

  return id;
}

/**
 * Pastikan sebuah SPK final punya lead. Urutannya:
 *   1. `sph.id_lead` (paling pasti — dokumen sudah pernah ditautkan)
 *   2. cocokkan nama customer dengan `crm_leads.nama_prospek`
 *   3. buat lead baru dari data SPK
 *
 * Hasilnya selalu ditulis balik ke `sph.id_lead` supaya pemanggilan
 * berikutnya langsung kena langkah 1.
 */
export async function tautkanSpkKeLead(
  spk: SpkFinal, env: { sph_management_db: D1Database },
): Promise<HasilTaut> {
  if (spk.id_lead) {
    const ada = await env.sph_management_db
      .prepare('SELECT id, kode_lead FROM crm_leads WHERE id=?')
      .bind(spk.id_lead).first<{ id: string; kode_lead: string | null }>();
    if (ada) return { id_lead: ada.id, kode_lead: ada.kode_lead, baru: false, cara: 'id_lead dokumen' };
    // id_lead menunjuk lead yang sudah tidak ada — jangan dipakai, cari ulang.
  }

  const kotaSpk = rapikanNama(spk.kota);
  const cocok = await cocokkanLead(spk, env);
  const idLead = cocok?.id ?? await buatLead(spk, env);
  const kodeLead = cocok?.kode_lead ?? null;

  const cara = !cocok
    ? 'dibuat baru'
    : (cocok.kota && kotaSpk && rapikanNama(cocok.kota) === kotaSpk ? 'nama+kota cocok' : 'nama cocok');

  // Tulis balik supaya dokumen dan lead tidak lagi terpisah.
  await env.sph_management_db
    .prepare('UPDATE sph SET id_lead=?, updated_at=? WHERE id=?')
    .bind(idLead, new Date().toISOString(), spk.id).run();

  const kode = kodeLead || (await env.sph_management_db
    .prepare('SELECT kode_lead FROM crm_leads WHERE id=?')
    .bind(idLead).first<{ kode_lead: string | null }>() as { kode_lead: string | null } | null)?.kode_lead || null;

  return { id_lead: idLead, kode_lead: kode, baru: !cocok, cara };
}

export { namaCustomerDokumen };
