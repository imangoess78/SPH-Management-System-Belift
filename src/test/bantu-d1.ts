/**
 * Jembatan tipis: `node:sqlite` DatabaseSync tampil seperti D1
 * (prepare/bind/first/run) supaya fungsi produksi bisa diuji apa adanya.
 *
 * Dipakai tes yang ingin membuktikan PERILAKU terhadap SQLite sungguhan,
 * bukan sekadar membaca teks kode sumber.
 */
import type { DatabaseSync } from 'node:sqlite';
import type { D1Database } from '@cloudflare/workers-types';

export function keD1(sqlite: DatabaseSync): D1Database {
  const buat = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => buat(sql, a),
    all: async () => ({ results: sqlite.prepare(sql).all(...(args as never[])) as never[] }),
    first: async () => (sqlite.prepare(sql).get(...(args as never[])) ?? null) as never,
    // `meta.changes` WAJIB diteruskan. Kode produksi memakainya untuk tahu
    // berapa baris yang benar-benar tertulis — mis. `kirim()` di
    // functions/lib/notifikasi.ts memakai `changes` untuk membedakan
    // "tercatat" dari "sudah pernah dicatat". Kalau jembatan ini tidak
    // mengembalikannya, uji anti-kembar akan lulus/ gagal tanpa alasan
    // yang benar-benar berhubungan dengan perilaku SQL-nya.
    run: async () => {
      const r = sqlite.prepare(sql).run(...(args as never[]));
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } as never;
    },
  });
  return { prepare: (sql: string) => buat(sql) } as unknown as D1Database;
}
