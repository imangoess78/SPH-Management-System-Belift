// ============================================================
//  RIWAYAT STATUS LEAD — sisi server
//
//  Setiap kali `status_terakhir` sebuah lead berpindah, pindahnya itu
//  harus meninggalkan jejak di `crm_lead_riwayat` — termasuk kalau
//  perpindahannya terjadi OTOMATIS sebagai efek samping aksi lain
//  (Survey Sales dibuat, Final Survey dikunci, PO terbit).
//
//  Dulu hanya perpindahan lewat form CRM yang tercatat. Akibatnya
//  perpindahan otomatis tidak muncul di linimasa riwayat: lead
//  berpindah kolom di Kanban, tapi tidak ada catatan siapa yang
//  menyebabkan dan kenapa. Jejak auditnya berlubang.
//
//  Aturan pakai:
//   - `oleh` = orang yang memicu, bukan "Sistem". Nama aksi diisi ke
//     `catatan` supaya jelas ini akibat aksi apa.
//   - Panggil HANYA kalau statusnya benar-benar berubah, dan panggil
//     setelah UPDATE berhasil — di luar transaksi, urutannya penting.
//   - Pindahnya ke status yang sama tidak dicatat (bukan perpindahan).
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';

/** Sengaja TIDAK diekspor: tiap modul API punya `interface Env` sendiri,
 *  dan kecocokan tipenya sudah terjaga secara struktural. */
interface Env { sph_management_db: D1Database }

/**
 * Catat perpindahan status lead ke riwayat.
 *
 * @param dari Status sebelum perpindahan. `null` untuk baris baru.
 * @param ke   Status sesudah perpindahan.
 */
export async function catatPerpindahanStatus(
  env: Env,
  idLead: string,
  dari: string | null,
  ke: string,
  oleh: string,
  catatan: string,
  waktu?: string,
): Promise<void> {
  if (dari === ke) return;
  await env.sph_management_db.prepare(
    'INSERT INTO crm_lead_riwayat (id,id_lead,waktu,dari_status,ke_status,oleh,catatan) VALUES (?,?,?,?,?,?,?)'
  ).bind(crypto.randomUUID(), idLead, waktu || new Date().toISOString(), dari, ke, oleh, catatan || null).run();
}

/**
 * Pindahkan status lead (+ catat ke riwayat kalau memang berpindah).
 *
 * `syarat` dipertahankan supaya perpindahan tetap bisa dibatasi status
 * awal tertentu; perpindahan dilewati (tanpa catatan) kalau syarat tidak
 * terpenuhi. Dipakai agar status lead yang sudah lebih maju tidak
 * ditarik mundur oleh aksi yang datang belakangan.
 */
export async function pindahkanStatus(
  env: Env,
  idLead: string,
  ke: string,
  oleh: string,
  catatan: string,
  syarat?: { statusAwal?: string[]; waktu?: string },
): Promise<'berpindah' | 'tetap' | 'tidak-cocok'> {
  const baris = await env.sph_management_db
    .prepare('SELECT status_terakhir FROM crm_leads WHERE id=?')
    .bind(idLead).first<{ status_terakhir: string | null }>();
  if (!baris) return 'tidak-cocok';

  const dari = baris.status_terakhir ?? null;
  if (dari === ke) return 'tetap';
  if (syarat?.statusAwal && !syarat.statusAwal.includes(dari ?? '')) return 'tidak-cocok';

  // Satu cap waktu untuk seluruh permintaan — jangan biarkan kolom yang
  // diubah dalam aksi yang sama punya jam berbeda.
  const waktu = syarat?.waktu || new Date().toISOString();
  await env.sph_management_db
    .prepare('UPDATE crm_leads SET status_terakhir=?, updated_at=? WHERE id=?')
    .bind(ke, waktu, idLead).run();
  await catatPerpindahanStatus(env, idLead, dari, ke, oleh, catatan, waktu);
  return 'berpindah';
}
