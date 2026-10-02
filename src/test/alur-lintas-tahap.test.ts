import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Tiga cacat alur yang ketemu saat mengalur ulang Lead → Survey → SPH →
 * Final Survey → PO → Proyek di database uji terpisah.
 *
 * Semuanya LOLOS tanpa error — aplikasinya terlihat normal. Yang salah baru
 * kelihatan setelah memeriksa ISI DATANYA, bukan cuma status responsnya.
 */

const CRM = readFileSync(resolve(__dirname, '../../functions/api/crm.ts'), 'utf8');
const SURVEY = readFileSync(resolve(__dirname, '../../functions/api/survey.ts'), 'utf8');
const PO = readFileSync(resolve(__dirname, '../../functions/api/po.ts'), 'utf8');

describe('status awal lead ikut tersimpan', () => {
  it('POST menulis status_terakhir, bukan membiarkannya NULL', () => {
    const i = CRM.indexOf("if (method === 'POST')");
    expect(i, "cabang POST hilang dari simpanLead").toBeGreaterThan(-1);
    const isi = CRM.slice(i, i + 1400);

    // Inti perbaikannya: kolom status diisi sebelum INSERT.
    expect(
      isi,
      'status awal tidak diisi — riwayat akan mencatat dari_status=NULL pada perubahan pertama',
    ).toContain("kolom.status_terakhir = 'Lead Baru'");

    // Dan riwayat memakai nilai kolom itu, bukan nilai cadangan terpisah.
    expect(isi).toMatch(/catatRiwayat\(newId, null, kolom\.status_terakhir as string/);
  });
});

describe('nama pelaku diambil dari app_users', () => {
  // Tabel `profiles` tidak pernah diisi aplikasi. Memulai query dari sana
  // membuat kolom "Diubah Oleh" selalu tertulis 'Pengguna'.
  const berkas: [string, string][] = [
    ['crm.ts', CRM],
    ['survey.ts', SURVEY],
    ['po.ts', PO],
  ];

  for (const [nama, isi] of berkas) {
    it(`${nama}: tidak memulai dari profiles`, () => {
      expect(
        /FROM\s+profiles\s+p?\s*LEFT\s+JOIN\s+app_users/i.test(isi),
        `${nama} masih memulai query dari profiles — nama pelaku akan jadi 'Pengguna'`,
      ).toBe(false);
    });

    it(`${nama}: app_users jadi sumber utama`, () => {
      expect(
        /FROM\s+app_users\s+u\s+LEFT\s+JOIN\s+profiles/i.test(isi),
        `${nama} tidak menjadikan app_users sumber utama`,
      ).toBe(true);
    });
  }
});

describe('urutan riwayat tidak dipotong ke detik', () => {
  // datetime() membuang milidetik. Beberapa aksi yang terjadi di detik yang
  // sama (Terbit lalu Revisi 2) lalu tampil dalam urutan acak. Jadi: tidak
  // boleh ada ORDER BY datetime(<kolom waktu>) DI MANA PUN di berkas ini —
  // bukan hanya di dekat kata 'riwayat'.
  const berkas: [string, string][] = [
    ['crm.ts', CRM],
    ['survey.ts', SURVEY],
    ['po.ts', PO],
  ];

  for (const [nama, isi] of berkas) {
    it(`${nama}: tidak ada ORDER BY datetime(waktu)`, () => {
      const cocok = isi.match(/ORDER BY datetime\((?:r\.)?waktu\)/gi) || [];
      expect(
        cocok,
        `${nama} masih mengurutkan riwayat dengan datetime(waktu) — ` +
          `beberapa aksi di detik yang sama akan tampil dalam urutan acak`,
      ).toEqual([]);
    });
  }

  it('ketiga berkas memang mengurutkan riwayat dengan kolom waktu', () => {
    // Penjaga terbalik: kalau suatu saat query-nya ditulis ulang tanpa
    // ORDER BY sama sekali, uji di atas akan hijau palsu.
    expect(CRM).toMatch(/FROM crm_lead_riwayat WHERE id_lead=\? ORDER BY waktu/);
    expect(SURVEY).toMatch(/FROM survey_riwayat WHERE jenis='survey' AND id_ref=\? ORDER BY waktu/);
    expect(PO).toMatch(/FROM survey_riwayat WHERE jenis='po' AND id_ref=\? ORDER BY waktu/);
  });
});

describe('lintas tahap', () => {
  it('kunci Final Survey memajukan lead & proyek', () => {
    const i = SURVEY.indexOf('async function kunci');
    const isi = SURVEY.slice(i, i + 1600);
    expect(isi).toContain("status_terakhir='Final Survey Selesai'");
    expect(isi).toMatch(/tahap_sekarang=\?[\s\S]{0,200}'PO'/);
  });

  it('PO terbit memindahkan lead ke PO Terbit ke Pabrik', () => {
    expect(PO).toContain("status_terakhir='PO Terbit ke Pabrik'");
  });

  it('revisi PO membandingkan dt Final Survey, bukan body permintaan', () => {
    // Terbit dan revisi ditangani satu fungsi: terbitkan(). Revisi = terbit
    // ulang dengan rev bertambah. Data teknisnya diambil dari Final Survey
    // yang terkunci — mengirim `dt` di body diabaikan sepenuhnya.
    const i = PO.indexOf('async function terbitkan');
    expect(i, 'terbitkan() hilang').toBeGreaterThan(-1);
    const isi = PO.slice(i, i + 2500);
    expect(
      isi,
      'revisi tidak mengambil data teknis dari Final Survey — daftar perubahan akan selalu kosong',
    ).toMatch(/FROM survey_teknis[\s\S]{0,200}terkunci/);
    // Dan perubahan dihitung dengan membandingkan revisi sebelumnya.
    expect(isi).toContain('bandingkan(dtSebelum, dt)');
  });
});

describe('validasi status', () => {
  it('status karangan ditolak, dicek ke crm_ref_status', () => {
    // Dulu server menerima status apa pun. Lead berstatus karangan hilang
    // dari seluruh kolom Kanban dan mendarat di "Status tak dikenal".
    expect(CRM).toMatch(
      /FROM crm_ref_status WHERE status=\? LIMIT 1/,
    );
    expect(CRM).toContain('tidak dikenal di Master CRM');
  });

  it('lompat status TIDAK dilarang', () => {
    // Keputusan pemilik produk: alur boleh dilompati, tidak kaku.
    // Jadi tidak boleh ada penjagaan urutan/urutan status.
    const i = CRM.indexOf('tidak dikenal di Master CRM');
    const sekitarnya = CRM.slice(Math.max(0, i - 1200), i + 400);

    for (const terlarang of ['urutan', 'lompat', 'harus berurutan', 'nextStatus', 'statusSebelumnya']) {
      expect(
        sekitarnya.includes(terlarang),
        `ada penjagaan "${terlarang}" — lompat status jadi terlarang, padahal tidak boleh`,
      ).toBe(false);
    }
  });
});
