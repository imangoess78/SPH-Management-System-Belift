/* API Kalkulator Dinamis — Belift
 * ============================================================
 *   GET  /api/kalkulator          → konfigurasi harga yang berlaku
 *   PUT  /api/kalkulator          → simpan seluruh konfigurasi (khusus `master`)
 *   GET  /api/kalkulator?riwayat=1→ riwayat perubahan harga (khusus `master`)
 *
 * Kenapa konfigurasi disimpan sebagai satu dokumen JSON utuh, bukan endpoint
 * per-field: form admin menyunting semuanya sekaligus dan menekan "Simpan".
 * Mengirim 60 permintaan kecil akan membuat harga setengah tersimpan saat
 * jaringan putus — untuk data harga itu berbahaya.
 *
 * PENGAMANAN:
 *  - Membaca: butuh izin halaman `kalkulator`.
 *  - Menulis : butuh izin `master`. Diperiksa di server, bukan hanya dengan
 *              menyembunyikan tombol di layar.
 *  - Kunci optimistis (`versi`): dua admin yang menyimpan bersamaan tidak
 *    saling menimpa diam-diam; yang kedua ditolak dan diminta memuat ulang.
 */
import type { PagesFunction } from '@cloudflare/workers-types';
import { boleh } from '../../shared/akses';
import {
  KONFIG_BAWAAN, bedakan, gabungKonfig, type KonfigKalkulator,
} from '../../shared/kalkulator-konfigurasi';
import { json, wajibHalaman, type Akses } from '../lib/akses';

interface Env { sph_management_db: D1Database }

const ID = 'utama';

interface BarisKonfig {
  isi: string;
  versi: number;
  diperbarui_oleh: string | null;
  diperbarui_pada: string;
}

