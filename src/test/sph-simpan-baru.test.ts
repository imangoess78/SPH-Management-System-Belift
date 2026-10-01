import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveDocument, updateDocumentStatus } from '@/lib/sph-utils';

/**
 * Regresi: SPH baru difinalisasi tapi tidak muncul di daftar.
 *
 * Penyebab yang pernah terjadi di produksi:
 *   saveDocument() selalu mencoba PUT dulu, lalu baru POST kalau balasannya 404.
 *   Di Cloudflare D1, `UPDATE ... WHERE id=?` yang tidak mengenai baris mana pun
 *   tetap dianggap sukses (`success: true`, `changes: 0`, tanpa error). Server
 *   membalas 200, sehingga cabang POST tidak pernah dijalankan dan dokumen baru
 *   HILANG tanpa pesan galat apa pun.
 *
 * Perbaikannya: server membalas 404 bila `changes` = 0. Test di bawah menjaga
 * agar klien tetap jatuh ke jalur POST pada 404 (dan pada penanda `TIDAK_ADA`
 * untuk server versi lama), serta TIDAK membuat dokumen baru saat gagal sungguhan.
 */

const doc = { id: 'doc-baru-1', mode: 'SPH', noUrut: '500', tanggal: '2026-10-01', status: 'final' };

function balas(status: number, body: unknown = { ok: true }) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  }));
}

describe('saveDocument — dokumen baru tidak boleh hilang diam-diam', () => {
  const calls: { url: string; method: string }[] = [];

  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method || 'GET' });
      if (init?.method === 'PUT') return balas(404, { error: 'Not found', kode: 'TIDAK_ADA' });
      if (init?.method === 'POST') return balas(200, { ok: true });
      return balas(200, { data: [] });
    }));
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('jatuh ke POST setelah PUT 404, lalu lapor berhasil', async () => {
    const ok = await saveDocument(doc, 'user-1');
    expect(ok).toBe(true);
    expect(calls.map(c => c.method)).toEqual(['PUT', 'POST']);
  });

  it('tetap jatuh ke POST bila server lama membalas 200 bertanda TIDAK_ADA', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method || 'GET' });
      if (init?.method === 'PUT') return balas(200, { error: 'Not found', kode: 'TIDAK_ADA' });
      if (init?.method === 'POST') return balas(200, { ok: true });
      return balas(200, { data: [] });
    }));
    const ok = await saveDocument(doc, 'user-1');
    expect(ok).toBe(true);
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(1);
  });

  it('TIDAK membuat dokumen baru saat gagal sungguhan (403)', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method || 'GET' });
      if (init?.method === 'PUT') return balas(403, { error: 'Tidak berwenang' });
      return balas(200, { ok: true });
    }));
    const ok = await saveDocument(doc, 'user-1');
    expect(ok).toBe(false);
    expect(calls.filter(c => c.method === 'POST')).toHaveLength(0);
  });

  it('lapor berhasil saat PUT memang mengubah dokumen yang sudah ada', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push({ url: String(url), method: init?.method || 'GET' });
      if (init?.method === 'PUT') return balas(200, { ok: true });
      return balas(200, { data: [] });
    }));
    const ok = await saveDocument(doc, 'user-1');
    expect(ok).toBe(true);
    expect(calls.map(c => c.method)).toEqual(['PUT']);
  });
});

describe('updateDocumentStatus — finalisasi tidak boleh lapor berhasil palsu', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('gagal bila server membalas 404 (baris tidak ada)', async () => {
    vi.stubGlobal('fetch', vi.fn(() => balas(404, { error: 'Not found' })));
    expect(await updateDocumentStatus('id-hilang', 'final')).toBe(false);
  });

  it('berhasil bila server membalas ok: true', async () => {
    vi.stubGlobal('fetch', vi.fn(() => balas(200, { ok: true })));
    expect(await updateDocumentStatus('id-ada', 'final')).toBe(true);
  });
});
