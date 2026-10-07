#!/usr/bin/env bash
# Diagnosa mengapa sesi ditolak, dan apakah ada akun yang izinnya ditulis
# eksplisit di kolom `permissions`.
#
# DUA HAL YANG DIPERIKSA:
#
# 1. Perbandingan waktu. `datetime('now')` di SQLite menghasilkan
#    '2026-10-14 17:20:00' (spasi), sedangkan `expires_at` disimpan sebagai
#    ISO '2026-10-14T07:41:13.667Z' (huruf T). Membandingkan keduanya sebagai
#    teks memberi hasil PALSU: pada posisi ke-10, 'T' > ' ', jadi sesi yang
#    sudah kedaluwarsa tetap terlihat "aktif". Pemeriksaan yang benar memakai
#    format yang sama — ISO — seperti yang dipakai produksi.
#
# 2. Izin eksplisit. `izinEfektif()` di shared/akses.ts: izin di kolom
#    `permissions` MENANG atas bawaan peran. Akun yang kolomnya sudah terisi
#    karena itu TIDAK otomatis mendapat izin `notifikasi` yang baru
#    ditambahkan ke bawaan peran. Kalau ada akun seperti itu, ia akan
#    menerima 403 saat membuka lonceng.
set -u
cd /home/ubuntu/SPH-Management-System-Belift

sql() {
  npx wrangler d1 execute sph-management-db --remote --json --command "$1" 2>/dev/null
}

echo "── 1. Waktu ──"
sql "SELECT datetime('now') AS sqlite_now, strftime('%Y-%m-%dT%H:%M:%fZ','now') AS iso_now" \
 | python3 -c "
import json,sys
r=json.load(sys.stdin)[0]['results'][0]
print('  sqlite datetime(now):', r['sqlite_now'])
print('  ISO (dipakai kode)  :', r['iso_now'])
"

echo
echo "── 2. Sesi: bandingkan cara SALAH vs cara BENAR ──"
sql "SELECT
      (SELECT COUNT(*) FROM app_sessions WHERE expires_at > datetime('now')) AS cara_salah,
      (SELECT COUNT(*) FROM app_sessions WHERE expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')) AS cara_benar" \
 | python3 -c "
import json,sys
r=json.load(sys.stdin)[0]['results'][0]
print('  aktif menurut datetime(now)  :', r['cara_salah'], '  <- inilah yang membuat skrip saya salah')
print('  aktif menurut ISO (benar)    :', r['cara_benar'])
"

echo
echo "── 3. Akun yang izinnya ditulis eksplisit di kolom permissions ──"
sql "SELECT email, role, substr(permissions,1,120) AS izin
     FROM app_users
     WHERE permissions IS NOT NULL AND trim(permissions) NOT IN ('','[]','null')
     ORDER BY role, email" \
 | python3 -c "
import json,sys
try: d=json.load(sys.stdin)[0]['results']
except Exception: d=[]
print('  jumlah akun dengan izin eksplisit:', len(d))
for r in d:
    punya = 'notifikasi' in (r.get('izin') or '')
    print(('  ✓ ' if punya else '  ✗ ') + str(r.get('email')) + ' [' + str(r.get('role')) + ']' + ('' if punya else '  <- TIDAK punya notifikasi'))
"

echo
echo "── 4. Sebaran akun per status ──"
sql "SELECT status, COUNT(*) AS n FROM app_users GROUP BY status" \
 | python3 -c "
import json,sys
for r in json.load(sys.stdin)[0]['results']: print('  ', r['status'], ':', r['n'])
"
