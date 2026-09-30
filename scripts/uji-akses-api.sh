#!/usr/bin/env bash
# Uji hak akses lewat API produksi — membuktikan penolakan terjadi di server,
# bukan hanya tombol yang disembunyikan.
#
# Pemakaian: bash scripts/uji-akses-api.sh
set -u

BASE="https://hak-akses.sph-management-clone.pages.dev"
DB="sph-management-db"
CD="cd /home/ubuntu/SPH-Management-System-Belift &&"
lulus=0; gagal=0

lapor() { # nama, dapat, harap
  if [ "$2" = "$3" ]; then lulus=$((lulus+1)); echo "  ✓ $1 ($2)";
  else gagal=$((gagal+1)); echo "  ✗ $1 — dapat $2, harap $3"; fi
}

# ── 1. Siapkan dua akun sales uji + satu lead milik masing-masing ──
ADMIN_SID=$(eval "$CD npx wrangler d1 execute $DB --remote --json --command \
  \"SELECT s.id FROM app_sessions s JOIN app_users u ON u.id=s.user_id WHERE u.role='admin' AND s.expires_at > datetime('now') LIMIT 1\"" \
  2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin)[0]['results']; print(d[0]['id'] if d else '')")

if [ -z "$ADMIN_SID" ]; then
  echo "Tidak ada sesi admin aktif. Masuk dulu sebagai admin di $BASE, lalu ulangi."
  exit 1
fi
echo "Sesi admin: ${ADMIN_SID:0:12}…"

echo ""
echo "── 1. Admin boleh membuka Manajemen Akun ──"
kode=$(curl -s -o /tmp/a.json -w '%{http_code}' -b "sph_session=$ADMIN_SID" "$BASE/api/admin/users")
lapor "admin GET /api/admin/users" "$kode" "200"

echo ""
echo "── 2. Sales ditolak di endpoint Laporan/Akun ──"
# Buat akun sales uji (password_hash wajib diisi walau kita masuk lewat sesi)
SALES_EMAIL="uji.sales.$(date +%s)@belift.test"
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"INSERT INTO app_users (id,email,full_name,role,status,password_hash,created_at,updated_at) \
   VALUES ('uji-sales-1','$SALES_EMAIL','Uji Sales Satu','sales','approved','ujisalt-TIDAK-DIPAKAI',datetime('now'),datetime('now'))\"" >/dev/null 2>&1

# Pastikan akun benar-benar ada sebelum lanjut — kalau tidak, semua uji di bawah
# akan gagal dengan 401 dan hasilnya menyesatkan.
ada=$(eval "$CD npx wrangler d1 execute $DB --remote --json --command \
  \"SELECT COUNT(*) c FROM app_users WHERE id='uji-sales-1'\"" 2>/dev/null | python3 -c "import json,sys;print(json.load(sys.stdin)[0]['results'][0]['c'])")
if [ "$ada" != "1" ]; then echo "GAGAL menyiapkan akun uji sales."; exit 1; fi

SALES_SID="uji-sesi-sales-1"
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"DELETE FROM app_sessions WHERE id='$SALES_SID'\"" >/dev/null 2>&1
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"INSERT INTO app_sessions (id,user_id,expires_at,created_at) \
   VALUES ('$SALES_SID','uji-sales-1',datetime('now','+2 days'),datetime('now'))\"" >/dev/null 2>&1

kode=$(curl -s -o /tmp/b.json -w '%{http_code}' -b "sph_session=$SALES_SID" "$BASE/api/admin/users")
lapor "sales GET /api/admin/users ditolak" "$kode" "403"

kode=$(curl -s -o /dev/null -w '%{http_code}' -b "sph_session=$SALES_SID" "$BASE/api/crm?resource=leads")
lapor "sales GET /api/crm (boleh, punya izin CRM)" "$kode" "200"

kode=$(curl -s -o /tmp/c.json -w '%{http_code}' -b "sph_session=$SALES_SID" "$BASE/api/po?resource=po")
lapor "sales GET /api/po ditolak (tanpa izin PO)" "$kode" "403"

kode=$(curl -s -o /tmp/d.json -w '%{http_code}' -b "sph_session=$SALES_SID" "$BASE/api/survey?resource=survey&jenis=final")
lapor "sales GET Final Survey ditolak" "$kode" "403"

