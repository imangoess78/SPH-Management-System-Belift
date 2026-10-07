#!/usr/bin/env bash
# Uji API notifikasi produksi SEBAGAI PENGGUNA SUNGGUHAN.
#
# Uji "tanpa sesi -> 401" hanya membuktikan gerbangnya ada. Yang menentukan
# apakah fitur ini layak dipakai adalah apakah seorang pengguna benar-benar
# menerima daftarnya, dan apakah ia HANYA melihat miliknya.
#
# JEBAKAN WAKTU: jangan memakai `datetime('now')` untuk memeriksa sesi.
# SQLite menghasilkan '2026-10-07 09:24:27' (spasi), sedangkan `expires_at`
# disimpan sebagai ISO '2026-10-07T07:29:51.640Z' (huruf T). Sebagai teks,
# 'T' > ' ', jadi sesi yang SUDAH kedaluwarsa tetap terlihat aktif dan
# skrip akan melaporkan 401 sebagai kegagalan padahal server benar.
# Pakai strftime('%Y-%m-%dT%H:%M:%fZ','now') supaya sebanding.
#
# Pemakaian: bash scripts/uji-notifikasi-api.sh
set -u
BASE="https://sph-management-clone.pages.dev"
cd /home/ubuntu/SPH-Management-System-Belift
lulus=0; gagal=0
lapor() { if [ "$2" = "$3" ]; then lulus=$((lulus+1)); echo "  ✓ $1 ($2)";
          else gagal=$((gagal+1)); echo "  ✗ $1 — dapat $2, harap $3"; fi }

q() { npx wrangler d1 execute sph-management-db --remote --json --command "$1" 2>/dev/null; }

# Ambil sesi + id pengguna untuk sebuah peran. Memakai perbandingan ISO.
sesi_peran() {
  q "SELECT s.id AS sid, u.id AS uid, u.email
     FROM app_sessions s JOIN app_users u ON u.id=s.user_id
     WHERE u.role='$1' AND u.status='approved'
       AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
     ORDER BY s.expires_at DESC LIMIT 1" \
  | python3 -c "import json,sys
try:
    r=json.load(sys.stdin)[0]['results']
    print(r[0]['sid']+'|'+r[0]['uid'] if r else '|')
except Exception: print('|')"
}

ADMIN=$(sesi_peran admin)
SID="${ADMIN%%|*}"; UID_ADMIN="${ADMIN##*|}"
if [ -z "$SID" ]; then echo "Tidak ada sesi admin aktif — masuk dulu sebagai admin di $BASE."; exit 1; fi
echo "Sesi admin aktif: ${SID:0:8}…  (uid ${UID_ADMIN:0:8}…)"
KUE="sph_session=$SID"

echo
echo "── 1. GET daftar dengan sesi admin ──"
kode=$(curl -s -o /tmp/n.json -w '%{http_code}' -H "Cookie: $KUE" "$BASE/api/notifikasi")
lapor "kode" "$kode" "200"
[ "$kode" = "200" ] && python3 -c "
import json; d=json.load(open('/tmp/n.json'))
print('  kunci balasan:', ', '.join(d.keys()))
print('  jumlah baris :', len(d.get('daftar',[])))
"

