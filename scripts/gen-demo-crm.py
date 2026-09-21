#!/usr/bin/env python3
# ============================================================
# Generator data demo CRM Sales — 10 lead, tiap lead
# menonjolkan satu fitur berbeda untuk presentasi.
#
# Semua baris memakai id berawalan "demo-crm-" / "demo-biaya-"
# supaya gampang dihapus lagi (lihat hapus-demo-crm.sql).
# ============================================================
import json, datetime as dt

Z = lambda s: s  # sudah ISO lengkap

def jam(dari, ke):
    a = dt.datetime.fromisoformat(dari.replace('Z', '+00:00'))
    b = dt.datetime.fromisoformat(ke.replace('Z', '+00:00'))
    return round((b - a).total_seconds() / 3600, 2)

def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"

def skor(krit):
    return sum(20 for k in krit if k == 'Ya')

def kual(s):
    return 'HOT' if s >= 80 else 'WARM' if s >= 40 else 'COLD'

# approver mengikuti crm_ref_diskon (desimal: 0.03 = 3%)
def approver(d):
    if not d or d <= 0:
        return 'Tidak Perlu'
    if 0 < d <= 0.03:  return 'Sales Manager'
    if 0.03 < d <= 0.08: return 'Direktur Operasional'
    return 'Direktur'

# ── 10 LEAD DEMO ────────────────────────────────────────────
# fitur = fitur yang ditonjolkan lead ini
L = []
def lead(**k): L.append(k)

lead(fitur='Skor maksimal + lead segar belum dikontak',
     nama='Bpk. Hendra Wijaya', hp='0812-1100-2233', kota='Bekasi',
     kanal='PAID-GA-S', sales='Arif', assign='Round Robin',
     masuk='2026-09-21T08:15:00.000Z', kontak=None,
     krit=['Ya','Ya','Ya','Ya','Ya'], status='Lead Baru',
     kebutuhan='Home lift 3 lantai, rumah baru',
     gps='-6.2383, 106.9756',
     catatan='Baru masuk pagi ini. Prioritas dihubungi hari ini.',
     journey=[(None, 'Lead Baru', '2026-09-21T08:15:00.000Z', 'Lead dibuat dari Google Ads - Search')])

