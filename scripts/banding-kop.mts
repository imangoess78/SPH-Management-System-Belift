/**
 * Bandingkan kop kiri atas: CSS CETAK (printDocument SPHForm) vs CSS PRATINJAU
 * (GEN_CSS SPHPreview, yaitu yang dipakai halaman /preview).
 *
 * Keluaran: /tmp/kop/print.html dan /tmp/kop/preview.html — dua dokumen statis
 * yang siap dipotret chromium headless, lalu crop sudut kiri atasnya dibandingkan.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pageSPK } from '../src/lib/sph-generator';

const akar = process.cwd();

/** Ambil isi <style> pertama dari sebuah berkas .tsx. */
function cssDari(berkas: string, mulaiPenanda: string, akhirPenanda = '</style>'): string {
  const src = readFileSync(`${akar}/${berkas}`, 'utf8');
  const i = src.indexOf(mulaiPenanda);
  if (i < 0) throw new Error('penanda tidak ketemu di ' + berkas + ': ' + mulaiPenanda);
  const j = src.indexOf(akhirPenanda, i);
  if (j < 0) throw new Error(akhirPenanda + ' tidak ketemu di ' + berkas);
  let css = src.slice(i + mulaiPenanda.length, j);
  // Buang interpolasi ${...} — untuk perbandingan kop tidak relevan.
  css = css.replace(/\$\{[^}]*\}/g, '');
  return css;
}

const cssCetak = cssDari('src/pages/SPHForm.tsx', '<style>\n:root{--orange');
const cssPratinjau = cssDari('src/pages/SPHPreview.tsx', 'const GEN_CSS = `', '\n`;');

const s: any = {
  noUrut: '007', tanggal: '2026-11-20', kota: 'Jakarta', sapaan: 'Bapak',
  namaCustomer: 'Andi Wijaya', namaPerusahaan: 'PT Sumber Jaya',
  jenisLift: 'Passenger Lift', tampilTtd: false, tampilDesain: false,
  sales: 'Rudi', direktur: 'Budi',
};
const items: any[] = [{
  id: 'P1a', kel: 'PENGADAAN', nama: 'Unit Lift', sat: 'Unit',
  on: true, inc: false, hp: 1e8, hi: 0, qty: 1,
}];

const isi = pageSPK(s, items, {}, 'satuan', {} as any);

mkdirSync('/tmp/kop', { recursive: true });

for (const [nama, css] of [['print', cssCetak], ['preview', cssPratinjau]] as const) {
  const dok = `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<style>${css}</style></head><body>${isi}</body></html>`;
  writeFileSync(`/tmp/kop/${nama}.html`, dok);
}

console.log('css cetak punya .page::before :', cssCetak.includes('.page::before'));
console.log('css cetak punya .page::after  :', cssCetak.includes('.page::after'));
console.log('css pratinjau ::before        :', cssPratinjau.includes('.page::before'));
const ukuran = (css: string) => (css.match(/\.page\{[\s\S]*?background-size:([\d.]+mm)/) || [])[1];
console.log('background-size cetak         :', ukuran(cssCetak));
console.log('background-size pratinjau     :', ukuran(cssPratinjau));