echo
echo "── 2. Sesi kedaluwarsa HARUS ditolak (bukan diterima) ──"
# Ambil sesi yang sudah lewat masa berlakunya. Kalau ini diterima,
# gerbang sesinya bocor.
SID_LAMA=$(q "SELECT id FROM app_sessions
              WHERE expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')
              LIMIT 1" \
  | python3 -c "import json,sys
try:
    r=json.load(sys.stdin)[0]['results']; print(r[0]['id'] if r else '')
except Exception: print('')")
if [ -n "$SID_LAMA" ]; then
  kode=$(curl -s -o /dev/null -w '%{http_code}' -H "Cookie: sph_session=$SID_LAMA" "$BASE/api/notifikasi")
  lapor "sesi kedaluwarsa ditolak" "$kode" "401"
else
  echo "  (tidak ada sesi kedaluwarsa untuk diuji — dilewati)"
fi

echo
echo "── 3. PENYARINGAN: notifikasi milik orang lain tidak boleh terlihat ──"
# Sisipkan dua baris uji langsung ke D1: satu untuk admin ini, satu untuk
# uid yang tidak ada. Lalu pastikan yang muncul hanya milik admin.
q "INSERT OR REPLACE INTO app_notifikasi
   (id,jenis,kunci_event,judul,pesan,penerima,tautan,oleh_nama,tingkat,created_at)
   VALUES ('uji-terlihat','uji','uji-terlihat','MILIK-SAYA','x',',${UID_ADMIN},','','','info','2026-10-07T00:00:00Z')" >/dev/null 2>&1
q "INSERT OR REPLACE INTO app_notifikasi
   (id,jenis,kunci_event,judul,pesan,penerima,tautan,oleh_nama,tingkat,created_at)
   VALUES ('uji-oranglain','uji','uji-oranglain','MILIK-ORANG-LAIN','x',',uid-tidak-ada,','','','info','2026-10-07T00:00:00Z')" >/dev/null 2>&1

curl -s -H "Cookie: $KUE" "$BASE/api/notifikasi" > /tmp/n.json 2>/dev/null
python3 -c "
import json
try: d=json.load(open('/tmp/n.json'))
except Exception: d={'daftar':[]}
judul=[r.get('judul') for r in d.get('daftar',[])]
print('  judul yang terlihat:', judul if judul else '(kosong)')
punya_saya  = 'MILIK-SAYA' in judul
punya_lain  = 'MILIK-ORANG-LAIN' in judul
if punya_saya and not punya_lain:
    print('  ✓ milik sendiri terlihat, milik orang lain tersaring')
    open('/tmp/hasil_filter','w').write('lulus')
elif not punya_saya:
    print('  ✗ notifikasi milik sendiri TIDAK muncul')
    open('/tmp/hasil_filter','w').write('gagal')
else:
    print('  ✗ BOCOR: notifikasi milik orang lain ikut terlihat')
    open('/tmp/hasil_filter','w').write('gagal')
"
h=$(cat /tmp/hasil_filter 2>/dev/null || echo gagal)
lapor "penyaringan penerima" "$h" "lulus"

echo
echo "── 4. Tandai dibaca lewat POST ──"
kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Cookie: $KUE" \
  -H 'Content-Type: application/json' -d '{"id":"uji-terlihat"}' "$BASE/api/notifikasi")
lapor "POST tandai satu" "$kode" "200"

kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Cookie: $KUE" \
  -H 'Content-Type: application/json' -d '{"id":"uji-oranglain"}' "$BASE/api/notifikasi")
lapor "POST tandai milik orang lain ditolak" "$kode" "404"

kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Cookie: $KUE" \
  -H 'Content-Type: application/json' -d '{}' "$BASE/api/notifikasi")
lapor "POST tandai semua" "$kode" "200"

echo
echo "── 5. Bersihkan data uji ──"
q "DELETE FROM app_notifikasi_baca WHERE id_notif LIKE 'uji-%'" >/dev/null 2>&1
q "DELETE FROM app_notifikasi WHERE id LIKE 'uji-%'" >/dev/null 2>&1
sisa=$(q "SELECT COUNT(*) AS n FROM app_notifikasi WHERE id LIKE 'uji-%'" \
  | python3 -c "import json,sys
try: print(json.load(sys.stdin)[0]['results'][0]['n'])
except Exception: print('?')")
lapor "baris uji terhapus" "$sisa" "0"

echo
echo "════════════════════════════════"
echo "Lulus: $lulus   Gagal: $gagal"
[ "$gagal" -eq 0 ] || exit 1
