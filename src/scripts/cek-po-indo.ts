// Cek sisa kata Indonesia di dokumen PO — dijalankan dengan:
//   npx tsx src/scripts/cek-po-indo.ts   (atau via vitest)
import { htmlPo, type BahanCetakPo } from '../lib/survey-cetak';
import type { PoRevisiRow } from '../lib/survey-types';

const po: BahanCetakPo = {
  no_po: 'PO-TEST-001', tgl_po: '2026-11-20', kode_proyek: 'KP-1',
  nama_prospek: 'Proyek Uji', pabrik: 'Sinar Cerah Sempurna', pic: 'Budi',
  catatan: 'Catatan uji', rev_terakhir: 2, status: 'diterbitkan', dibuat_oleh: 'Ops',
};
const revisi = [
  { rev: 2, tgl_revisi: '2026-11-20', oleh: 'Ops', alasan: 'Perubahan', jml_perubahan: 3,
    dt: {
      jenisLift: 'Passenger', model: 'BL-100', kapasitas: '400', penumpang: '6',
      kecepatan: '60', sfd: '4/4/4', tipeMesin: 'MRL', drive: 'Gearless',
      shaftSize: '1600x1500', pitDepth: '1400', overhead: '4200', travelling: '7000',
      totalHeight: '12600', lantai: [{ lantai: 'Lantai 1', tinggi: '3500', door: '900', finishing: 'Stainless' }],
      addon: [{ kode: 'A1', nama: 'ARD', on: true, ada: false, fotoLink: 'https://x/y.jpg' }],
      remarks: 'Uji remarks',
    } },
] as unknown as PoRevisiRow[];

const html = htmlPo(po, revisi);

// Kata Indonesia yang TIDAK boleh muncul lagi di dokumen PO.
const terlarang = [
  'Pesanan ke Pabrik', 'Data Pesanan', 'Data Teknis Acuan', 'Catatan Revisi',
  'Pengesahan', 'Tabel Lantai', 'Nomor PO', 'Tanggal PO', 'Kode Proyek',
  'Pabrik Tujuan', 'PIC Pabrik', 'Revisi Ke', 'Disetujui', 'Dibuat —',
  'Diperiksa', 'Bukaan Pintu', 'Sudah Ada', 'Dipesan', '>Ya<', '>Lantai<',
  'belum diterbitkan', 'salinan', 'terkunci', 'perubahan</td>',
];

let gagal = 0;
for (const k of terlarang) {
  if (html.includes(k)) { console.log('MASIH ADA:', k); gagal++; }
}
if (!html.includes('Purchase Order')) { console.log('GAGAL: header Purchase Order tidak ada'); gagal++; }
// Selektor CSS .subdocno selalu ada di <style>; yang diperiksa adalah elemennya.
if (/<div class="subdocno">/.test(html)) { console.log('GAGAL: subjudul masih tercetak'); gagal++; }

console.log(gagal === 0 ? 'LULUS: dokumen PO bersih dari teks Indonesia' : `GAGAL: ${gagal} temuan`);
process.exit(gagal === 0 ? 0 : 1);
