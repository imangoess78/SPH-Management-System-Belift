#!/usr/bin/env python3
"""
Buat 1 sampel data DUMMY yang RUNUT dari Lead -> Survey Sales -> SPH -> SPK
-> Final Survey -> PO Pabrik.

Data dibuat LEWAT API RESMI (bukan INSERT mentah), supaya kode proyek, nomor
survey, nomor PO, revisi, dan seluruh riwayat digenerate oleh server — sama
persis seperti kalau staf mengerjakannya sendiri di layar.

Tiga peran dipakai supaya riwayatnya realistis:
  Sales        -> lead, Survey Sales, SPH, SPK
  Surveyor     -> Final Survey + mengunci
  Operasional  -> membuat PO + menerbitkan

Pemakaian:
    python3 scripts/gen-demo-alur.py --lokal --siapkan-sesi
    python3 scripts/gen-demo-alur.py --lokal
    python3 scripts/gen-demo-alur.py                     # PRODUKSI
    python3 scripts/gen-demo-alur.py --bersih            # hapus semua data demo

Semua baris memakai awalan 'demo-alur-' → bisa dihapus sekali perintah.
"""
import argparse
import json
import os
import sqlite3
import ssl
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

DB = "sph-management-db"
REPO = "/home/ubuntu/SPH-Management-System-Belift"

# ── Id semua baris demo (awalan 'demo-alur-') ───────────────
ID_LEAD = "demo-alur-lead-1"
ID_SURVEY_SALES = "demo-alur-survey-sales"
ID_SURVEY_FINAL = "demo-alur-survey-final"
ID_PO = "demo-alur-po"
ID_SPH = "demo-alur-sph"
ID_SPH_SPK = "demo-alur-sph-spk"

KODE_LEAD = "DEMO-ALUR-001"
# Kode proyek TIDAK ditentukan di sini — server yang membuatnya otomatis
# (BLF-<tahun>-<urut>) saat survey pertama disimpan. Nilainya disimpan ke
# variabel global supaya SPH/SPK memakai kode yang sama.

# ── Tiga akun demo + sesinya ────────────────────────────────
# peran diambil dari crm_ref_sales yang dicocokkan lewat email.
# Email-nya SENGAJA disamakan dengan baris crm_ref_sales yang sudah ada, supaya
# server mengenali perannya (Sales / Surveyor / Operasional) tanpa perlu
# menambah data referensi apa pun. Akun ini SEMENTARA — dihapus lagi oleh
# --bersihkan-sesi setelah data jadi.
AKUN = [
    {"id": "demo-alur-akun-sales", "profil": "demo-alur-profil-sales",
     "sid": "demo-alur-sesi-sales", "nama": "Firman",
     "email": "firman@belift.co.id", "peran": "Sales"},
    {"id": "demo-alur-akun-surveyor", "profil": "demo-alur-profil-surveyor",
     "sid": "demo-alur-sesi-surveyor", "nama": "Rohim",
     "email": "rohim@belift.co.id", "peran": "Surveyor"},
    {"id": "demo-alur-akun-ops", "profil": "demo-alur-profil-ops",
     "sid": "demo-alur-sesi-ops", "nama": "Sholahuddin Asy Syamil",
     "email": "pabrik@belift.co.id", "peran": "Operasional"},
]
# Diisi dari server saat survey pertama dibuat (lihat catatKodeProyek).
KODE_PROYEK = None

SID_SALES = AKUN[0]["sid"]
SID_SURVEYOR = AKUN[1]["sid"]
# Sesi untuk peran Operasional (menerbitkan PO). Diisi --sesi-ops kalau
# tidak ingin membuat akun sementara di database klien.
SID_OPS = AKUN[2]["sid"]

# ── Cerita sampel ───────────────────────────────────────────
CUSTOMER = "Bpk. Andri Wijaya"
PERUSAHAAN = "PT Cakrawala Properti Nusantara"
HP = "0812-3344-5567"
KOTA = "Denpasar"
NAMA_PROYEK = "Hotel Cakrawala Denpasar — 1 Unit Guest Lift"
SALES = "Firman"
SURVEYOR = "Rohim"
OPS = "Sholahuddin Asy Syamil"
KANAL = "ORG-GBP"
NILAI_SPH = 385_000_000
NO_SPH = "479/SPH/LIFT/BAI/X/2026"
NO_SPK = "479/SPK/LIFT/BAI/X/2026"

