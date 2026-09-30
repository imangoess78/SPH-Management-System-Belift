// ============================================================
//  PENJAGA HAK AKSES — sisi server
//
//  Ini pengamanan yang sebenarnya. Menyembunyikan menu di tampilan hanya
//  kerapian; siapa pun yang mengetik URL API-nya langsung tetap harus
//  ditolak di sini.
//
//  Semua endpoint wajib memanggil `wajibAkses` / `wajibHalaman` sebelum
//  menyentuh database.
// ============================================================

import type { D1Database } from '@cloudflare/workers-types';
import {
  boleh, cakupanLihat, cakupanUbah, izinEfektif, normalisasiPeran,
  type KunciHalaman, type Peran,
} from '../../shared/akses';

export interface Env { sph_management_db: D1Database }

export interface Akses {
  userId: string;
  email: string;
  nama: string;
  role: Peran;
  izin: string[];
  /** Nama sales yang dipakai di kolom `sales` (crm_leads) dan `nama_sales` (sph). */
  namaSales: string;
  cakupanLihat: 'semua' | 'sendiri';
  cakupanUbah: 'semua' | 'sendiri' | 'tidak';
}

function idSesi(request: Request): string | null {
  return (request.headers.get('cookie') || '').match(/(?:^|; )sph_session=([^;]+)/)?.[1] || null;
}

export function json(data: unknown, status = 200) {
  return Response.json(data as object, {
    status,
    headers: { 'cache-control': 'no-store, no-cache, must-revalidate' },
  });
}

/**
 * Baca sesi + hak akses. Mengembalikan null bila belum masuk.
 *
 * Nama sales diselesaikan lewat email ke `crm_ref_sales` supaya kepemilikan
 * data (kolom `sales` pada leads) bisa dicocokkan. Bila email tidak ada di
 * sana, dipakai `full_name` sebagai cadangan.
 */
export async function bacaAkses(request: Request, env: Env): Promise<Akses | null> {
  const sid = idSesi(request);
  if (!sid) return null;

  const u = await env.sph_management_db
    .prepare(`SELECT u.id, u.email, u.full_name, u.role, u.permissions, u.status
              FROM app_sessions s JOIN app_users u ON u.id = s.user_id
              WHERE s.id=? AND s.expires_at>? AND u.status='approved'`)
    .bind(sid, new Date().toISOString())
    .first<{ id: string; email: string; full_name: string | null; role: string; permissions: string | null; status: string }>();
  if (!u) return null;

  const role = normalisasiPeran(u.role);
  const izin = izinEfektif(u.role, u.permissions);

  // Email → nama sales (dipakai kolom `sales` di crm_leads)
  const ref = await env.sph_management_db
    .prepare('SELECT nama FROM crm_ref_sales WHERE lower(email)=lower(?) LIMIT 1')
    .bind(u.email).first<{ nama: string }>();

  const namaSales = ref?.nama || u.full_name || u.email;

  return {
    userId: u.id,
    email: u.email,
    nama: u.full_name || u.email,
    role,
    izin,
    namaSales,
    cakupanLihat: cakupanLihat(izin),
    cakupanUbah: cakupanUbah(izin),
  };
}

/** Tolak bila belum masuk, atau bila tidak punya izin halaman. */
export async function wajibHalaman(
  request: Request, env: Env, halaman: KunciHalaman,
): Promise<{ akses: Akses } | { tolak: Response }> {
  const akses = await bacaAkses(request, env);
  if (!akses) return { tolak: json({ error: 'Unauthorized' }, 401) };
  if (!boleh(akses.izin, halaman)) {
    return {
      tolak: json({
        error: `Akses ditolak: peran ${akses.role} tidak berwenang membuka ${halaman}.`,
        kode: 'TIDAK_BERHAK',
      }, 403),
    };
  }
  return { akses };
}

/** Tolak bila tidak punya izin tertentu (bukan halaman). */
export async function wajibIzin(
  request: Request, env: Env, kunci: Parameters<typeof boleh>[1],
): Promise<{ akses: Akses } | { tolak: Response }> {
  const akses = await bacaAkses(request, env);
  if (!akses) return { tolak: json({ error: 'Unauthorized' }, 401) };
  if (!boleh(akses.izin, kunci)) {
    return {
      tolak: json({ error: `Akses ditolak: butuh wewenang "${kunci}".`, kode: 'TIDAK_BERHAK' }, 403),
    };
  }
  return { akses };
}

/**
 * Apakah pengguna boleh menyentuh baris milik `pemilik`.
 *
 * Aturannya: `semua` selalu boleh. `sendiri` hanya bila namanya cocok —
 * pencocokan tanpa membedakan huruf besar/kecil dan spasi berlebih, karena
 * nama sales ditulis manual di beberapa tempat.
 */
export function bolehSentuh(
  akses: Akses, pemilik: string | null | undefined, aksi: 'lihat' | 'ubah',
): boolean {
  const cakupan = aksi === 'lihat' ? akses.cakupanLihat : akses.cakupanUbah;
  if (cakupan === 'semua') return true;
  if (cakupan === 'tidak') return false;
  const a = normalkan(pemilik);
  const b = normalkan(akses.namaSales);
  const c = normalkan(akses.nama);
  return !!a && (a === b || a === c);
}

function normalkan(v?: string | null): string {
  return String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Potongan SQL untuk menyaring baris berdasarkan kepemilikan.
 * Mengembalikan klausa kosong bila pengguna berhak melihat semua.
 *
 * @param kolom nama kolom pemilik, mis. `sales` atau `nama_sales`
 */
export function saringPemilik(
  akses: Akses, kolom: string, aksi: 'lihat' | 'ubah' = 'lihat',
): { sql: string; params: unknown[] } {
  const cakupan = aksi === 'lihat' ? akses.cakupanLihat : akses.cakupanUbah;
  if (cakupan === 'semua') return { sql: '', params: [] };
  if (cakupan === 'tidak') return { sql: ' AND 1=0', params: [] };
  return {
    sql: ` AND (lower(trim(${kolom})) = lower(trim(?)) OR lower(trim(${kolom})) = lower(trim(?)))`,
    params: [akses.namaSales, akses.nama],
  };
}

/** Catat perubahan hak akses ke jejak audit. */
export async function catatRiwayatIzin(
  env: Env,
  data: {
    idUser: string; olehUserId: string; olehNama: string;
    roleLama?: string | null; roleBaru?: string | null;
    izinLama?: string | null; izinBaru?: string | null;
  },
) {
  await env.sph_management_db.prepare(
    `INSERT INTO app_users_izin_riwayat
     (id, id_user, oleh_user_id, oleh_nama, role_lama, role_baru, izin_lama, izin_baru, dibuat_pada)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).bind(
    crypto.randomUUID(), data.idUser, data.olehUserId, data.olehNama,
    data.roleLama ?? null, data.roleBaru ?? null,
    data.izinLama ?? null, data.izinBaru ?? null, new Date().toISOString(),
  ).run();
}
