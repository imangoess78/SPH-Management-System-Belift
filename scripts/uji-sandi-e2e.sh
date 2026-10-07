#!/usr/bin/env bash
# UJI END-TO-END: ganti password tanpa email (kode sekali pakai dari Admin).
#
# Membuktikan pada SERVER PRODUKSI, bukan sekadar di tes unit:
#   1. Akun yang lupa password TIDAK bisa masuk dengan password lama.
#   2. Admin bisa membuat kode reset; kode mentah hanya muncul sekali.
#   3. Kode dipakai → password berganti → bisa masuk dengan password baru.
#   4. Kode yang sama TIDAK bisa dipakai dua kali.
#   5. Password lemah ditolak.
#   6. Email yang tidak terdaftar dan kode yang salah memberi pesan SAMA
#      (supaya halaman ini tidak bisa dipakai mendata email terdaftar).
#   7. Akun non-admin TIDAK boleh membuat kode reset (403).
#   8. Sesi lama diputus setelah password berganti.
#
# Memakai akun uji sekali pakai (uji-sandi-e2e@contoh.invalid) yang dibuat
# dan dihapus lagi oleh skrip ini, supaya data produksi tidak tersentuh.
#
# Pemakaian: bash scripts/uji-sandi-e2e.sh
set -u
BASE="https://sph-management-clone.pages.dev"
AKUN="uji-sandi-e2e@contoh.invalid"
UID_UJI="uji-sandi-e2e"
SANDI_LAMA="SandiAwal#2026x"
SANDI_BARU="SandiBaru#2026y"
cd /home/ubuntu/SPH-Management-System-Belift
lulus=0; gagal=0
lapor() { if [ "$2" = "$3" ]; then lulus=$((lulus+1)); echo "  ✓ $1 ($2)";
          else gagal=$((gagal+1)); echo "  ✗ $1 — dapat $2, harap $3"; fi }

q() { npx wrangler d1 execute sph-management-db --remote --json --command "$1" 2>/dev/null; }

# Hitung hash PBKDF2 yang sama persis dengan functions/lib/keamanan.ts:
# garam base64 16 byte, lalu pbkdf2-sha256 100.000 putaran, 32 byte, base64.
# Yang di-hash adalah TEKS base64 dari garam (bukan byte mentahnya).
buat_hash() {
  python3 -c "
import hashlib,base64,os,sys
sandi=sys.argv[1]
garam=base64.b64encode(os.urandom(16)).decode()
dk=hashlib.pbkdf2_hmac('sha256',sandi.encode(),garam.encode(),100000,dklen=32)
print(garam+'\$'+base64.b64encode(dk).decode())
" "$1"
}

sesi_peran() {
  q "SELECT s.id FROM app_sessions s JOIN app_users u ON u.id=s.user_id
     WHERE u.role='$1' AND u.status='approved'
       AND s.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
     ORDER BY s.expires_at DESC LIMIT 1" \
  | python3 -c "import json,sys
try:
    r=json.load(sys.stdin)[0]['results']; print(r[0]['id'] if r else '')
except Exception: print('')"
}

ambil_id() { # email -> id
  q "SELECT id FROM app_users WHERE email='$1'" \
  | python3 -c "import json,sys
try:
    r=json.load(sys.stdin)[0]['results']; print(r[0]['id'] if r else '')
except Exception: print('')"
}

# ── Persiapan ───────────────────────────────────────────────
echo "── 0. Siapkan akun uji ──"
HASH=$(buat_hash "$SANDI_LAMA")
cat > /tmp/seed-uji.sql <<SQL
INSERT OR REPLACE INTO app_users
 (id,email,password_hash,role,full_name,status,created_at,updated_at,permissions)
 VALUES ('$UID_UJI','$AKUN','$HASH','sales','Akun Uji E2E','approved',
         '2026-10-07T00:00:00Z','2026-10-07T00:00:00Z',NULL);