# Perjalanan status lead — urut sesuai crm_ref_status (kolom urutan)
LANGKAH_LEAD = [
    (10, "Lead Baru", "Lead masuk dari Google Business Profile", "2026-10-10T02:30:00.000Z"),
    (20, "Kontak Pertama Dilakukan", "Dihubungi 22 menit setelah lead masuk", "2026-10-10T02:52:00.000Z"),
    (30, "Survey Dijadwalkan", "Survey lokasi dijadwalkan 12 Okt 2026, 10.00 WITA", "2026-10-11T03:10:00.000Z"),
    (40, "Survey Selesai", "Survey lokasi selesai — shaft 1900x2100 mm tersedia", "2026-10-12T08:00:00.000Z"),
    (50, "Hitung Harga 3 Lingkup", "Estimasi 3 lingkup: pengadaan, instalasi, sipil", "2026-10-13T04:30:00.000Z"),
    (60, "SPH Terkirim", f"SPH terkirim ke {CUSTOMER} — Rp 385.000.000", "2026-10-15T09:20:00.000Z"),
    (70, "Negosiasi", "Customer minta penyesuaian skema pembayaran", "2026-10-16T05:00:00.000Z"),
    (80, "Menunggu Approval Diskon", "Diskon 4% diajukan — menunggu Direktur Operasional", "2026-10-17T03:40:00.000Z"),
    (90, "Deal - Menunggu Dokumen", "Disetujui COO — menunggu kelengkapan dokumen", "2026-10-18T07:15:00.000Z"),
    (100, "SPK Disusun", "SPK disusun dari SPH Final", "2026-10-19T04:00:00.000Z"),
    (110, "SPK Bernomor & Terkirim", f"SPK terkirim — {NO_SPK}", "2026-10-20T06:30:00.000Z"),
    (120, "SPK Ditandatangani + DP", "SPK ditandatangani, DP 40% diterima", "2026-10-21T09:45:00.000Z"),
]

DOKUMENTASI = [
    {"no": 1, "judul": "Tampak depan shaft", "ada": True, "foto": []},
    {"no": 2, "judul": "Ukuran pit & overhead", "ada": True, "foto": []},
    {"no": 3, "judul": "Panel listrik & grounding", "ada": True, "foto": []},
    {"no": 4, "judul": "Akses jalur material", "ada": True, "foto": []},
    {"no": 5, "judul": "Ruang mesin / area MRL", "ada": False, "foto": []},
]

PEKERJAAN_TAMBAHAN = [
    {"nama": "Pembuatan dinding shaft beton", "on": True, "ket": "6 lantai, sisi timur & utara"},
    {"nama": "Pengecatan ruang mesin", "on": False, "ket": ""},
    {"nama": "Penambahan penerangan shaft", "on": True, "ket": "2 titik LED"},
]

KESIMPULAN = [
    {"q": "Shaft siap untuk pemasangan lift?", "jawab": "Ya", "alasan": "1900x2100 mm memenuhi passenger lift 800 kg"},
    {"q": "Daya listrik tersedia mencukupi?", "jawab": "Ya", "alasan": "Tersedia 5,5 kW di panel lantai dasar"},
    {"q": "Akses material memungkinkan?", "jawab": "Ya", "alasan": "Lewat lobby samping, kerja malam 22.00-05.00"},
    {"q": "Pit & overhead sesuai standar?", "jawab": "Ya", "alasan": "Pit 1400 mm, overhead 4500 mm"},
    {"q": "Ada pekerjaan sipil tambahan?", "jawab": "Ya", "alasan": "Dinding shaft beton & penerangan shaft"},
    {"q": "Kondisi lokasi siap dipasang?", "jawab": "Ya", "alasan": "Lokasi bersih, tidak berpenghuni saat kerja malam"},
]

TTD_SALES = {"sales": SALES, "customer": CUSTOMER, "surveyor": ""}
TTD_FINAL = {"sales": SALES, "customer": CUSTOMER, "surveyor": SURVEYOR}

LANGKAI = [
    {"no": 1, "lantai": "Lantai 1 — Lobby", "tinggi": "4500", "door": "2100", "finishing": "Stainless HL"},
    {"no": 2, "lantai": "Lantai 2 — Kamar", "tinggi": "3200", "door": "2100", "finishing": "Stainless HL"},
    {"no": 3, "lantai": "Lantai 3 — Kamar", "tinggi": "3200", "door": "2100", "finishing": "Stainless HL"},
    {"no": 4, "lantai": "Lantai 4 — Kamar", "tinggi": "3200", "door": "2100", "finishing": "Stainless HL"},
    {"no": 5, "lantai": "Lantai 5 — Kamar", "tinggi": "3200", "door": "2100", "finishing": "Stainless HL"},
    {"no": 6, "lantai": "Lantai 6 — Roof Kitchen", "tinggi": "3200", "door": "2100", "finishing": "Stainless HL"},
]

ADDON = [
    {"kode": "HR-Std", "nama": "Handrail Standar", "idn": "Handrail standar", "on": True, "ada": False, "fotoLink": ""},
    {"kode": "TB-CF10", "nama": "Tile / Granite Cabin Floor", "idn": "Lantai granit", "on": True, "ada": False, "fotoLink": ""},
    {"kode": "ArdStd", "nama": "ARD Standar", "idn": "ARD", "on": True, "ada": True, "fotoLink": ""},
]

