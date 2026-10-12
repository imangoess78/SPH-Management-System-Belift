import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  peranMasterDari, bolehKunciFinal, bolehKunciFinalMaster, bolehTerbitPOMaster,
  bolehUbahData, boleh, izinEfektif, normalisasiPeran,
} from '../../shared/akses';

/**
 * Wewenang Final Survey & PO — DUA SUMBER YANG DULU BERTENTANGAN.
 *
 * Gejala yang dilaporkan: akun `staff` tidak melihat tombol "Final Survey
 * Baru" maupun "PO Baru", padahal API-nya mengizinkan. Ternyata ada dua
 * sistem peran yang tidak sinkron:
 *
 *  1. IZIN (`shared/akses.ts`) — menentukan boleh MASUK halaman. `staff`
 *     memang diberi `survey_final`, `po`, dan `kunci_final`.
 *  2. PERAN MASTER CRM (`crm_ref_sales`) — menentukan tombol. Tampilan
 *     menghitungnya sendiri dengan memanggil `/api/crm?resource=meta`, tapi
 *     endpoint itu menuntut izin `crm` yang TIDAK dimiliki staff → 403 →
 *     daftar kosong → pencocokan gagal → peran jatuh ke 'Sales' → tombol
 *     hilang padahal server mengizinkan.
 *
 * Perbaikannya: wewenang yang dihitung dari peran Master CRM kini DIKIRIM
 * SERVER (`peranMaster` pada /api/auth/session), dan tombol PEMBUATAN
 * memakai izin halaman — persis yang diperiksa API.
 */

const baca = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf8');

describe('peranMasterDari — cerminan profilPemakai() di server', () => {
  it('memakai peran Master CRM bila akun terdaftar', () => {
    expect(peranMasterDari('staff', 'Surveyor')).toBe('Surveyor');
    expect(peranMasterDari('staff', 'Operasional')).toBe('Operasional');
    expect(peranMasterDari('admin', 'Manager')).toBe('Manager');
  });

  it('akun tanpa izin crm tetap dapat peran yang benar — inilah akar masalahnya', () => {
    // `toko.dexterwayne99@gmail.com` di produksi: role `staff`, ada di
    // crm_ref_sales sebagai Surveyor. Dulu tampilan tidak bisa memuat daftar
    // Master CRM-nya, jadi perannya jatuh ke 'Sales' dan tombolnya hilang.
    expect(peranMasterDari('staff', 'Surveyor')).toBe('Surveyor');
    expect(bolehKunciFinalMaster(peranMasterDari('staff', 'Surveyor'))).toBe(true);
  });

  it('meneruskan nilai tak dikenal apa adanya, sehingga TIDAK menambah wewenang', () => {
    // Server memakai ref.peran langsung. Nilai asing harus tetap asing —
    // bukan diam-diam jadi 'Sales' (bikin pesan galat menyesatkan) atau jadi
    // 'Admin Sistem' (menambah wewenang).
    expect(peranMasterDari('staff', 'Salah Ketik')).toBe('Salah Ketik');
    expect(bolehKunciFinalMaster('Salah Ketik')).toBe(false);
    expect(bolehTerbitPOMaster('Salah Ketik')).toBe(false);
  });

  it('jatuh ke Admin Sistem untuk akun ber-role admin yang belum terdaftar', () => {
    // Dulu akun `admin` yang emailnya tidak ada di crm_ref_sales jatuh ke
    // 'Sales', sehingga admin kehilangan tombolnya. Admin memegang seluruh
    // izin, jadi ini tidak masuk akal.
    expect(peranMasterDari('admin', null)).toBe('Admin Sistem');
    expect(bolehKunciFinalMaster(peranMasterDari('admin', null))).toBe(true);
    expect(bolehTerbitPOMaster(peranMasterDari('admin', null))).toBe(true);
  });

  it('jatuh ke Sales (paling sempit) untuk akun non-admin yang belum terdaftar', () => {
    expect(peranMasterDari('staff', null)).toBe('Sales');
    expect(peranMasterDari('sales', null)).toBe('Sales');
    expect(bolehKunciFinalMaster(peranMasterDari('staff', null))).toBe(false);
    expect(bolehTerbitPOMaster(peranMasterDari('staff', null))).toBe(false);
  });

  it('role tak dikenal diperlakukan seperti staff, bukan admin', () => {
    expect(normalisasiPeran('entah')).toBe('staff');
    expect(peranMasterDari('entah', null)).toBe('Sales');
  });
});

describe('matriks izin — staff memang berhak atas Final Survey & PO', () => {
  it('staff punya survey_final, po, dan kunci_final', () => {
    const izin = izinEfektif('staff', null);
    expect(boleh(izin, 'survey_final')).toBe(true);
    expect(boleh(izin, 'po')).toBe(true);
    expect(boleh(izin, 'kunci_final')).toBe(true);
  });

  it('staff TIDAK punya crm — inilah sebab 403 pada /api/crm?resource=meta', () => {
    const izin = izinEfektif('staff', null);
    expect(boleh(izin, 'crm')).toBe(false);
  });
});

