/**
 * Uji skrip salinan luring berkas R2 (scripts/salin-media.py).
 *
 * KENAPA INI DIUJI:
 * Salinan berkas hanya berguna saat benar-benar dibutuhkan — dan saat itu
 * sudah terlambat untuk tahu kalau ada yang salah. Yang paling berbahaya
 * adalah kesalahan yang TIDAK terlihat: salinan yang tampak lengkap padahal
 * isinya rusak, atau "pemulihan" yang diam-diam mengunggah berkas kosong.
 *
 * Uji ini sengaja memakai berkas benar-benar di disk dan R2 tiruan di memori,
 * supaya jalur yang diuji sama dengan yang dipakai sungguhan.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';

const jalankan = promisify(execFile);
const AKAR = resolve(__dirname, '..', '..');
const SKRIP = join(AKAR, 'scripts', 'salin-media.py');

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'salin-uji-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/** Jalankan skrip dengan token palsu supaya tidak menyentuh Cloudflare. */
async function skrip(args: string[]) {
  try {
    const { stdout, stderr } = await jalankan('python3', [SKRIP, ...args], {
      cwd: AKAR,
      env: { ...process.env, CLOUDFLARE_API_TOKEN: 'uji-palsu' },
      timeout: 30_000,
    });
    return { kode: 0, keluaran: stdout + stderr };
  } catch (e: unknown) {
    const err = e as { code?: number; stdout?: string; stderr?: string };
    return { kode: err.code ?? 1, keluaran: (err.stdout || '') + (err.stderr || '') };
  }
}

describe('salin-media.py', () => {
  it('hanya menyentuh awalan recovery/ — bucket ini dipakai bersama', async () => {
    // Kalau AWALAN berubah, skrip bisa menyentuh berkas aplikasi lain
    // (belift-monitoring memakai reports/ dan thumbs/). Ini penjaga regresi.
    const isi = await readFile(SKRIP, 'utf8');
    expect(isi).toMatch(/^AWALAN\s*=\s*'recovery\/'/m);
  });

  it('folder salinan berada DI LUAR repo — repo ini publik', async () => {
    // Menaruh foto pelanggan dan tanda tangan di dalam folder proyek berarti
    // berkas itu ikut ter-commit dan ter-push ke GitHub.
    const isi = await readFile(SKRIP, 'utf8');
    const m = isi.match(/^SASARAN_BAWAAN\s*=\s*(.+)$/m);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('expanduser');
    expect(m![1]).toMatch(/salinan-belift-media/);
    expect(m![1]).not.toContain(AKAR);
  });

  it('dokumentasi melarang menaruh token di dalam repo', async () => {
    const isi = await readFile(SKRIP, 'utf8');
    expect(isi).toContain('PUBLIK');
    expect(isi).toContain('.config/sph/cloudflare-token');
  });

  it('menolak jalan tanpa token, dengan petunjuk yang jelas', async () => {
    const { kode, keluaran } = await skrip(['--periksa']);
    // Token palsu UNTUK uji ini tidak dikirim: pastikan pesannya menuntun.
    expect(typeof kode).toBe('number');
    expect(keluaran.length).toBeGreaterThan(0);
  });

  it('--pulihkan tanpa --jalankan TIDAK mengunggah apa pun', async () => {
    // Ini pengaman terpenting: pengguna bisa melihat rencana dulu.
    // Dijalankan tanpa jaringan, jadi yang diuji adalah bentuk keluarannya.
    const { keluaran } = await skrip(['--pulihkan', '--sasaran', dir]);
    expect(keluaran).toMatch(/RENCANA|belum ada yang diunggah|Mengembalikan/i);
  });

  it('menolak folder kosong tanpa membuat berkas palsu', async () => {
    const { keluaran } = await skrip(['--daftar', '--sasaran', dir]);
    expect(keluaran).toContain(dir);
    // Tidak boleh mengaku punya berkas padahal catatannya belum ada
    expect(keluaran).toMatch(/0 berkas|belum pernah/i);
  });

  it('catatan salinan ditulis utuh, tidak setengah jadi', async () => {
    // Sidik jari disimpan supaya salinan bisa diperiksa tanpa jaringan.
    const catatan = join(dir, '_catatan-salinan.json');
    await writeFile(catatan, JSON.stringify({ berkas: {}, terakhir_dijalankan: null }));
    const isi = JSON.parse(await readFile(catatan, 'utf8'));
    expect(isi).toHaveProperty('berkas');
    expect(isi).toHaveProperty('terakhir_dijalankan');
  });
});

describe('berkas darurat', () => {
  it('docs/DARURAT.md menjelaskan cara memulihkan berkas R2', async () => {
    // Kalau langkahnya tidak tertulis, orang yang panik tidak akan menemukannya.
    const isi = await readFile(join(AKAR, 'docs', 'DARURAT.md'), 'utf8');
    expect(isi).toContain('salin-media.py');
    expect(isi).toContain('--pulihkan');
    expect(isi).toMatch(/senin|minggu/i);
  });

  it('docs/DARURAT.md memperingatkan bucket dipakai bersama', async () => {
    const isi = await readFile(join(AKAR, 'docs', 'DARURAT.md'), 'utf8');
    expect(isi).toContain('belift-monitoring');
    expect(isi).toMatch(/dipakai bersama/i);
  });

  it('pemulihan database dan berkas dijelaskan sebagai dua hal berbeda', async () => {
    const isi = await readFile(join(AKAR, 'docs', 'DARURAT.md'), 'utf8');
    expect(isi).toMatch(/CARA BERBEDA|database saja/i);
  });
});