# ── Data Teknis: Survey Sales ───────────────────────────────
DT_SALES = {
    "jenisLift": "Passenger Lift", "model": "BLF-P800", "kapasitas": "800",
    "penumpang": "10", "kecepatan": "1.0 m/s", "sfd": "6 / 6 / 6",
    "tipeMesin": "MRL Gearless", "drive": "VVVF",
    "shaftSize": "1900 × 2100", "pitDepth": "1400", "overhead": "4500",
    "travelling": "18000", "bahanShaft": "Beton Bertulang", "tebalDinding": "200",
    "posisiHoistway": "Di dalam bangunan",
    "doorWidth": "800", "doorHeight": "2100", "tipePintu": "Center Opening",
    "cabinSize": "1100 × 1400", "cabinHeight": "2300",
    "bahanCabin": "Stainless Steel HL", "lantaiCabin": "Granit Beige",
    "plafonCabin": "LED Panel", "fasilitasCabin": "Cermin, Handrail, Ventilasi",
    "dayaListrik": "5.5 kW", "tegangan": "380 V / 3 Phase", "panelKontrol": "Ada",
    "grounding": "Ada", "safetyGear": "Ada", "ard": "Ada",
    "pintuPanggil": "Ada", "interkom": "Ada", "cctv": "Belum ada",
    "lantai": LANGKAI, "addon": ADDON,
}

# ── Data Teknis: Final Survey (hasil ukur ulang — 4 field berubah) ──
DT_FINAL = dict(DT_SALES)
DT_FINAL.update({
    "shaftSize": "1950 × 2150",
    "doorWidth": "900",
    "lantaiCabin": "Granit Hitam",
    "dayaListrik": "6.5 kW",
    "travelling": "18500",
})


# ════════════════════════════════════════════════════════════
#  Alat bantu
# ════════════════════════════════════════════════════════════
# Id database di wrangler.jsonc — dipakai untuk menebak nama berkas SQLite
# yang dibuat Miniflare, supaya SQL tulis-baca diarahkan ke database yang SAMA
# dengan yang dipakai `wrangler pages dev`.
DB_ID = "26004faf-d0f8-45de-bafb-14ccd5f7cf61"


def berkas_d1_lokal(persist):
    """Cari berkas .sqlite milik database ini di dalam dir persist Miniflare."""
    pangkal = os.path.join(persist, "v3", "d1", "miniflare-D1DatabaseObject")
    if not os.path.isdir(pangkal):
        return None
    tepat = os.path.join(pangkal, DB_ID + ".sqlite")

    def ada_tabel(f):
        try:
            c = sqlite3.connect(f"file:{f}?mode=ro", uri=True)
            n = c.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
            c.close()
            return n
        except Exception:
            return 0

    if os.path.exists(tepat) and ada_tabel(tepat):
        return tepat
    kandidat = [
        os.path.join(pangkal, f) for f in os.listdir(pangkal)
        if f.endswith(".sqlite") and f != "metadata.sqlite"
    ]
    kandidat.sort(key=ada_tabel, reverse=True)
    return kandidat[0] if kandidat and ada_tabel(kandidat[0]) else None


def jalankan_sql(sql, lokal, persist=None):
    if lokal and persist:
        # Tulis / baca langsung ke berkas SQLite milik `pages dev`.
        # `wrangler d1 execute --local` ternyata membuat/memakai berkas BERBEDA
        # dari yang dipakai `pages dev`, jadi hasil tulisnya tidak terlihat
        # oleh server. Menembak berkasnya langsung menghilangkan masalah itu.
        berkas = berkas_d1_lokal(persist)
        if not berkas:
            print("  ! berkas D1 lokal tidak ketemu di", persist)
            return []
        c = sqlite3.connect(berkas, timeout=30)
        hasil_akhir = []
        try:
            for bagian in [s.strip() for s in sql.split(";") if s.strip()]:
                try:
                    cur = c.execute(bagian)
                    if cur.description:
                        kolom = [d[0] for d in cur.description]
                        hasil_akhir = [dict(zip(kolom, r)) for r in cur.fetchall()]
                except Exception as e:
                    print("  ! SQL gagal:", str(e)[:200], "|", bagian[:80])
            c.commit()
        finally:
            c.close()
        return hasil_akhir

    perintah = ["npx", "wrangler", "d1", "execute", DB, "--json", "--command", sql, "--remote"]
    hasil = subprocess.run(perintah, capture_output=True, text=True, cwd=REPO)
    gabung = hasil.stdout + hasil.stderr
    if "ERROR" in gabung or hasil.returncode != 0:
        print("  ! SQL gagal:", gabung[-500:])
    try:
        return json.loads(hasil.stdout)[0]["results"]
    except Exception:
        return []


def q(v):
    if v is None:
        return "NULL"
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