echo ""
echo "── 3. Batasan data: sales hanya lihat lead sendiri ──"
# Lead milik orang lain
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"INSERT OR REPLACE INTO crm_leads (id,kode_lead,nama_prospek,sales,status_terakhir,waktu_masuk,created_at,updated_at) \
   VALUES ('uji-lead-oranglain','UJI-001','Prospek Milik Siti','Siti Sales','Lead Baru',datetime('now'),datetime('now'),datetime('now'))\"" >/dev/null 2>&1
# Lead milik sales uji
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"INSERT OR REPLACE INTO crm_leads (id,kode_lead,nama_prospek,sales,status_terakhir,waktu_masuk,created_at,updated_at) \
   VALUES ('uji-lead-sendiri','UJI-002','Prospek Milik Saya','Uji Sales Satu','Lead Baru',datetime('now'),datetime('now'),datetime('now'))\"" >/dev/null 2>&1

curl -s -b "sph_session=$SALES_SID" "$BASE/api/crm?resource=leads" > /tmp/leads.json
adasendiri=$(python3 -c "import json;d=json.load(open('/tmp/leads.json'));print(sum(1 for x in d.get('data',[]) if x['id']=='uji-lead-sendiri'))")
adaoranglain=$(python3 -c "import json;d=json.load(open('/tmp/leads.json'));print(sum(1 for x in d.get('data',[]) if x['id']=='uji-lead-oranglain'))")
lapor "lead sendiri MUNCUL di daftar" "$adasendiri" "1"
lapor "lead sales lain TIDAK muncul" "$adaoranglain" "0"

# Buka detail lead orang lain langsung lewat id
kode=$(curl -s -o /tmp/e.json -w '%{http_code}' -b "sph_session=$SALES_SID" "$BASE/api/crm?resource=leads&id=uji-lead-oranglain")
lapor "buka lead sales lain lewat id ditolak" "$kode" "403"

# Ubah lead orang lain
kode=$(curl -s -o /tmp/f.json -w '%{http_code}' -b "sph_session=$SALES_SID" \
  -X PUT -H 'content-type: application/json' \
  -d '{"nama_prospek":"DIBUBAH"}' "$BASE/api/crm?resource=leads&id=uji-lead-oranglain")
lapor "ubah lead sales lain ditolak" "$kode" "403"

# Lead baru otomatis jadi miliknya
curl -s -b "sph_session=$SALES_SID" -X POST -H 'content-type: application/json' \
  -d '{"kode_lead":"UJI-003","nama_prospek":"Prospek Baru","waktu_masuk":"2026-09-21T00:00:00.000Z"}' \
  "$BASE/api/crm?resource=leads" >/dev/null
pemilik=$(eval "$CD npx wrangler d1 execute $DB --remote --json --command \
  \"SELECT sales FROM crm_leads WHERE kode_lead='UJI-003'\"" 2>/dev/null | python3 -c "import json,sys;d=json.load(sys.stdin)[0]['results'];print(d[0]['sales'] if d else '')")
lapor "lead baru otomatis milik pembuatnya" "$pemilik" "Uji Sales Satu"

echo ""
echo "── 4. Admin masih melihat semua ──"
curl -s -b "sph_session=$ADMIN_SID" "$BASE/api/crm?resource=leads" > /tmp/leadadmin.json
adaoranglain=$(python3 -c "import json;d=json.load(open('/tmp/leadadmin.json'));print(sum(1 for x in d.get('data',[]) if x['id']=='uji-lead-oranglain'))")
lapor "admin melihat lead sales lain" "$adaoranglain" "1"

echo ""
echo "════════════════════════════════════════════════"
echo "  LULUS: $lulus   GAGAL: $gagal"
echo "════════════════════════════════════════════════"

# ── Bersihkan data uji ──
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"DELETE FROM crm_leads WHERE id IN ('uji-lead-oranglain','uji-lead-sendiri') OR kode_lead='UJI-003'\"" >/dev/null 2>&1
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"DELETE FROM app_sessions WHERE user_id='uji-sales-1'\"" >/dev/null 2>&1
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"DELETE FROM app_users WHERE id='uji-sales-1'\"" >/dev/null 2>&1
echo "Data uji dibersihkan."
exit $([ "$gagal" -eq 0 ] && echo 0 || echo 1)
