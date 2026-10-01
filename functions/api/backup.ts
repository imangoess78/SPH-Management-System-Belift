// ============================================================
//  BACKUP DATABASE — sisi aplikasi
//
//  Hanya admin. Tiga hal yang bisa dilakukan:
//    GET  ?aksi=daftar   → backup apa saja yang tersimpan
//    GET  ?aksi=unduh    → ambil satu backup (untuk disimpan di luar Cloudflare)
//    POST                → jalankan backup sekarang
//
//  Backup otomatis harian dikerjakan worker terjadwal (workers/backup-cron),
//  bukan endpoint ini — endpoint ini untuk keperluan mendesak dan pengawasan.
// ============================================================
import type { PagesFunction } from '@cloudflare/workers-types';
import { bacaAkses, json, type Akses } from '../lib/akses';
import { daftarBackup, jalankanBackup } from '../../shared/backup';

interface Env {
  sph_management_db: D1Database;
  belift_media: R2Bucket;
}

/** Hanya peran dengan izin master (admin) yang boleh menyentuh backup. */
async function wajibAdmin(request: Request, env: Env): Promise<{ akses: Akses } | { tolak: Response }> {
  const akses = await bacaAkses(request, env);
  if (!akses) return { tolak: json({ error: 'Unauthorized' }, 401) };
  const izin = akses.izin as unknown as string[];
  if (!izin.includes('*') && !izin.includes('master')) {
    return { tolak: json({ error: 'Backup hanya untuk admin.' }, 403) };
  }
  return { akses };
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const gerbang = await wajibAdmin(request, env);
  if ('tolak' in gerbang) return gerbang.tolak;

  const url = new URL(request.url);

  if (request.method === 'GET') {
    const aksi = url.searchParams.get('aksi') || 'daftar';

    if (aksi === 'daftar') {
      const daftar = await daftarBackup(env.belift_media);
      return json({
        data: daftar,
        catatan: 'Backup memuat database saja. Berkas media (foto, tanda tangan, desain) tidak termasuk.',
      });
    }

    if (aksi === 'unduh') {
      const kunci = url.searchParams.get('kunci') || '';
      // Hanya boleh mengunduh dari dalam folder backup — cegah path menembus
      // ke berkas media biasa lewat parameter ini.
      if (!/^backups\/d1\/\d{4}-\d{2}-\d{2}\/[0-9TZ:.-]+\.json$/.test(kunci)) {
        return json({ error: 'Kunci backup tidak sah.' }, 400);
      }
      const objek = await env.belift_media.get(kunci);
      if (!objek) return json({ error: 'Backup tidak ditemukan.' }, 404);
      return new Response(objek.body, {
        headers: {
          'content-type': 'application/json;charset=utf-8',
          'content-disposition': `attachment; filename="${kunci.split('/').pop()}"`,
          'cache-control': 'private, no-store',
        },
      });
    }

    return json({ error: 'Aksi tidak dikenal.' }, 400);
  }

  if (request.method === 'POST') {
    try {
      const hasil = await jalankanBackup(env.sph_management_db, env.belift_media, {
        simpan: 30,
        pemicu: 'manual:' + (gerbang.akses.nama || gerbang.akses.role),
      });
      return json({ data: hasil, pesan: 'Backup selesai.' });
    } catch (e) {
      return json({ error: 'Backup gagal: ' + (e as Error).message }, 500);
    }
  }

  return json({ error: 'Metode tidak didukung.' }, 405);
};