class Api:
    def __init__(self, basis, sid):
        self.basis = basis.rstrip("/")
        self.sid = sid
        self.ctx = ssl.create_default_context()
        self.ctx.check_hostname = False
        self.ctx.verify_mode = ssl.CERT_NONE

    def panggil(self, jalur, metode="GET", isi=None):
        data = json.dumps(isi).encode() if isi is not None else None
        req = urllib.request.Request(self.basis + jalur, data=data, method=metode)
        req.add_header("Cookie", f"sph_session={self.sid}")
        # WAJIB: Cloudflare menolak User-Agent bawaan Python (error 1010
        # "browser integrity check"). Dengan UA browser, permintaan lolos.
        req.add_header("User-Agent",
                       "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
        req.add_header("Accept", "application/json, text/plain, */*")
        req.add_header("Referer", self.basis + "/")
        if data:
            req.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(req, context=self.ctx, timeout=90) as r:
                return r.status, json.loads(r.read().decode() or "{}")
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read().decode() or "{}")
            except Exception:
                return e.code, {}
        except Exception as e:
            return 0, {"error": str(e)}


def simpan(api, jalur_dasar, id_lokal, isi):
    """PUT kalau baris sudah ada, POST kalau belum.

    PENTING: pada POST, server SELALU membuat id-nya sendiri (UUID) dan
    mengembalikannya di `id` — id kiriman kita diabaikan. Jadi id yang
    dipakai langkah berikutnya harus diambil dari balikan server, bukan
    dari id_lokal. Mengembalikan (status, id_baris_sebenarnya, balikan).
    """
    st, bal = api.panggil(f"{jalur_dasar}&id={id_lokal}", "PUT", isi)
    if st == 404:
        st, bal = api.panggil(jalur_dasar, "POST", isi)
        if st < 400 and isinstance(bal, dict) and bal.get("id"):
            return st, bal["id"], bal
    return st, id_lokal, bal


def simpan_sph(api, id_sph, mode, nilai, items, tgl):
    """Dokumen SPH/SPK lewat /api/data — jalur resmi halaman SPHForm."""
    docstate = {
        "mode": mode, "status": "final", "tanggal": tgl, "noUrut": 479,
        "namaPerusahaan": PERUSAHAAN, "namaCustomer": CUSTOMER, "kotaProyek": KOTA,
        "jenisLift": "Passenger Lift", "tipeKabin": "Panoramic", "kapasitas": "800 Kg",
        "items": items, "modeHarga": "satuan", "ppn": "include",
        "pilihDesain": {"kabin": "Panoramic", "pintu": "Center Opening"},
        "termin": {"dp": 40, "pabrikasi": 40, "instalasi": 15, "retensi": 5},
    }
    baris = {
        "id": id_sph, "nomor_sph": NO_SPH if mode == "SPH" else NO_SPK,
        "tanggal": tgl, "kepada": PERUSAHAAN, "nama_pic": CUSTOMER,
        "alamat_proyek": KOTA, "perihal": f"Generator {mode} — Panoramic",
        "jenis_lift": "Passenger Lift", "kapasitas": "800 Kg", "floors": "6",
        "stops": "6", "doors": "6", "waktu_pelaksanaan": "90 hari kalender",
        "status": "final", "include_ppn": 1, "price_mode": "satuan",
        "lump_sum_total": str(nilai), "nama_sales": SALES,
        "id_lead": ID_LEAD, "kode_proyek": KODE_PROYEK,
        "specs": [{"key": "__docstate", "label": "docstate", "value": json.dumps(docstate)}],
        "items": items,
        "payments": [], "terms": docstate["termin"], "designs": docstate["pilihDesain"],
    }
    st, id_asli, bal = simpan(api, "/api/data?table=sph", id_sph, baris)
    return st, id_asli, bal


def catat_kode_proyek(lokal, persist):
    """Ambil kode proyek yang dibuat server, simpan ke variabel global."""
    global KODE_PROYEK
    r = jalankan_sql(
        "SELECT kode_proyek FROM proyek WHERE id_lead='%s'" % ID_LEAD, lokal, persist)
    if r:
        KODE_PROYEK = r[0]["kode_proyek"]
    return KODE_PROYEK


