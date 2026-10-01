// ============================================================
//  WORKER BACKUP TERJADWAL — backup database otomatis tiap hari
//
//  KENAPA WORKER TERPISAH, bukan cron di aplikasi: Cloudflare Pages tidak
//  punya cron trigger. Worker ini yang memanggilnya, lalu menyimpan hasilnya
//  ke bucket R2 yang sama dengan aplikasi.
//
//  Dua pemicu:
//    - terjadwal (cron)  : backup harian otomatis
//    - manual (fetch)    : untuk menguji tanpa menunggu jadwal,
//                          wajib menyertakan header x-uji-token
//
//  Deploy: lihat workers/backup-cron/README.md
// ============================================================
import { jalankanBackup, daftarBackup } from '../../shared/backup';

interface Env {
  sph_management_db: D1Database;
  belift_media: R2Bucket;
  /** Token rahasia untuk memicu manual. Set lewat `wrangler secret put`. */
  UJI_TOKEN?: string;
}

/** Jumlah hari backup disimpan sebelum yang tertua dibuang. */
const SIMPAN_HARI = 30;

/** Susun laporan ringkas untuk dibaca di log Cloudflare. */
function ringkas(hasil: Awaited<ReturnType<typeof jalankanBackup>>) {
  const baris: string[] = [];
  baris.push(`Backup selesai: ${hasil.jumlah_tabel} tabel, ${hasil.jumlah_baris} baris, ${hasil.ukuran_byte} byte`);
  baris.push(`Tersimpan di: ${hasil.kunci}`);
  if (hasil.dibuang.length) baris.push(`Dibuang (lebih dari ${SIMPAN_HARI} hari): ${hasil.dibuang.length} berkas`);
  return baris.join('\n');
}

export default {
  /** Dipanggil otomatis oleh Cloudflare sesuai jadwal di wrangler.toml. */
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil((async () => {
      try {
        const hasil = await jalankanBackup(env.sph_management_db, env.belift_media, {
          simpan: SIMPAN_HARI,
          pemicu: 'terjadwal',
        });
        console.log(ringkas(hasil));
      } catch (e) {
        // Jangan diam: backup yang gagal tanpa kabar lebih berbahaya daripada
        // tidak punya backup sama sekali, karena orang mengira dirinya aman.
        console.error('BACKUP GAGAL: ' + (e as Error).message);
        throw e;
      }
    })());
  },

  /** Pemicu manual untuk pengujian. Token wajib, kalau tidak siapa pun bisa memanggil. */
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);

    if (url.pathname === '/sehat') {
      return Response.json({ ok: true, pesan: 'worker backup hidup' });
    }

    if (!env.UJI_TOKEN) {
      return Response.json({ error: 'UJI_TOKEN belum dipasang di worker ini.' }, { status: 503 });
    }
    if (request.headers.get('x-uji-token') !== env.UJI_TOKEN) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (url.pathname === '/daftar') {
      const daftar = await daftarBackup(env.belift_media);
      return Response.json({ jumlah: daftar.length, data: daftar.slice(0, 20) });
    }

    if (url.pathname === '/jalankan') {
      const hasil = await jalankanBackup(env.sph_management_db, env.belift_media, {
        simpan: SIMPAN_HARI,
        pemicu: 'manual-uji',
      });
      return Response.json({ data: hasil });
    }

    return Response.json(
      { error: 'Jalur tidak dikenal. Coba /sehat, /daftar, /jalankan.' }, { status: 404 });
  },
};