lead(fitur='Respons cepat 35 menit + kualifikasi WARM',
     nama='Ibu Ratna Sari', hp='0813-2255-7788', kota='Yogyakarta',
     kanal='ORG-IG', sales='Dewo', assign='Round Robin',
     masuk='2026-09-20T14:30:00.000Z', kontak='2026-09-20T15:05:00.000Z',
     krit=['Ya','Ya','Belum Jelas','Ya','Belum Jelas'], status='Kontak Pertama Dilakukan',
     kebutuhan='Home lift 2 lantai, renovasi rumah',
     gps=None, catatan='Sudah dihubungi, minta dikirim katalog dulu.',
     journey=[(None, 'Lead Baru', '2026-09-20T14:30:00.000Z', 'Lead dibuat dari DM Instagram'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-20T15:05:00.000Z', 'Dihubungi via WhatsApp, minta katalog')])

lead(fitur='Lead dingin (COLD) — masih tahap cari informasi',
     nama='Bpk. Slamet Riyadi', hp='0857-3311-9900', kota='Semarang',
     kanal='ORG-TT', sales='Firman', assign='Manual',
     masuk='2026-09-19T10:00:00.000Z', kontak='2026-09-19T13:20:00.000Z',
     krit=['Ya','Tidak','Tidak','Belum Jelas','Tidak'], status='Survey Dijadwalkan',
     kebutuhan='Tanya harga lift barang, masih cari-cari info',
     gps=None, catatan='Belum ada anggaran. Masih tahap informasi.',
     journey=[(None, 'Lead Baru', '2026-09-19T10:00:00.000Z', 'Lead dibuat dari TikTok'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-19T13:20:00.000Z', 'Dihubungi, masih cari info'),
              ('Kontak Pertama Dilakukan', 'Survey Dijadwalkan', '2026-09-20T09:00:00.000Z', 'Survey dijadwalkan pekan depan')])

lead(fitur='Kanal affiliate (arsitek) — rujukan pihak ketiga',
     nama='PT Graha Karya Mandiri (Bpk. Yusuf)', hp='0811-7788-4455', kota='Surabaya',
     kanal='AFF-ARS', sales='Imam', assign='Manual',
     masuk='2026-09-17T09:00:00.000Z', kontak='2026-09-17T09:40:00.000Z',
     krit=['Ya','Ya','Ya','Ya','Belum Jelas'], status='Survey Selesai',
     kebutuhan='Passenger lift 4 lantai, gedung kantor baru',
     gps='-7.2575, 112.7521',
     catatan='Rujukan arsitek. Lokasi sudah disurvei, menunggu keputusan direksi.',
     journey=[(None, 'Lead Baru', '2026-09-17T09:00:00.000Z', 'Lead dibuat dari rujukan arsitek'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-17T09:40:00.000Z', 'Kontak via telepon'),
              ('Kontak Pertama Dilakukan', 'Survey Dijadwalkan', '2026-09-18T08:00:00.000Z', 'Jadwal survey disepakati'),
              ('Survey Dijadwalkan', 'Survey Selesai', '2026-09-19T10:30:00.000Z', 'Survey selesai, ukuran sudah diambil')])

lead(fitur='SPH terkirim + nilai penawaran tercatat',
     nama='Ibu Maya Kusuma', hp='0812-9090-1212', kota='Denpasar',
     kanal='PAID-META-IG', sales='Izzu', assign='Round Robin',
     masuk='2026-09-15T11:00:00.000Z', kontak='2026-09-15T11:25:00.000Z',
     krit=['Ya','Ya','Ya','Ya','Ya'], status='SPH Terkirim',
     kebutuhan='Home lift 3 lantai, villa',
     gps='-8.6705, 115.2126', catatan='SPH sudah dikirim, menunggu tanggapan.',
     sph='512/SPH/LIFT/BAI/IX/2026', tgl_sph='2026-09-18', nilai=285_000_000,
     journey=[(None, 'Lead Baru', '2026-09-15T11:00:00.000Z', 'Lead dibuat dari Meta Ads Instagram'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-15T11:25:00.000Z', 'Kontak via WhatsApp'),
              ('Kontak Pertama Dilakukan', 'Survey Dijadwalkan', '2026-09-16T09:00:00.000Z', 'Jadwal survey disepakati'),
              ('Survey Dijadwalkan', 'Survey Selesai', '2026-09-17T11:00:00.000Z', 'Survey selesai'),
              ('Survey Selesai', 'Hitung Harga 3 Lingkup', '2026-09-17T15:00:00.000Z', 'Perhitungan 3 lingkup selesai'),
              ('Hitung Harga 3 Lingkup', 'SPH Terkirim', '2026-09-18T10:00:00.000Z', 'SPH 512/SPH/LIFT/BAI/IX/2026 terkirim')])

lead(fitur='Diskon 3% — wewenang Sales Manager (jenjang 1)',
     nama='Bpk. Agus Setiawan', hp='0813-4455-6677', kota='Tangerang',
     kanal='PAID-GA-P', sales='Jihad', assign='Round Robin',
     masuk='2026-09-14T08:30:00.000Z', kontak='2026-09-14T09:10:00.000Z',
     krit=['Ya','Ya','Ya','Belum Jelas','Ya'], status='Menunggu Approval Diskon',
     kebutuhan='Home lift 4 lantai + pit, rumah tinggal',
     gps='-6.1781, 106.6300', catatan='Minta potongan 3%, masih dalam wewenang Sales Manager.',
     sph='498/SPH/LIFT/BAI/IX/2026', tgl_sph='2026-09-17', nilai=420_000_000,
     diskon=0.03, alasan='Kompetitor menawarkan harga 3% lebih rendah',
     journey=[(None, 'Lead Baru', '2026-09-14T08:30:00.000Z', 'Lead dibuat dari Google Ads - Performance Max'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-14T09:10:00.000Z', 'Kontak via telepon'),
              ('Kontak Pertama Dilakukan', 'Survey Dijadwalkan', '2026-09-15T09:00:00.000Z', 'Jadwal survey disepakati'),
              ('Survey Dijadwalkan', 'Survey Selesai', '2026-09-16T10:00:00.000Z', 'Survey selesai'),
              ('Survey Selesai', 'Hitung Harga 3 Lingkup', '2026-09-16T14:00:00.000Z', 'Perhitungan selesai'),
              ('Hitung Harga 3 Lingkup', 'SPH Terkirim', '2026-09-17T10:00:00.000Z', 'SPH terkirim'),
              ('SPH Terkirim', 'Negosiasi', '2026-09-18T13:00:00.000Z', 'Prospek minta potongan harga'),
              ('Negosiasi', 'Menunggu Approval Diskon', '2026-09-19T09:00:00.000Z', 'Pengajuan diskon 3% diajukan')])

lead(fitur='Diskon 6,5% — naik ke Direktur Operasional (jenjang 2)',
     nama='RSUD Sejahtera (Bpk. dr. Bayu)', hp='0811-2233-4455', kota='Bandung',
     kanal='PAID-GA-S', sales='Arif', assign='Manual',
     masuk='2026-09-12T09:15:00.000Z', kontak='2026-09-12T09:35:00.000Z',
     krit=['Ya','Ya','Ya','Ya','Ya'], status='Menunggu Approval Diskon',
     kebutuhan='4 unit bed lift rumah sakit, proyek pengadaan',
     gps='-6.9175, 107.6191', catatan='Proyek pengadaan, butuh penyesuaian anggaran.',
     sph='476/SPH/LIFT/BAI/IX/2026', tgl_sph='2026-09-16', nilai=1_250_000_000,
     diskon=0.065, alasan='Pengadaan pemerintah, butuh penyesuaian anggaran 6,5%',
     journey=[(None, 'Lead Baru', '2026-09-12T09:15:00.000Z', 'Lead dibuat dari Google Ads - Search'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-12T09:35:00.000Z', 'Kontak via telepon'),
              ('Kontak Pertama Dilakukan', 'Survey Dijadwalkan', '2026-09-13T09:00:00.000Z', 'Jadwal survey disepakati'),
              ('Survey Dijadwalkan', 'Survey Selesai', '2026-09-14T13:00:00.000Z', 'Survey selesai, 4 titik terpasang'),
              ('Survey Selesai', 'Hitung Harga 3 Lingkup', '2026-09-15T10:00:00.000Z', 'Perhitungan 4 unit selesai'),
              ('Hitung Harga 3 Lingkup', 'SPH Terkirim', '2026-09-16T09:00:00.000Z', 'SPH terkirim ke bagian pengadaan'),
              ('SPH Terkirim', 'Negosiasi', '2026-09-17T14:00:00.000Z', 'Rapat anggaran dengan tim pengadaan'),
              ('Negosiasi', 'Menunggu Approval Diskon', '2026-09-18T10:00:00.000Z', 'Pengajuan diskon 6,5% diajukan')])

lead(fitur='Diskon 12% — naik ke Direktur (jenjang tertinggi)',
     nama='Hotel Nusantara (Ibu Dewi Lestari)', hp='0812-5566-7788', kota='Badung, Bali',
     kanal='ORG-GBP', sales='Dewo', assign='Manual',
     masuk='2026-09-10T13:45:00.000Z', kontak='2026-09-10T15:30:00.000Z',
     krit=['Ya','Ya','Belum Jelas','Belum Jelas','Tidak'], status='Menunggu Approval Diskon',
     kebutuhan='2 unit lift hotel 5 lantai',
     gps='-8.6500, 115.2167', catatan='Permintaan manajemen hotel. Di atas wewenang standar.',
     sph='461/SPH/LIFT/BAI/IX/2026', tgl_sph='2026-09-15', nilai=890_000_000,
     diskon=0.12, alasan='Permintaan manajemen hotel, harga pesaing 12% lebih rendah',
     journey=[(None, 'Lead Baru', '2026-09-10T13:45:00.000Z', 'Lead dibuat dari Google Business Profile'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-10T15:30:00.000Z', 'Ditelepon langsung dari Maps'),
              ('Kontak Pertama Dilakukan', 'Survey Dijadwalkan', '2026-09-11T09:00:00.000Z', 'Jadwal survey disepakati'),
              ('Survey Dijadwalkan', 'Survey Selesai', '2026-09-12T14:00:00.000Z', 'Survey selesai'),
              ('Survey Selesai', 'Hitung Harga 3 Lingkup', '2026-09-13T10:00:00.000Z', 'Perhitungan 2 unit selesai'),
              ('Hitung Harga 3 Lingkup', 'SPH Terkirim', '2026-09-15T09:00:00.000Z', 'SPH terkirim ke manajemen'),
              ('SPH Terkirim', 'Negosiasi', '2026-09-16T11:00:00.000Z', 'Negosiasi harga dengan manajemen'),
              ('Negosiasi', 'Menunggu Approval Diskon', '2026-09-17T09:00:00.000Z', 'Pengajuan diskon 12% — di atas wewenang standar')])

lead(fitur='Pemicu OTOMATIS antrean Meja Dokumen + peringatan lewat SLA',
     nama='Bpk. Tri Handoko', hp='0813-9900-1122', kota='Jakarta Selatan',
     kanal='PAID-META-FB', sales='Firman', assign='Round Robin',
     masuk='2026-09-08T10:00:00.000Z', kontak='2026-09-08T10:20:00.000Z',
     krit=['Ya','Ya','Ya','Ya','Ya'], status='Deal - Menunggu Dokumen',
     kebutuhan='Home lift 3 lantai, rumah tinggal',
     gps='-6.2615, 106.8106', catatan='Sudah deal. Menunggu dokumen SPK disusun admin.',
     sph='445/SPH/LIFT/BAI/IX/2026', tgl_sph='2026-09-11', nilai=315_000_000,
     journey=[(None, 'Lead Baru', '2026-09-08T10:00:00.000Z', 'Lead dibuat dari Meta Ads Facebook'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-08T10:20:00.000Z', 'Kontak via WhatsApp'),
              ('Kontak Pertama Dilakukan', 'Survey Dijadwalkan', '2026-09-09T09:00:00.000Z', 'Jadwal survey disepakati'),
              ('Survey Dijadwalkan', 'Survey Selesai', '2026-09-10T10:00:00.000Z', 'Survey selesai'),
              ('Survey Selesai', 'Hitung Harga 3 Lingkup', '2026-09-10T15:00:00.000Z', 'Perhitungan selesai'),
              ('Hitung Harga 3 Lingkup', 'SPH Terkirim', '2026-09-11T09:00:00.000Z', 'SPH terkirim'),
              ('SPH Terkirim', 'Negosiasi', '2026-09-12T10:00:00.000Z', 'Prospek minta waktu pertimbangan'),
              ('Negosiasi', 'Deal - Menunggu Dokumen', '2026-09-20T09:00:00.000Z', 'Prospek setuju, lanjut ke dokumen SPK')])

lead(fitur='Perjalanan penuh sampai DEAL — dasar hitung ROAS',
     nama='Bpk. Edi Susanto', hp='0811-3344-5566', kota='Bekasi',
     kanal='AFF-KON', sales='Imam', assign='Manual',
     masuk='2026-09-03T08:00:00.000Z', kontak='2026-09-03T08:30:00.000Z',
     krit=['Ya','Ya','Ya','Ya','Ya'], status='SPK Ditandatangani + DP',
     kebutuhan='Home lift 4 lantai, rumah tinggal',
     gps='-6.2843, 106.9900', catatan='SPK sudah ditandatangani, DP diterima. Deal selesai.',
     sph='402/SPH/LIFT/BAI/IX/2026', tgl_sph='2026-09-05', nilai=365_000_000,
     spk='118/SPK/LIFT/BAI/IX/2026', tgl_spk='2026-09-12',
     journey=[(None, 'Lead Baru', '2026-09-03T08:00:00.000Z', 'Lead dibuat dari rujukan kontraktor'),
              ('Lead Baru', 'Kontak Pertama Dilakukan', '2026-09-03T08:30:00.000Z', 'Kontak via telepon'),
              ('Kontak Pertama Dilakukan', 'Survey Dijadwalkan', '2026-09-04T09:00:00.000Z', 'Jadwal survey disepakati'),
              ('Survey Dijadwalkan', 'Survey Selesai', '2026-09-05T10:00:00.000Z', 'Survey selesai'),
              ('Survey Selesai', 'Hitung Harga 3 Lingkup', '2026-09-05T14:00:00.000Z', 'Perhitungan selesai'),
              ('Hitung Harga 3 Lingkup', 'SPH Terkirim', '2026-09-05T16:00:00.000Z', 'SPH 402/SPH/LIFT/BAI/IX/2026 terkirim'),
              ('SPH Terkirim', 'Negosiasi', '2026-09-08T10:00:00.000Z', 'Negosiasi harga dan jadwal pemasangan'),
              ('Negosiasi', 'Deal - Menunggu Dokumen', '2026-09-09T09:00:00.000Z', 'Prospek setuju, lanjut ke dokumen'),
              ('Deal - Menunggu Dokumen', 'SPK Disusun', '2026-09-10T09:00:00.000Z', 'SPK mulai disusun admin'),
              ('SPK Disusun', 'SPK Bernomor & Terkirim', '2026-09-11T10:00:00.000Z', 'SPK bernomor 118/SPK/LIFT/BAI/IX/2026'),
              ('SPK Bernomor & Terkirim', 'SPK Ditandatangani + DP', '2026-09-12T14:00:00.000Z', 'SPK ditandatangani, DP diterima')])

# ── BIAYA IKLAN September 2026 (dasar CPL / CAC / ROAS) ─────
BIAYA = [
    ('demo-biaya-01', 'PAID-GA-S',    8_500_000, 'Google Ads - Search, September 2026'),
    ('demo-biaya-02', 'PAID-GA-P',    4_000_000, 'Google Ads - Performance Max, September 2026'),
    ('demo-biaya-03', 'PAID-META-IG', 3_200_000, 'Meta Ads Instagram, September 2026'),
    ('demo-biaya-04', 'PAID-META-FB', 2_800_000, 'Meta Ads Facebook, September 2026'),
    ('demo-biaya-05', 'AFF-ARS',      1_500_000, 'Fee arsitek — 1 closing'),
    ('demo-biaya-06', 'AFF-KON',      1_000_000, 'Fee kontraktor — 1 closing'),
]

# ── DOKUMEN (Meja Dokumen) ──────────────────────────────────
# 1 dokumen lewat SLA (belum selesai) + 2 dokumen selesai tepat waktu
DOK = [
    # id, id_lead_index(1-based), jenis, masuk, sla, selesai, pic, no_terbit, catatan
    ('demo-dok-01', 9, 'SPK Induk',  '2026-09-20T09:00:00.000Z', 24, None,
     'Abiyya', None, 'Belum diproses — menunggu kelengkapan berkas dari sales'),
    ('demo-dok-02', 10, 'SPK Induk', '2026-09-12T09:00:00.000Z', 24, '2026-09-12T21:00:00.000Z',
     'Abiyya', '118/SPK/LIFT/BAI/IX/2026', 'Selesai lebih cepat dari SLA'),
    ('demo-dok-03', 10, 'SPK Final', '2026-09-14T09:00:00.000Z', 24, '2026-09-15T04:00:00.000Z',
     'Abiyya', '118/SPK/LIFT/BAI/IX/2026', 'Berkas final lengkap'),
]

out = []
w = out.append

w('-- ============================================================')
w('-- DATA DEMO CRM SALES — 10 lead untuk presentasi fitur')
w('-- Dibuat otomatis oleh scripts/gen-demo-crm.py — jangan diedit manual.')
w('--')
w('-- Ciri baris demo: id berawalan "demo-crm-" / "demo-biaya-" / "demo-dok-"')
w('-- Cara menghapus: migration/d1/hapus-demo-crm.sql')
w('-- ============================================================')
w('')
w("DELETE FROM crm_lead_riwayat WHERE id_lead LIKE 'demo-crm-%';")
w("DELETE FROM crm_dokumen      WHERE id_lead LIKE 'demo-crm-%';")
w("DELETE FROM crm_leads        WHERE id        LIKE 'demo-crm-%';")
w("DELETE FROM crm_biaya_iklan  WHERE id        LIKE 'demo-biaya-%';")
w('')

# ── LEADS ──
w('-- ── 10 LEAD DEMO ─────────────────────────────────────────────')
w('INSERT INTO crm_leads (id,kode_lead,waktu_masuk,kode_kanal,nama_prospek,no_hp,kota,kebutuhan,')
w('  sales,metode_assign,butuh_jelas,lokasi_siap,budget_masuk,rencana_6bulan,bicara_decider,')
w('  skor,kualifikasi,waktu_kontak_pertama,respons_jam,status_terakhir,no_sph,tgl_sph,nilai_sph,')
w('  diskon_diminta,alasan_diskon,approver_wajib,status_approval,no_spk,tgl_spk,')
w('  lokasi_gps,catatan,diubah_oleh,waktu_diubah,created_at,updated_at) VALUES')

rows = []
for i, x in enumerate(L, start=1):
    s = skor(x['krit']); k = kual(s)
    resp = jam(x['masuk'], x['kontak']) if x['kontak'] else None
    d = x.get('diskon')
    appr = approver(d) if ('nilai' in x) else None
    rows.append('(' + ','.join([
        q(f'demo-crm-{i:02d}'), q(f'LEAD-{i:04d}'), q(x['masuk']), q(x['kanal']),
        q(x['nama']), q(x['hp']), q(x['kota']), q(x['kebutuhan']),
        q(x['sales']), q(x['assign']),
        q(x['krit'][0]), q(x['krit'][1]), q(x['krit'][2]), q(x['krit'][3]), q(x['krit'][4]),
        q(s), q(k), q(x['kontak']), q(resp), q(x['status']),
        q(x.get('sph')), q(x.get('tgl_sph')), q(x.get('nilai')),
        q(d), q(x.get('alasan')), q(appr),
        q('Menunggu' if d else None),
        q(x.get('spk')), q(x.get('tgl_spk')),
        q(x.get('gps')), q(x.get('catatan')),
        q(x['sales']), q(x['journey'][-1][2]), q(x['journey'][0][2]), q(x['journey'][-1][2]),
    ]) + ')')
w(',\n'.join(rows) + ';')
w('')

# ── RIWAYAT ──
w('-- ── JEJAK RIWAYAT (audit trail tiap lead) ───────────────────')
w('INSERT INTO crm_lead_riwayat (id,id_lead,waktu,dari_status,ke_status,oleh,catatan) VALUES')
rr = []
for i, x in enumerate(L, start=1):
    for j, (dari, ke, waktu, cat) in enumerate(x['journey'], start=1):
        rr.append('(' + ','.join([
            q(f'demo-crm-{i:02d}-r{j:02d}'), q(f'demo-crm-{i:02d}'), q(waktu),
            q(dari), q(ke), q(x['sales']), q(cat),
        ]) + ')')
w(',\n'.join(rr) + ';')
w('')

# ── BIAYA IKLAN ──
w('-- ── BIAYA IKLAN September 2026 (dasar CPL/CAC/ROAS) ─────────')
w('INSERT INTO crm_biaya_iklan (id,periode,kode_kanal,biaya,catatan,created_at,updated_at) VALUES')
bb = [('(' + ','.join([q(a), q('2026-09'), q(b), q(c), q(d),
                       q('2026-09-21T07:00:00.000Z'), q('2026-09-21T07:00:00.000Z')]) + ')')
      for a, b, c, d in BIAYA]
w(',\n'.join(bb) + ';')
w('')

# ── DOKUMEN ──
w('-- ── MEJA DOKUMEN (1 lewat SLA + 2 selesai tepat waktu) ─────')
w('INSERT INTO crm_dokumen (id,id_lead,jenis_dokumen,masuk_meja,sla_jam,target_selesai,selesai,')
w('  lama_jam,status_sla,pic_admin,no_dokumen_terbit,catatan,created_at,updated_at) VALUES')
dd = []
for did, idx, jenis, masuk, sla, selesai, pic, no, cat in DOK:
    target = (dt.datetime.fromisoformat(masuk.replace('Z', '+00:00'))
              + dt.timedelta(hours=sla)).strftime('%Y-%m-%dT%H:%M:%S.000Z')
    lama = jam(masuk, selesai) if selesai else None
    st = ('Selesai tepat waktu' if lama is not None and lama <= sla
          else 'Melebihi SLA' if lama is not None else 'Menunggu diproses')
    dd.append('(' + ','.join([
        q(did), q(f'demo-crm-{idx:02d}'), q(jenis), q(masuk), q(sla), q(target), q(selesai),
        q(lama), q(st), q(pic), q(no), q(cat), q(masuk), q(selesai or masuk),
    ]) + ')')
w(',\n'.join(dd) + ';')
w('')

sql = '\n'.join(out)
path = 'migration/d1/2026-09-21-seed-demo-crm.sql'
open(path, 'w').write(sql)

# ── RINGKASAN ──
print(f'SQL ditulis: {path}  ({len(sql.splitlines())} baris)')
print()
print(f'{"#":>2}  {"Prospek":34} {"Kanal":12} {"Sales":7} {"Skor":>4} {"Status":26} Fitur')
print('─' * 132)
for i, x in enumerate(L, start=1):
    s = skor(x['krit'])
    print(f'{i:>2}  {x["nama"][:33]:34} {x["kanal"]:12} {x["sales"]:7} {s:>4} {x["status"]:26} {x["fitur"]}')
print()
tot = sum(b[2] for b in BIAYA)
print(f'Biaya iklan Sep 2026 : Rp {tot:,}'.replace(',', '.'))
print(f'Total lead           : {len(L)}')
print(f'Riwayat rows         : {sum(len(x["journey"]) for x in L)}')
print(f'Dokumen rows         : {len(DOK)}')