def siapkan_sesi(lokal, persist=None):
    """Buat 3 akun demo + sesi login-nya."""
    print("Menyiapkan 3 akun + sesi demo…")
    now = datetime.now(timezone.utc)
    t = now.strftime("%Y-%m-%dT%H:%M:%S.000Z")
    exp = (now + timedelta(days=3)).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    potongan = []
    for a in AKUN:
        potongan += [
            f"DELETE FROM app_sessions WHERE id={q(a['sid'])}",
            f"DELETE FROM profiles WHERE user_id={q(a['id'])}",
            f"DELETE FROM app_users WHERE id={q(a['id'])}",
            f"""INSERT INTO app_users (id,email,password_hash,full_name,role,status,created_at,updated_at)
                VALUES ({q(a['id'])},{q(a['email'])},'sesi-uji-demo',{q(a['nama'])},'staff','approved',{q(t)},{q(t)})""",
            f"""INSERT INTO profiles (id,user_id,full_name,email,created_at,updated_at)
                VALUES ({q(a['profil'])},{q(a['id'])},{q(a['nama'])},{q(a['email'])},{q(t)},{q(t)})""",
            f"""INSERT INTO app_sessions (id,user_id,expires_at,created_at)
                VALUES ({q(a['sid'])},{q(a['id'])},{q(exp)},{q(t)})""",
        ]
    jalankan_sql(";".join(potongan), lokal, persist)
    for a in AKUN:
        print(f"   {a['peran']:<12} {a['nama']:<24} sid={a['sid']}")


def bersihkan_sesi(lokal, persist=None):
    """Hapus HANYA akun + sesi sementara. Data demo (lead/survey/PO) tetap."""
    print("Menghapus akun sementara (data demo dibiarkan)…")
    potongan = []
    for a in AKUN:
        potongan += [
            f"DELETE FROM app_sessions WHERE id={q(a['sid'])}",
            f"DELETE FROM profiles WHERE user_id={q(a['id'])}",
            f"DELETE FROM app_users WHERE id={q(a['id'])}",
        ]
    jalankan_sql(";".join(potongan), lokal, persist)
    sisa = jalankan_sql(
        "SELECT COUNT(*) AS n FROM app_users WHERE id LIKE 'demo-alur-%'", lokal, persist)
    print(f"Akun sementara tersisa: {sisa[0]['n'] if sisa else '?'}")


def bersihkan(lokal, persist=None):
    print("Menghapus seluruh data demo (awalan demo-alur-)…")
    # PENTING: id baris survey & PO dibuat SERVER (UUID acak), jadi tidak bisa
    # dicocokkan dengan 'demo-alur-%'. Penghapusan harus lewat keterkaitan ke
    # lead-nya. Kalau tidak, riwayat & revisi akan tertinggal sebagai sampah.
    potongan = [
        f"DELETE FROM survey_riwayat WHERE id_ref IN "
        f"(SELECT id FROM survey_teknis WHERE id_lead='{ID_LEAD}')",
        f"DELETE FROM po_revisi WHERE id_po IN "
        f"(SELECT id FROM po_pabrik WHERE id_lead='{ID_LEAD}')",
        f"DELETE FROM survey_riwayat WHERE id_ref IN "
        f"(SELECT id FROM po_pabrik WHERE id_lead='{ID_LEAD}')",
        f"DELETE FROM po_pabrik     WHERE id_lead='{ID_LEAD}'",
        f"DELETE FROM survey_teknis WHERE id_lead='{ID_LEAD}'",
        f"DELETE FROM crm_lead_riwayat WHERE id_lead='{ID_LEAD}'",
        f"DELETE FROM crm_dokumen   WHERE id_lead='{ID_LEAD}'",
        f"DELETE FROM proyek        WHERE id_lead='{ID_LEAD}'",
        f"DELETE FROM sph           WHERE id_lead='{ID_LEAD}'",
        f"DELETE FROM crm_leads     WHERE id='{ID_LEAD}'",
    ]
    for a in AKUN:
        potongan += [
            f"DELETE FROM app_sessions WHERE id={q(a['sid'])}",
            f"DELETE FROM profiles WHERE user_id={q(a['id'])}",
            f"DELETE FROM app_users WHERE id={q(a['id'])}",
        ]
    jalankan_sql(";".join(potongan), lokal, persist)
    print("Bersih.")


