#!/usr/bin/env bash
# Verifikasi tabel notifikasi di D1 produksi + uji perilaku penyimpanan.
#
# Dipakai untuk membuktikan MIGRASI SUNGGUHAN BERJALAN, bukan sekadar
# berkas .sql ada di repo. Tanpa langkah ini, fitur lonceng bisa tampak
# "terpasang" (kode tidak galat karena kirim() sengaja menelan galat)
# padahal tabelnya belum ada dan tidak ada notifikasi yang pernah tercatat.
#
# Pemakaian: bash scripts/uji-notifikasi-d1.sh
set -u

DB="sph-management-db"
CD="cd /home/ubuntu/SPH-Management-System-Belift &&"
lulus=0; gagal=0

lapor() { # nama, dapat, harap
  if [ "$2" = "$3" ]; then lulus=$((lulus+1)); echo "  ✓ $1 ($2)";
  else gagal=$((gagal+1)); echo "  ✗ $1 — dapat $2, harap $3"; fi
}

tanya() { # sql -> hasil baris pertama kolom pertama
  eval "$CD npx wrangler d1 execute $DB --remote --json --command \
    \"$1\"" 2>/dev/null \
    | python3 -c "import json,sys
try:
    d=json.load(sys.stdin)[0]['results']
    print(d[0]['n'] if d and 'n' in d[0] else (list(d[0].values())[0] if d else ''))
except Exception:
    print('')"
}

echo "── 1. Tabel ada? ──"
ada=$(tanya "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='app_notifikasi'")
lapor "tabel app_notifikasi" "$ada" "1"
ada_baca=$(tanya "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='app_notifikasi_baca'")
lapor "tabel app_notifikasi_baca" "$ada_baca" "1"

echo
echo "── 2. Indeks anti-kembar ada? (kunci_event harus terindeks) ──"
idx=$(tanya "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='index' AND name='idx_notif_kunci'")
lapor "indeks idx_notif_kunci" "$idx" "1"

echo
echo "── 3. Bentuk kolom app_notifikasi ──"
eval "$CD npx wrangler d1 execute $DB --remote --json --command \
  \"SELECT name FROM pragma_table_info('app_notifikasi') ORDER BY cid\"" 2>/dev/null \
  | python3 -c "
import json,sys
try:
    kolom=[r['name'] for r in json.load(sys.stdin)[0]['results']]
except Exception:
    kolom=[]
harap=['id','jenis','kunci_event','judul','pesan','penerima','tautan','oleh_nama','tingkat','created_at']
hilang=[k for k in harap if k not in kolom]
print('  kolom terbaca:', ', '.join(kolom) if kolom else '(kosong)')
print('  ✓ semua kolom wajib ada' if not hilang else f'  ✗ kolom hilang: {hilang}')
"

echo
echo "── 4. Uji anti-kembar kunci_event (sisip dua kali) ──"
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"INSERT INTO app_notifikasi (id,jenis,kunci_event,judul,pesan,penerima,tautan,oleh_nama,tingkat,created_at) \
   SELECT 'uji-notif-1','uji','uji-kunci-1','Uji','Uji','uji-user','', '', 'info','2026-10-14T00:00:00Z' \
   WHERE NOT EXISTS (SELECT 1 FROM app_notifikasi WHERE kunci_event='uji-kunci-1')\"" >/dev/null 2>&1
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"INSERT INTO app_notifikasi (id,jenis,kunci_event,judul,pesan,penerima,tautan,oleh_nama,tingkat,created_at) \
   SELECT 'uji-notif-2','uji','uji-kunci-1','Uji','Uji','uji-user','', '', 'info','2026-10-14T00:00:00Z' \
   WHERE NOT EXISTS (SELECT 1 FROM app_notifikasi WHERE kunci_event='uji-kunci-1')\"" >/dev/null 2>&1
kembar=$(tanya "SELECT COUNT(*) AS n FROM app_notifikasi WHERE kunci_event='uji-kunci-1'")
lapor "sisip dua kali kunci sama -> 1 baris" "$kembar" "1"

echo
echo "── 5. Uji penyaringan penerima pola ',id,' (id yang jadi bagian id lain) ──"
# 'abc' TIDAK boleh cocok dengan 'abc-1'. Inilah alasan pola memakai koma
# di kedua ujung, bukan LIKE '%abc%'.
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"INSERT INTO app_notifikasi (id,jenis,kunci_event,judul,pesan,penerima,tautan,oleh_nama,tingkat,created_at) \
   SELECT 'uji-notif-3','uji','uji-kunci-2','Uji','Uji',',abc-1,','', '', 'info','2026-10-14T00:00:00Z' \
   WHERE NOT EXISTS (SELECT 1 FROM app_notifikasi WHERE kunci_event='uji-kunci-2')\"" >/dev/null 2>&1
salah=$(tanya "SELECT COUNT(*) AS n FROM app_notifikasi WHERE penerima LIKE '%,abc,%'")
lapor "id 'abc' tidak cocok ke 'abc-1'" "$salah" "0"

# Bersihkan baris uji supaya tidak mengotori data produksi.
eval "$CD npx wrangler d1 execute $DB --remote --command \
  \"DELETE FROM app_notifikasi WHERE jenis='uji'\"" >/dev/null 2>&1
sisa=$(tanya "SELECT COUNT(*) AS n FROM app_notifikasi WHERE jenis='uji'")
lapor "baris uji dibersihkan" "$sisa" "0"

echo
echo "════════════════════════════════"
echo "Lulus: $lulus   Gagal: $gagal"
[ "$gagal" -eq 0 ] || exit 1