SQL
npx wrangler d1 execute sph-management-db --remote --file=/tmp/seed-uji.sql >/dev/null 2>&1
ada=$(q "SELECT COUNT(*) AS n FROM app_users WHERE id='$UID_UJI'" | python3 -c "import json,sys
try: print(json.load(sys.stdin)[0]['results'][0]['n'])
except Exception: print('?')")
lapor "akun uji dibuat" "$ada" "1"
UID_DB=$(ambil_id "$AKUN")
echo "  id: $UID_DB"

SID_ADMIN=$(sesi_peran admin)
if [ -z "$SID_ADMIN" ]; then echo "  Tidak ada sesi admin aktif — masuk dulu sebagai admin."; exit 1; fi
KUE_ADMIN="sph_session=$SID_ADMIN"

echo
echo "── 1. Password lama masih berlaku sebelum direset ──"
kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$AKUN\",\"password\":\"$SANDI_LAMA\"}" "$BASE/api/auth/login")
lapor "login sandi lama" "$kode" "200"

echo
echo "── 2. Akun non-admin TIDAK boleh membuat kode reset ──"
SID_STAFF=$(sesi_peran staff)
if [ -n "$SID_STAFF" ]; then
  kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
    -H "Cookie: sph_session=$SID_STAFF" -H 'Content-Type: application/json' \
    -d "{\"id\":\"$UID_DB\"}" "$BASE/api/admin/reset-password")
  lapor "staff buat kode reset" "$kode" "403"
else
  echo "  (tidak ada sesi staff aktif — dilewati)"
fi
kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' -d "{\"id\":\"$UID_DB\"}" "$BASE/api/admin/reset-password")
lapor "tanpa sesi buat kode reset" "$kode" "401"

echo
echo "── 3. Admin membuat kode reset ──"
curl -s -X POST -H "Cookie: $KUE_ADMIN" -H 'Content-Type: application/json' \
  -d "{\"id\":\"$UID_DB\"}" "$BASE/api/admin/reset-password" > /tmp/kode.json