describe('tombol pembuatan memakai IZIN, bukan peran Master CRM', () => {
  it('SurveyList menggerbangi tombol dengan survey_final / survey_sales', () => {
    const s = baca('src/pages/survey/SurveyList.tsx');
    expect(s).toContain("boleh(izin, 'survey_final')");
    expect(s).toContain("boleh(izin, 'survey_sales')");
    expect(s, 'tombol kembali memakai peran Master CRM — staff kehilangan tombolnya')
      .not.toMatch(/bolehIsi(Final|Survey)\(/);
  });

  it('PoList menggerbangi tombol PO Baru dengan izin ubah', () => {
    const s = baca('src/pages/po/PoList.tsx');
    expect(s).toContain('bolehUbahData(izin)');
    expect(s, 'tombol PO Baru kembali memakai peran Master CRM')
      .not.toMatch(/bolehTerbitPO\(/);
  });

  it('SurveyForm memisahkan izin mengisi dari wewenang mengunci', () => {
    const s = baca('src/pages/survey/SurveyForm.tsx');
    expect(s).toContain("boleh(izin, 'survey_final')");
    expect(s).toContain('bolehKunciFinal(izin, peranMaster)');
    expect(s).not.toMatch(/bolehIsi(Final|Survey)\(/);
  });

  it('PoDetail menuntut peran penerbit hanya untuk MENERBITKAN', () => {
    const s = baca('src/pages/po/PoDetail.tsx');
    expect(s).toContain('bolehTerbitPOMaster(peranMaster)');
    expect(s).toContain('bolehUbahData(izin)');
    // Kolom data PO & tombol Simpan ikut izin ubah, bukan wewenang terbit.
    expect(s).not.toMatch(/disabled=\{!bolehTerbit\}/);
  });
});

describe('staff DIIZINKAN mengunci Final Survey — keputusan Mas', () => {
  it('langganan izin staff memuat kunci_final', () => {
    expect(izinEfektif('staff', null)).toContain('kunci_final');
  });

  it('bolehKunciFinal() mengizinkan staff lewat izin kunci_final', () => {
    const izinStaff = izinEfektif('staff', null);
    expect(bolehKunciFinal(izinStaff, peranMasterDari('staff', null))).toBe(true);
  });

  it('staff tetap boleh mengunci walau belum ditugaskan di Master CRM', () => {
    // Kasus nyata: toko.dexterwayne99@gmail.com (staff, belum ada di
    // crm_ref_sales). Dulu perannya jatuh ke 'Sales' → tombol kunci hilang.
    const izinStaff = izinEfektif('staff', null);
    const pm = peranMasterDari('staff', null);
    expect(pm).toBe('Sales');
    expect(bolehKunciFinal(izinStaff, pm)).toBe(true);
  });

  it('surveyor lewat peran Master CRM tetap boleh mengunci, tanpa izin kunci_final', () => {
    // Jalur kedua: akun yang ditugaskan sebagai Surveyor tidak kehilangan
    // wewenang kalau izinnya disesuaikan.
    expect(bolehKunciFinal([], 'Surveyor')).toBe(true);
    expect(bolehKunciFinal([], 'Manager')).toBe(true);
  });

  it('yang benar-benar tidak berwenang tetap ditolak', () => {
    expect(bolehKunciFinal([], 'Sales')).toBe(false);
    expect(bolehKunciFinal([], 'Operasional')).toBe(false);
  });

  it('server ikut memakai izin kunci_final saat mengunci', () => {
    const s = baca('functions/api/survey.ts');
    expect(s).toContain("izin.includes('kunci_final')");
    // Pemanggilnya harus meneruskan izin, bukan hanya userId.
    expect(s).toContain('kunci(id, aksi, body, env, session.user_id, akses.izin)');
  });
});

describe('tampilan tidak lagi menghitung wewenang dari Master CRM', () => {
  it('useCrmUser memakai peranMaster dari server dan menyediakan cadangan', () => {
    const s = baca('src/hooks/useCrmUser.ts');
    expect(s).toContain('peranMaster || cadangan.peran');
    expect(s, 'peran masih dihitung langsung tanpa cadangan tersimpan')
      .toContain('tentukanPeran(');
  });

  it('sesi mengirim peranMaster yang dihitung server', () => {
    const s = baca('functions/api/auth/session.ts');
    expect(s).toContain('peranMasterDari(u.role, ref?.peran)');
    expect(s, 'session tidak lagi membaca peran dari crm_ref_sales')
      .toContain('SELECT nama, peran FROM crm_ref_sales');
  });

  it('login juga mengirim peranMaster, supaya konsisten dengan sesi', () => {
    const s = baca('functions/api/auth/login.ts');
    expect(s).toContain('peranMasterDari(user.role, ref?.peran)');
  });

  it('nilai jatuhan peranMaster di shared SAMA dengan profilPemakai() di server', () => {
    // Kalau server mengubah aturan jatuhannya, uji ini gagal — supaya
    // tampilan dan server tidak pernah bercabang lagi.
    const survey = baca('functions/api/survey.ts');
    const po = baca('functions/api/po.ts');
    const pola = /p\?\.role === 'admin' \? 'Admin Sistem' : 'Sales'/;
    expect(survey, 'aturan jatuhan di survey.ts berubah').toMatch(pola);
    expect(po, 'aturan jatuhan di po.ts berubah').toMatch(pola);
  });
});

describe('cerminan daftar peran server tidak boleh bercabang', () => {
  it('PERAN_PENGUNCI di shared sama dengan di functions/api/survey.ts', () => {
    const s = baca('functions/api/survey.ts');
    const m = s.match(/const PERAN_PENGUNCI = \[([^\]]+)\]/);
    expect(m, 'PERAN_PENGUNCI tidak ditemukan di survey.ts').not.toBeNull();
    expect(m![1].replace(/['\s]/g, '')).toBe('Surveyor,Direktur,Manager,AdminSistem');
  });

  it('PERAN_PENERBIT di shared sama dengan di functions/api/po.ts', () => {
    const s = baca('functions/api/po.ts');
    const m = s.match(/const PERAN_PENERBIT = \[([^\]]+)\]/);
    expect(m, 'PERAN_PENERBIT tidak ditemukan di po.ts').not.toBeNull();
    expect(m![1].replace(/['\s]/g, '')).toBe('Operasional,Direktur,Manager,AdminSistem');
  });
});
