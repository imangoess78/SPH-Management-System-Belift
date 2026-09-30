// Uji logika hak akses — memastikan batasan data benar SEBELUM menyentuh produksi.
import { izinEfektif, boleh, cakupanLihat, cakupanUbah, labelPeran, normalisasiPeran } from '../shared/akses';
import { bolehSentuh, saringPemilik } from '../functions/lib/akses';

let lulus = 0, gagal = 0;
function cek(nama: string, dapat: unknown, harap: unknown) {
  const ok = JSON.stringify(dapat) === JSON.stringify(harap);
  if (ok) { lulus++; console.log(`  ✓ ${nama}`); }
  else { gagal++; console.log(`  ✗ ${nama}\n      dapat: ${JSON.stringify(dapat)}\n      harap: ${JSON.stringify(harap)}`); }
}

const akun = (role: string, permissions: string[] | null = null) => {
  const izin = izinEfektif(role, permissions);
  return {
    userId: 'u1', email: 'x@y.z', nama: 'Budi', role: normalisasiPeran(role),
    izin, namaSales: 'Budi',
    cakupanLihat: cakupanLihat(izin), cakupanUbah: cakupanUbah(izin),
  } as any;
};

console.log('\n── Izin bawaan per peran ──');
cek('admin boleh Manajemen Akun', boleh(izinEfektif('admin'), 'akun'), true);
cek('admin boleh semua (termasuk izin baru)', boleh(izinEfektif('admin'), 'backup'), true);
cek('sales TIDAK boleh Laporan', boleh(izinEfektif('sales'), 'laporan'), false);
cek('sales TIDAK boleh Manajemen Akun', boleh(izinEfektif('sales'), 'akun'), false);
cek('sales TIDAK boleh Final Survey', boleh(izinEfektif('sales'), 'survey_final'), false);
cek('sales TIDAK boleh kunci Final Survey', boleh(izinEfektif('sales'), 'kunci_final'), false);
cek('sales boleh SPH', boleh(izinEfektif('sales'), 'sph'), true);
cek('manager boleh Laporan', boleh(izinEfektif('manager'), 'laporan'), true);
cek('manager TIDAK boleh Manajemen Akun', boleh(izinEfektif('manager'), 'akun'), false);
cek('manager boleh ubah data semua sales', cakupanUbah(izinEfektif('manager')), 'semua');
cek('direktur boleh Laporan', boleh(izinEfektif('direktur'), 'laporan'), true);
cek('direktur TIDAK boleh ubah data', cakupanUbah(izinEfektif('direktur')), 'sendiri');
cek('staff boleh Final Survey', boleh(izinEfektif('staff'), 'survey_final'), true);
cek('peran tak dikenal -> staff', labelPeran('kepala-suku'), 'Staff');

console.log('\n── Cakupan data (inti permintaan) ──');
cek('sales: hanya lihat sendiri', cakupanLihat(izinEfektif('sales')), 'sendiri');
cek('sales: hanya ubah sendiri', cakupanUbah(izinEfektif('sales')), 'sendiri');
cek('admin: lihat semua', cakupanLihat(izinEfektif('admin')), 'semua');
cek('admin: ubah semua', cakupanUbah(izinEfektif('admin')), 'semua');

const sales = akun('sales');
const admin = akun('admin');

cek('sales boleh sentuh lead sendiri', bolehSentuh(sales, 'Budi', 'lihat'), true);
cek('sales TIDAK boleh lihat lead sales lain', bolehSentuh(sales, 'Siti', 'lihat'), false);
cek('sales TIDAK boleh ubah lead sales lain', bolehSentuh(sales, 'Siti', 'ubah'), false);
cek('admin boleh sentuh lead siapa pun', bolehSentuh(admin, 'Siti', 'ubah'), true);
cek('cocok walau beda huruf besar', bolehSentuh(sales, '  BUDI ', 'lihat'), true);
cek('nama kosong -> ditolak', bolehSentuh(sales, '', 'lihat'), false);
cek('nama null -> ditolak', bolehSentuh(sales, null, 'lihat'), false);

console.log('\n── Izin khusus per akun ──');
cek('izin khusus: sales diberi Laporan', boleh(izinEfektif('sales', ['laporan']), 'laporan'), true);
cek('izin khusus: sales DICABUT SPH-nya', boleh(izinEfektif('sales', ['laporan']), 'sph'), false);
cek('checklist kosong = tanpa izin (bukan bawaan)', izinEfektif('sales', []), []);
cek('izin tersimpan sebagai teks JSON', boleh(izinEfektif('sales', '["laporan"]' as any), 'laporan'), true);
cek('null = pakai bawaan peran', boleh(izinEfektif('sales', null), 'sph'), true);
cek('JSON rusak = pakai bawaan peran', boleh(izinEfektif('sales', '{rusak' as any), 'sph'), true);

console.log('\n── Potongan SQL penyaring kepemilikan ──');
cek('admin: tanpa batasan SQL', saringPemilik(admin, 'sales').sql, '');
cek('sales: ada batasan SQL', saringPemilik(sales, 'sales').sql.length > 0, true);
cek('sales: menyaring pakai nama', saringPemilik(sales, 'sales').params, ['Budi', 'Budi']);

// Sales tanpa izin ubah sama sekali
const penonton = akun('sales', ['lihat_sendiri', 'dashboard']);
cek('tanpa ubah_sendiri -> tidak boleh ubah', penonton.cakupanUbah, 'tidak');
cek('tanpa ubah_sendiri -> bolehSentuh(ubah) ditolak', bolehSentuh(penonton, 'Budi', 'ubah'), false);

console.log(`\n${'='.repeat(46)}\n  LULUS: ${lulus}   GAGAL: ${gagal}\n${'='.repeat(46)}\n`);
process.exit(gagal ? 1 : 0);