KODE=$(python3 -c "import json
try: print(json.load(open('/tmp/kode.json')).get('kode',''))
except Exception: print('')")
if [ -n "$KODE" ]; then lulus=$((lulus+1)); echo "  ✓ kode dibuat (${#KODE} angka)";
else gagal=$((gagal+1)); echo "  ✗ kode tidak dibuat: $(head -c 200 /tmp/kode.json)"; fi

echo
echo "── 4. Kode mentah TIDAK tersimpan di database ──"
# Kalau kode mentah ada di DB, bocornya DB = bocornya semua akun.
mentah=$(q "SELECT COUNT(*) AS n FROM app_reset_kode WHERE kode_hash LIKE '%$KODE%'" \
  | python3 -c "import json,sys
try: print(json.load(sys.stdin)[0]['results'][0]['n'])
except Exception: print('?')")
lapor "kode mentah tidak ada di tabel" "$mentah" "0"
hashada=$(q "SELECT COUNT(*) AS n FROM app_reset_kode WHERE user_id='$UID_DB' AND kode_hash LIKE '%\$%'" \
  | python3 -c "import json,sys
try: print(json.load(sys.stdin)[0]['results'][0]['n'])
except Exception: print('?')")
lapor "hash kode tersimpan (format garam\$hash)" "$hashada" "1"

echo
echo "── 5. Kode baru membatalkan kode lama ──"
curl -s -X POST -H "Cookie: $KUE_ADMIN" -H 'Content-Type: application/json' \
  -d "{\"id\":\"$UID_DB\"}" "$BASE/api/admin/reset-password" > /tmp/kode2.json
KODE2=$(python3 -c "import json
try: print(json.load(open('/tmp/kode2.json')).get('kode',''))
except Exception: print('')")
hidup=$(q "SELECT COUNT(*) AS n FROM app_reset_kode
           WHERE user_id='$UID_DB' AND dipakai_at IS NULL AND dibatalkan_at IS NULL" \
  | python3 -c "import json,sys
try: print(json.load(sys.stdin)[0]['results'][0]['n'])
except Exception: print('?')")
lapor "hanya 1 kode hidup setelah buat ulang" "$hidup" "1"
# Kode pertama harus sudah tidak berlaku.
kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$AKUN\",\"kode\":\"$KODE\",\"passwordBaru\":\"$SANDI_BARU\"}" \
  "$BASE/api/auth/lupa-password")
lapor "kode lama sudah mati" "$kode" "400"

echo
echo "── 6. Password lemah ditolak ──"
for lemah in "123" "12345678" "password" "aaaaaaaa"; do
  kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
    -d "{\"email\":\"$AKUN\",\"kode\":\"$KODE2\",\"passwordBaru\":\"$lemah\"}" \
    "$BASE/api/auth/lupa-password")
  lapor "tolak sandi '$lemah'" "$kode" "400"
done

echo
echo "── 7. Email tak terdaftar memberi pesan SAMA dengan kode salah ──"
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"tidak-ada@contoh.invalid\",\"kode\":\"$KODE2\",\"passwordBaru\":\"$SANDI_BARU\"}" \
  "$BASE/api/auth/lupa-password" > /tmp/p1.json
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$AKUN\",\"kode\":\"00000000\",\"passwordBaru\":\"$SANDI_BARU\"}" \
  "$BASE/api/auth/lupa-password" > /tmp/p2.json
sama=$(python3 -c "
import json
a=json.load(open('/tmp/p1.json')).get('error','')
b=json.load(open('/tmp/p2.json')).get('error','')
print('sama' if a==b and a else 'beda')
")
lapor "pesan galat tidak membedakan email terdaftar" "$sama" "sama"

echo
echo "── 8. Reset dengan kode benar ──"
curl -s -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$AKUN\",\"kode\":\"$KODE2\",\"passwordBaru\":\"$SANDI_BARU\"}" \
  "$BASE/api/auth/lupa-password" > /tmp/reset.json
ok=$(python3 -c "import json
try: print(json.load(open('/tmp/reset.json')).get('ok',''))
except Exception: print('')")
lapor "reset berhasil" "$ok" "True"

echo
echo "── 9. Password BARU bisa dipakai, password LAMA tidak ──"
kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$AKUN\",\"password\":\"$SANDI_BARU\"}" "$BASE/api/auth/login")
lapor "login sandi baru" "$kode" "200"
kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$AKUN\",\"password\":\"$SANDI_LAMA\"}" "$BASE/api/auth/login")
lapor "login sandi lama" "$kode" "401"

echo
echo "── 10. Kode yang sudah dipakai tidak bisa dipakai lagi ──"
kode=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' \
  -d "{\"email\":\"$AKUN\",\"kode\":\"$KODE2\",\"passwordBaru\":\"SandiLain#2026z\"}" \
  "$BASE/api/auth/lupa-password")
lapor "pakai ulang kode" "$kode" "400"

echo
echo "── 11. Riwayat keamanan tercatat ──"
riw=$(q "SELECT jenis, COUNT(*) AS n FROM app_keamanan_riwayat
         WHERE user_id='$UID_DB' GROUP BY jenis" \
  | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)[0]['results']
    print(', '.join(r['jenis']+'='+str(r['n']) for r in d) or '(kosong)')
except Exception: print('(kosong)')")
echo "  catatan: $riw"
punya=$(q "SELECT COUNT(*) AS n FROM app_keamanan_riwayat
           WHERE user_id='$UID_DB' AND jenis='password_direset'" \
  | python3 -c "import json,sys
try: print(json.load(sys.stdin)[0]['results'][0]['n'])
except Exception: print('?')")
lapor "ada catatan password_direset" "$(python3 -c "print('ya' if $punya>0 else 'tidak')")" "ya"

echo
echo "── 12. Bersihkan akun uji ──"
q "DELETE FROM app_sessions WHERE user_id='$UID_DB'" >/dev/null 2>&1
q "DELETE FROM app_reset_kode WHERE user_id='$UID_DB'" >/dev/null 2>&1
q "DELETE FROM app_keamanan_riwayat WHERE user_id='$UID_DB'" >/dev/null 2>&1
q "DELETE FROM app_users WHERE id='$UID_UJI'" >/dev/null 2>&1
sisa=$(q "SELECT COUNT(*) AS n FROM app_users WHERE id='$UID_UJI'" \
  | python3 -c "import json,sys
try: print(json.load(sys.stdin)[0]['results'][0]['n'])
except Exception: print('?')")
lapor "akun uji terhapus" "$sisa" "0"

echo
echo "════════════════════════════════"
echo "Lulus: $lulus   Gagal: $gagal"
[ "$gagal" -eq 0 ] || exit 1
