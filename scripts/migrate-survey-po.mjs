#!/usr/bin/env node
/**
 * PRD — Survey Sales, Final Survey & PO Pabrik
 * Langkah 2: tambahkan kolom nullable pada tabel LAMA.
 *
 * D1/SQLite tidak punya "ADD COLUMN IF NOT EXISTS", jadi dicek dulu lewat
 * PRAGMA table_info. Aman dijalankan berulang; kolom & data lama tidak disentuh.
 *
 * Pakai:
 *   node scripts/migrate-survey-po.mjs           → remote (produksi)
 *   node scripts/migrate-survey-po.mjs --local   → D1 lokal
 */
import { execFileSync } from 'node:child_process';

const LOCAL = process.argv.includes('--local');
const DB = 'sph-management-db';
const SCOPE = LOCAL ? '--local' : '--remote';

/** Kolom baru: tabel → [[nama, tipe], …]. Semua NULLABLE. */
const KOLOM_BARU = {
  crm_leads: [
    ['id_proyek', 'TEXT'],
    ['kode_proyek', 'TEXT'],
    ['status_po', 'TEXT'],
  ],
  sph: [
    ['id_lead', 'TEXT'],
    ['kode_proyek', 'TEXT'],
  ],
};

function d1(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB, SCOPE, '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  return JSON.parse(out)[0]?.results ?? [];
}

function kolomAda(tabel) {
  return new Set(d1(`PRAGMA table_info(${tabel})`).map(r => r.name));
}

let ditambah = 0, dilewati = 0;

for (const [tabel, kolom] of Object.entries(KOLOM_BARU)) {
  const ada = kolomAda(tabel);
  for (const [nama, tipe] of kolom) {
    if (ada.has(nama)) {
      console.log(`  = ${tabel}.${nama} sudah ada — dilewati`);
      dilewati++;
      continue;
    }
    d1(`ALTER TABLE ${tabel} ADD COLUMN ${nama} ${tipe}`);
    console.log(`  + ${tabel}.${nama} ${tipe} ditambahkan`);
    ditambah++;
  }
}

console.log(`\nSelesai (${SCOPE}): ${ditambah} ditambahkan, ${dilewati} dilewati.`);