# ════════════════════════════════════════════════════════════
def main():
    p = argparse.ArgumentParser()
    p.add_argument("--lokal", action="store_true", help="pakai D1 lokal, bukan produksi")
    p.add_argument("--bersih", action="store_true", help="hapus data demo lalu keluar")
    p.add_argument("--siapkan-sesi", action="store_true", help="hanya buat akun + sesi demo")
    p.add_argument("--bersihkan-sesi", action="store_true",
                   help="hapus akun sementara, data demo dibiarkan")
    p.add_argument("--basis", default=None, help="basis URL API")
    p.add_argument("--persist", default=None, help="dir state D1 lokal (--persist-to)")
    p.add_argument("--lewati-sph", action="store_true", help="jangan tulis SPH/SPK")
    args = p.parse_args()
    lokal = args.lokal
    basis = args.basis or ("http://127.0.0.1:8788" if lokal else "https://sph.belift.co.id")

    if args.bersih:
        bersihkan(lokal, args.persist)
        return
    if args.siapkan_sesi:
        siapkan_sesi(lokal, args.persist)
        return
    if args.bersihkan_sesi:
        bersihkan_sesi(lokal, args.persist)
        return

    api_sales = Api(basis, SID_SALES)
    api_surveyor = Api(basis, SID_SURVEYOR)
    api_ops = Api(basis, SID_OPS)

    st, _ = api_sales.panggil("/api/crm?resource=meta")
    if st != 200:
        print(f"GAGAL: sesi demo belum berlaku di {basis} (HTTP {st}).")
        print("Jalankan dulu:  python3 scripts/gen-demo-alur.py --siapkan-sesi "
              f"{'--lokal --persist ' + args.persist if lokal and args.persist else ''}")
        sys.exit(1)
    print(f"Server OK: {basis}")
    print(f"Peran  : Sales={SALES} | Surveyor={SURVEYOR} | Operasional={OPS}\n")

    # ── 1. Lead ─────────────────────────────────────────────
    print("1/6  Lead…")
    jalankan_sql(f"""
      DELETE FROM crm_lead_riwayat WHERE id_lead='{ID_LEAD}';
      DELETE FROM survey_riwayat   WHERE id_ref  LIKE 'demo-alur-%';
      DELETE FROM po_revisi        WHERE id_po   LIKE 'demo-alur-%';
      DELETE FROM po_pabrik        WHERE id      LIKE 'demo-alur-%';
      DELETE FROM survey_teknis    WHERE id      LIKE 'demo-alur-%';
      DELETE FROM crm_dokumen      WHERE id_lead='{ID_LEAD}';
      DELETE FROM proyek           WHERE id_lead='{ID_LEAD}';
      DELETE FROM sph              WHERE id      LIKE 'demo-alur-%';
      DELETE FROM crm_leads        WHERE id='{ID_LEAD}';
      INSERT INTO crm_leads
        (id,kode_lead,waktu_masuk,kode_kanal,nama_prospek,no_hp,kota,kebutuhan,sales,
         metode_assign,butuh_jelas,lokasi_siap,budget_masuk,rencana_6bulan,bicara_decider,
         waktu_kontak_pertama,status_terakhir,skor,kualifikasi,respons_jam,
         kode_proyek,nilai_sph,no_sph,tgl_sph,diubah_oleh,created_at,updated_at)
      VALUES
        ('{ID_LEAD}','{KODE_LEAD}','2026-10-10T02:30:00.000Z','{KANAL}','{PERUSAHAAN}',
         '{HP}','{KOTA}','Guest lift 800 kg untuk hotel 6 lantai','{SALES}',
         'Round Robin','Ya','Ya','Ya','Ya','Ya','2026-10-10T02:52:00.000Z',
         'SPK Ditandatangani + DP',100,'HOT',0.37,
         NULL,{NILAI_SPH},'{NO_SPH}','2026-10-15','Demo (sementara)',
         '2026-10-10T02:30:00.000Z','2026-10-21T09:45:00.000Z')
    """, lokal, args.persist)

    # ── 2. Riwayat perjalanan lead ──────────────────────────
    print("2/6  Riwayat lead (12 langkah)…")
    potongan, sebelumnya = [], None
    for urut, status, catatan, ts in LANGKAH_LEAD:
        potongan.append(
            f"INSERT INTO crm_lead_riwayat (id,id_lead,waktu,dari_status,ke_status,oleh,catatan) "
            f"VALUES ('demo-alur-riwayat-{urut}','{ID_LEAD}','{ts}',{q(sebelumnya)},{q(status)},"
            f"{q(SALES)},{q(catatan)})"
        )
        sebelumnya = status
    jalankan_sql(";".join(potongan), lokal, args.persist)

    # ── 3. Survey Sales (oleh Sales) — server membuat kode proyek ──
    # Survey HARUS lebih dulu daripada SPH: di sinilah server membuat baris
    # `proyek` beserta kode BLF-<tahun>-<urut> yang dipakai SPH/SPK/PO.
    print("3/7  Survey Sales (oleh Sales)…")
    st, id_sales, bal = simpan(api_sales, "/api/survey?resource=survey", ID_SURVEY_SALES, {
        "id": ID_SURVEY_SALES, "id_lead": ID_LEAD, "jenis": "sales",
        "tgl_survey": "2026-10-12", "disurvey_oleh": SALES,
        "pj_lapangan": CUSTOMER, "pj_telp": HP, "jam_kerja": "10.00 – 14.00 WITA",
        "dt": DT_SALES, "dokumentasi": DOKUMENTASI,
        "pekerjaan_tambahan": PEKERJAAN_TAMBAHAN,
        "catatan_lapangan": "Akses material lewat lobby samping — kerja malam 22.00-05.00",
        "kesimpulan": KESIMPULAN, "ttd": TTD_SALES,
    })
    print(f"     -> HTTP {st} {bal if st >= 400 else ''}")
    kode = catat_kode_proyek(lokal, args.persist)
    print(f"     kode proyek dari server: {kode}")
    if kode:
        jalankan_sql(
            f"UPDATE crm_leads SET kode_proyek={q(kode)} WHERE id='{ID_LEAD}'",
            lokal, args.persist)

    # ── 4. SPH + SPK (oleh Sales) ───────────────────────────
    items = [
        {"nama": "Lift Passenger 800 kg — 6 lantai / 6 stop", "qty": 1, "satuan": "unit", "harga": 285_000_000},
        {"nama": "Instalasi & commissioning", "qty": 1, "satuan": "unit", "harga": 62_000_000},
        {"nama": "Pekerjaan sipil (dinding shaft, penerangan)", "qty": 1, "satuan": "unit", "harga": 38_000_000},
    ]
    if not args.lewati_sph:
        print("4/7  SPH Final…")
        st, _, _ = simpan_sph(api_sales, ID_SPH, "SPH", NILAI_SPH, items, "2026-10-15")
        print(f"     SPH -> HTTP {st}")
        print("4b   SPK Bernomor (dari SPH Final)…")
        st, _, _ = simpan_sph(api_sales, ID_SPH_SPK, "SPK", NILAI_SPH, items, "2026-10-19")
        print(f"     SPK -> HTTP {st}")

    # ── 5. Final Survey (oleh Surveyor) + dikunci ───────────
    print("5/7  Final Survey (oleh Surveyor)…")
    st, id_final, bal = simpan(api_surveyor, "/api/survey?resource=survey", ID_SURVEY_FINAL, {
        "id": ID_SURVEY_FINAL, "id_lead": ID_LEAD, "jenis": "final",
        "kode_proyek": KODE_PROYEK,
        "tgl_survey": "2026-10-21", "surveyor": SURVEYOR,
        "pj_lapangan": CUSTOMER, "pj_telp": HP, "jam_kerja": "09.00 – 15.00 WITA",
        "dt": DT_FINAL, "dokumentasi": DOKUMENTASI,
        "pekerjaan_tambahan": PEKERJAAN_TAMBAHAN,
        "catatan_lapangan": "Shaft sudah dicor. Ukuran final 1950x2150 mm — sipil menyesuaikan. "
                            "Pintu dilebarkan ke 900 mm atas permintaan pihak hotel.",
        "catatan_desain": "Kabin panoramic, pintu center opening 900 mm, finishing stainless HL.",
        "kesimpulan": KESIMPULAN, "ttd": TTD_FINAL,
    })
    print(f"     -> HTTP {st} {bal if st >= 400 else ''}")

    print("5b   Mengunci Final Survey…")
    st, bal = api_surveyor.panggil(f"/api/survey?resource=kunci&id={id_final}", "POST",
                                   {"alasan": "Data teknis final sudah dicocokkan dengan kondisi lapangan"})
    print(f"     -> HTTP {st} {bal if st >= 400 else ''}")

    # ── 6. PO Pabrik (oleh Operasional) + diterbitkan ───────
    print("6/7  PO Pabrik (oleh Operasional)…")
    st, id_po, bal = simpan(api_ops, "/api/po?resource=po", ID_PO, {
        "id": ID_PO, "id_lead": ID_LEAD, "kode_proyek": KODE_PROYEK,
        "tgl_po": "2026-10-22", "pabrik": "Pabrik Belift — Sidoarjo",
        "pic": OPS, "catatan": "Dikerjakan sesuai Final Survey terkunci",
    })
    print(f"     -> HTTP {st} {bal if st >= 400 else ''}")

    print("6b   Menerbitkan PO (revisi 1)…")
    st, bal = api_ops.panggil(f"/api/po?resource=terbit&id={id_po}", "POST", {"alasan": None})
    print(f"     -> HTTP {st} {bal if st >= 400 else ''}")

    # ── 7. Satu revisi PO (data lapangan berubah setelah PO) ─
    print("7/7  Revisi PO (ukuran shaft berubah setelah dicek ulang)…")
    st, _ = api_surveyor.panggil(f"/api/survey?resource=kunci&aksi=buka&id={id_final}", "POST",
                                {"alasan": "Ukuran shaft berubah setelah pengecekan ulang kontraktor sipil"})
    print(f"     buka kunci -> HTTP {st}")
    DT_FINAL["shaftSize"] = "2000 × 2200"
    DT_FINAL["pitDepth"] = "1500"
    st, id_final, _ = simpan(api_surveyor, "/api/survey?resource=survey", id_final, {
        "id": ID_SURVEY_FINAL, "id_lead": ID_LEAD, "jenis": "final",
        "kode_proyek": KODE_PROYEK, "tgl_survey": "2026-10-21", "surveyor": SURVEYOR,
        "pj_lapangan": CUSTOMER, "pj_telp": HP, "jam_kerja": "09.00 – 15.00 WITA",
        "dt": DT_FINAL, "dokumentasi": DOKUMENTASI,
        "pekerjaan_tambahan": PEKERJAAN_TAMBAHAN,
        "catatan_lapangan": "Pengecekan ulang: shaft jadi 2000x2200 mm, pit 1500 mm.",
        "catatan_desain": "Kabin panoramic, pintu center opening 900 mm, finishing stainless HL.",
        "kesimpulan": KESIMPULAN, "ttd": TTD_FINAL,
    })
    print(f"     simpan ulang -> HTTP {st}")
    st, _ = api_surveyor.panggil(f"/api/survey?resource=kunci&id={id_final}", "POST",
                                 {"alasan": "Data final setelah pengecekan ulang kontraktor sipil"})
    print(f"     kunci lagi -> HTTP {st}")
    st, bal = api_ops.panggil(f"/api/po?resource=revisi&id={id_po}", "POST",
                              {"alasan": "Ukuran shaft & pit berubah setelah pengecekan ulang sipil"})
    print(f"     terbitkan revisi 2 -> HTTP {st} {bal if st >= 400 else ''}")

    print()
    verifikasi(lokal, args.persist)


