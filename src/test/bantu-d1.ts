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
    run: async () => sqlite.prepare(sql).run(...(args as never[])),
  });
  return { prepare: (sql: string) => buat(sql) } as unknown as D1Database;
}
