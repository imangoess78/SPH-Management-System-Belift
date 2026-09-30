// Uji susunBahan dengan data contoh — memastikan funnel & tahap benar
// sebelum diuji di layar.
import { susunBahan } from '../src/lib/alur.ts';

const m = {
  // 3 lead
  lead: [
    { id: 'L1', kode_lead: 'LD-001', kode_proyek: 'BLF-001', nama_prospek: 'Hotel A', kota: 'Balikpapan', sales: 'Firman', kualifikasi: 'HOT',  status_terakhir: 'PO Terbit', waktu_masuk: '2026-08-01 09:00:00' },
    { id: 'L2', kode_lead: 'LD-002', kode_proyek: 'BLF-002', nama_prospek: 'RS B',     kota: 'Samarinda', sales: 'Rohim',  kualifikasi: 'WARM', status_terakhir: 'Final Survey', waktu_masuk: '2026-08-05 09:00:00' },
    { id: 'L3', kode_lead: 'LD-003', kode_proyek: null,      nama_prospek: 'Mall C',   kota: 'Banjarmasin', sales: 'Firman', kualifikasi: 'COLD', status_terakhir: 'Gugur', waktu_masuk: '2026-07-20 09:00:00' },
  ],
  proyek: [
    { id: 'P1', kode_proyek: 'BLF-001', id_lead: 'L1', nama_proyek: 'Hotel A', customer: 'PT A', kota: 'Balikpapan', status_terakhir: 'PO Terbit', tahap_sekarang: 'PO', created_at: '2026-08-01', updated_at: '2026-08-10' },
    { id: 'P2', kode_proyek: 'BLF-002', id_lead: 'L2', nama_proyek: 'RS B', customer: 'PT B', kota: 'Samarinda', status_terakhir: 'Final Survey', tahap_sekarang: 'Final', created_at: '2026-08-05', updated_at: '2026-08-12' },
  ],
  survey: [
    { id: 'S1', id_lead: 'L1', jenis: 'sales', status: 'final', terkunci: false, surveyor: 'Rohim', updated_at: '2026-08-02' },
    { id: 'S2', id_lead: 'L1', jenis: 'final', status: 'final', terkunci: true,  surveyor: 'Rohim', dikunci_pada: '2026-08-06', updated_at: '2026-08-06' },
    { id: 'S3', id_lead: 'L2', jenis: 'sales', status: 'draft', terkunci: false, surveyor: 'Rohim', updated_at: '2026-08-06' },
    { id: 'S4', id_lead: 'L2', jenis: 'final', status: 'draft', terkunci: false, surveyor: 'Rohim', updated_at: '2026-08-07' },
  ],
  po: [
    // PO L1 diubah SETELAH final survey dikunci (2026-08-06) → perlu ditinjau
    { id: 'PO1', id_lead: 'L1', kode_proyek: 'BLF-001', no_po: 'PO-001', status: 'Terbit', rev_terakhir: 2, jml_revisi: 2, created_at: '2026-08-07', updated_at: '2026-08-09' },
  ],
  dokumen: [
    // SPH milik L1 (final), SPK milik L1 (draft), SPH milik L2 (final)
    { id: 'D1', id_lead: 'L1', nomor_sph: '001/SPH/BLF/VIII/2026', status: 'final' },
    { id: 'D2', id_lead: 'L1', nomor_sph: '001/SPK/BLF/VIII/2026', status: 'draft' },
    { id: 'D3', id_lead: 'L2', nomor_sph: '002/SPH/BLF/VIII/2026', status: 'final' },
  ],
} as any;

const { angka, baris } = susunBahan(m);

console.log('=== ANGKA ===');
console.log(`lead=${angka.leadTotal} (HOT ${angka.leadHot} / WARM ${angka.leadWarm} / COLD ${angka.leadCold}, gugur ${angka.leadGugur})`);
console.log(`surveySales=${angka.surveySales} (selesai ${angka.surveySalesSelesai})`);
console.log(`SPH=${angka.sph} (final ${angka.sphFinal}, draft ${angka.sphDraft}) | SPK=${angka.spk} (final ${angka.spkFinal})`);
console.log(`finalSurvey=${angka.finalSurvey} (terkunci ${angka.finalTerkunci}, draft ${angka.finalDraft})`);
console.log(`PO=${angka.poTotal} (terbit ${angka.poTerbit}, revisi ${angka.jmlRevisi}) | proyek=${angka.proyek}`);
console.log(`perluTinjau=${angka.poPerluTinjau}`);

console.log('\n=== TAHAP PER LEAD ===');
for (const b of baris) {
  const tanda = [b.surveySales, b.sph || b.spk, b.finalSurvey, b.po].map(v => (v ? '✓' : '—')).join(' ');
  console.log(`${b.kode_lead} ${b.kode_proyek.padEnd(9)} ${b.nama_prospek.padEnd(10)} [${tanda}] ${b.tahap + 1}/5 ${b.tahapNama}${b.revisiSetelahFinal ? '  ⚠ perlu ditinjau' : ''}`);
}

console.log('\n=== PEMERIKSAAN ===');
const cek = (nama: string, dapat: unknown, harap: unknown) => {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  console.log(`${ok ? 'LULUS' : 'GAGAL'}  ${nama}: dapat ${JSON.stringify(dapat)}, harap ${JSON.stringify(harap)}`);
  return ok;
};
let semua = true;
semua = cek('leadTotal', angka.leadTotal, 3) && semua;
semua = cek('kualifikasi HOT', angka.leadHot, 1) && semua;
semua = cek('lead gugur', angka.leadGugur, 1) && semua;
semua = cek('survey sales', angka.surveySales, 2) && semua;
semua = cek('survey sales selesai', angka.surveySalesSelesai, 1) && semua;
semua = cek('SPH terpisah dari SPK', [angka.sph, angka.spk], [2, 1]) && semua;
semua = cek('SPH final', angka.sphFinal, 2) && semua;
semua = cek('final survey', angka.finalSurvey, 2) && semua;
semua = cek('final terkunci', angka.finalTerkunci, 1) && semua;
semua = cek('PO terbit', angka.poTerbit, 1) && semua;
semua = cek('tahap L1 = 5/5', baris.find(b => b.kode_lead === 'LD-001')?.tahapNama, 'PO Pabrik') && semua;
semua = cek('tahap L2 = 4/5', baris.find(b => b.kode_lead === 'LD-002')?.tahapNama, 'Final Survey') && semua;
semua = cek('tahap L3 = 1/5 (lead saja)', baris.find(b => b.kode_lead === 'LD-003')?.tahapNama, 'Lead Baru') && semua;
semua = cek('L3 tidak dianggap punya SPH', baris.find(b => b.kode_lead === 'LD-003')?.sph, false) && semua;
semua = cek('L1 ditandai perlu ditinjau', baris.find(b => b.kode_lead === 'LD-001')?.revisiSetelahFinal, true) && semua;
semua = cek('L2 tidak perlu ditinjau', baris.find(b => b.kode_lead === 'LD-002')?.revisiSetelahFinal, false) && semua;

console.log(semua ? '\nSEMUA LULUS' : '\nADA YANG GAGAL');
process.exit(semua ? 0 : 1);