def verifikasi(lokal, persist=None):
    print("=" * 64)
    print("VERIFIKASI — dibaca dari database, bukan dari niat skrip")
    print("=" * 64)
    hitung = [
        ("Lead", "crm_leads", f"id='{ID_LEAD}'"),
        ("Riwayat lead", "crm_lead_riwayat", f"id_lead='{ID_LEAD}'"),
        ("Proyek", "proyek", f"id_lead='{ID_LEAD}'"),
        ("SPH + SPK", "sph", f"id_lead='{ID_LEAD}'"),
        ("Survey (sales+final)", "survey_teknis", f"id_lead='{ID_LEAD}'"),
        ("Riwayat survey/PO", "survey_riwayat",
         f"id_ref IN (SELECT id FROM survey_teknis WHERE id_lead='{ID_LEAD}') "
         f"OR id_ref IN (SELECT id FROM po_pabrik WHERE id_lead='{ID_LEAD}')"),
        ("PO Pabrik", "po_pabrik", f"id_lead='{ID_LEAD}'"),
        ("Revisi PO", "po_revisi",
         f"id_po IN (SELECT id FROM po_pabrik WHERE id_lead='{ID_LEAD}')"),
    ]
    for nama, tabel, syarat in hitung:
        r = jalankan_sql(f"SELECT COUNT(*) AS n FROM {tabel} WHERE {syarat}", lokal, persist)
        print(f"  {nama:<22} {(r[0]['n'] if r else '?')}")

    print("\n  Rantai tahap (lead -> PO):")
    rantai = jalankan_sql(f"""
      SELECT l.kode_lead, l.status_terakhir, l.skor, l.kualifikasi,
             p.kode_proyek, p.tahap_sekarang,
             ss.no_survey AS no_survey_sales, fs.no_survey AS no_survey_final,
             fs.terkunci, fs.dikunci_oleh,
             po.no_po, po.rev_terakhir, po.status AS status_po
      FROM crm_leads l
      LEFT JOIN proyek p ON p.id_lead=l.id
      LEFT JOIN survey_teknis ss ON ss.id_lead=l.id AND ss.jenis='sales'
      LEFT JOIN survey_teknis fs ON fs.id_lead=l.id AND fs.jenis='final'
      LEFT JOIN po_pabrik po ON po.id_lead=l.id
      WHERE l.id='{ID_LEAD}'
    """, lokal, persist)
    for r in rantai:
        for k, v in r.items():
            print(f"    {k:<18} {v}")

    print("\n  Jejak riwayat survey & PO (siapa mengerjakan apa):")
    jejak = jalankan_sql(f"""
      SELECT jenis, aksi, oleh, alasan FROM survey_riwayat
      WHERE id_ref IN (SELECT id FROM survey_teknis WHERE id_lead='{ID_LEAD}')
         OR id_ref IN (SELECT id FROM po_pabrik WHERE id_lead='{ID_LEAD}')
      ORDER BY datetime(waktu)
    """, lokal, persist)
    for r in jejak:
        print(f"    [{r['jenis']:<6}] {r['aksi']:<12} oleh {r['oleh']:<24} {r['alasan'] or ''}")

    print("\n  Revisi PO (yang muncul di halaman Lacak):")
    beda = jalankan_sql(f"""
      SELECT rev, jml_perubahan, perubahan_setelah_final, alasan
      FROM po_revisi WHERE id_po IN (SELECT id FROM po_pabrik WHERE id_lead='{ID_LEAD}')
      ORDER BY rev
    """, lokal, persist)
    for r in beda:
        print(f"    rev {r['rev']} | {r['jml_perubahan']} perubahan | "
              f"setelah final: {r['perubahan_setelah_final']} | {r['alasan'] or '—'}")


if __name__ == "__main__":
    main()