async function bacaBaris(env: Env): Promise<BarisKonfig | null> {
  return env.sph_management_db
    .prepare('SELECT isi, versi, diperbarui_oleh, diperbarui_pada FROM kalkulator_konfigurasi WHERE id=?')
    .bind(ID)
    .first<BarisKonfig>();
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  const menulis = request.method !== 'GET' && request.method !== 'HEAD';

  const cek = await wajibHalaman(request, env, menulis ? 'master' : 'kalkulator');
  if ('tolak' in cek) return cek.tolak;
  const akses: Akses = cek.akses;

  // ── Riwayat perubahan ──
  if (request.method === 'GET' && url.searchParams.get('riwayat')) {
    if (!boleh(akses.izin, 'master')) {
      return json({ error: 'Peran Anda tidak berwenang melihat riwayat harga.' }, 403);
    }
    const hasil = await env.sph_management_db
      .prepare('SELECT id, waktu, oleh, versi, ringkasan FROM kalkulator_riwayat ORDER BY waktu DESC LIMIT 60')
      .all();
    const data = (hasil.results || []).map((r: any) => ({
      ...r,
      ringkasan: (() => { try { return JSON.parse(r.ringkasan); } catch { return []; } })(),
    }));
    return json({ data });
  }

  // ── Baca konfigurasi ──
  if (request.method === 'GET') {
    const baris = await bacaBaris(env);
    if (!baris) {
      // Belum pernah disimpan: pakai angka bawaan. `versi` 0 menandakan
      // "belum ada dokumen", sehingga simpan pertama tidak dianggap bentrok.
      return json({
        konfigurasi: KONFIG_BAWAAN,
        versi: 0,
        diperbarui_pada: null,
        diperbarui_oleh: null,
        tersimpan: false,
      });
    }
    let isi: unknown = null;
    try { isi = JSON.parse(baris.isi); } catch { isi = null; }
    return json({
      konfigurasi: gabungKonfig(isi),
      versi: baris.versi,
      diperbarui_pada: baris.diperbarui_pada,
      diperbarui_oleh: baris.diperbarui_oleh,
      tersimpan: true,
    });
  }

  // ── Simpan konfigurasi ──
  if (request.method === 'PUT') {
    if (!boleh(akses.izin, 'master')) {
      return json({ error: 'Hanya admin yang boleh mengubah harga.' }, 403);
    }

    let body: { konfigurasi?: unknown; versi?: unknown };
    try { body = (await request.json()) as typeof body; } catch {
      return json({ error: 'Body bukan JSON yang sah.' }, 400);
    }
    if (!body.konfigurasi || typeof body.konfigurasi !== 'object') {
      return json({ error: 'konfigurasi wajib diisi.' }, 400);
    }

    // Dibersihkan lewat gabungKonfig: kunci yang tidak dikenal dibuang, kunci
    // yang hilang diambil dari bawaan, dan nilai non-angka pada kolom harga
    // tidak bisa menyelundup masuk ke database.
    const bersih: KonfigKalkulator = gabungKonfig(body.konfigurasi);

    const angka = Object.entries({
      'kurs.usd_idr': bersih.kurs.usd_idr,
      'kurs.faktor_biaya_masuk': bersih.kurs.faktor_biaya_masuk,
      ppn_persen: bersih.ppn_persen,
      biaya_tetap_idr: bersih.biaya_tetap_idr,
      'margin.pembagi_shaft_belift': bersih.margin.pembagi_shaft_belift,
      'margin.pembagi_shaft_pelanggan': bersih.margin.pembagi_shaft_pelanggan,
      usd_per_lantai_tambahan: bersih.usd_per_lantai_tambahan,
    });
    for (const [nama, nilai] of angka) {
      if (!Number.isFinite(Number(nilai))) {
        return json({ error: `Nilai ${nama} harus berupa angka.` }, 400);
      }
    }
    if (Number(bersih.kurs.usd_idr) <= 0) {
      return json({ error: 'Kurs USD/IDR harus lebih besar dari 0.' }, 400);
    }
    if (Number(bersih.ppn_persen) < 0 || Number(bersih.ppn_persen) > 100) {
      return json({ error: 'PPN harus di antara 0 dan 100 persen.' }, 400);
    }
    for (const [nama, nilai] of [
      ['margin.pembagi_shaft_belift', bersih.margin.pembagi_shaft_belift],
      ['margin.pembagi_shaft_pelanggan', bersih.margin.pembagi_shaft_pelanggan],
    ] as const) {
      if (Number(nilai) <= 0 || Number(nilai) > 1) {
        return json({ error: `${nama} harus di antara 0 dan 1 (0,8 = margin 20%).` }, 400);
      }
    }
    if (!bersih.kabin.length || !bersih.pintu.length || !bersih.lokasi.length || !bersih.unit_dasar.length) {
      return json({ error: 'Daftar kabin, pintu, lokasi, dan harga dasar tidak boleh kosong.' }, 400);
    }

    const lama = await bacaBaris(env);
    const versiLama = lama?.versi ?? 0;

    // Kunci optimistis. Klien yang tidak mengirim `versi` dianggap tidak
    // memakai pengaman ini (mis. skrip), jadi tidak dipaksa.
    if (body.versi !== undefined && Number(body.versi) !== versiLama) {
      return json({
        error: 'Harga sudah diubah orang lain sejak halaman ini dibuka. Muat ulang dulu, lalu ulangi perubahan Anda.',
        kode: 'VERSI_BENTROK',
        versi: versiLama,
      }, 409);
    }

    let isiLama: unknown = null;
    if (lama) { try { isiLama = JSON.parse(lama.isi); } catch { isiLama = null; } }
    const perubahan = bedakan(gabungKonfig(isiLama), bersih);

    const versiBaru = versiLama + 1;
    const sekarang = new Date().toISOString();

    await env.sph_management_db
      .prepare(`INSERT INTO kalkulator_konfigurasi (id, isi, versi, diperbarui_oleh, diperbarui_pada)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  isi=excluded.isi, versi=excluded.versi,
                  diperbarui_oleh=excluded.diperbarui_oleh, diperbarui_pada=excluded.diperbarui_pada`)
      .bind(ID, JSON.stringify(bersih), versiBaru, akses.email || akses.nama, sekarang)
      .run();

    // Riwayat hanya ditulis bila ada yang benar-benar berubah. Menyimpan
    // ulang tanpa perubahan tidak boleh menambah baris riwayat — riwayat yang
    // penuh baris kosong membuat perubahan sungguhan tidak terlihat.
    if (perubahan.length) {
      await env.sph_management_db
        .prepare('INSERT INTO kalkulator_riwayat (id, waktu, oleh, versi, ringkasan) VALUES (?, ?, ?, ?, ?)')
        .bind(crypto.randomUUID(), sekarang, akses.email || akses.nama, versiBaru, JSON.stringify(perubahan))
        .run();
    }

    return json({ ok: true, versi: versiBaru, perubahan: perubahan.length });
  }

  return new Response('Method Not Allowed', { status: 405 });
};
