#!/usr/bin/env bash
# Verifikasi notifikasi di produksi.
#
# Yang dibuktikan: gerbang izin bekerja DI SERVER, bukan sekadar tombol yang
# disembunyikan di layar. Endpoint tanpa sesi harus 401, bukan 200 berisi data.
set -u
BASE="https://sph-management-clone.pages.dev"
lulus=0; gagal=0

lapor() { # nama dapat harap
  if [ "$2" = "$3" ]; then lulus=$((lulus+1)); echo "  ✓ $1 ($2)";
  else gagal=$((gagal+1)); echo "  ✗ $1 — dapat $2, harap $3"; fi
}

kode() { curl -s -o /dev/null -w '%{http_code}' "$@"; }

echo "── 1. Endpoint notifikasi menolak tanpa sesi ──"
lapor "GET /api/notifikasi"        "$(kode "$BASE/api/notifikasi")" "401"
lapor "GET hitung-cepat"           "$(kode "$BASE/api/notifikasi?jumlah=1")" "401"
lapor "POST tandai baca"           "$(kode -X POST -H 'Content-Type: application/json' -d '{}' "$BASE/api/notifikasi")" "401"

echo
echo "── 2. Halaman notifikasi mengembalikan HTML aplikasi ──"
halaman=$(kode "$BASE/notifikasi")
lapor "GET /notifikasi" "$halaman" "200"

echo
echo "── 3. Bundel memuat halaman Notifikasi (bukan 404 senyap) ──"
# Cari penanda yang hanya ada kalau halaman ini benar-benar ikut ter-bundel.
if curl -s "$BASE/" | grep -q 'assets/index-.*\.js'; then
  js=$(curl -s "$BASE/" | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
  if curl -s "$BASE/$js" | grep -q 'Tandai semua dibaca'; then
    lulus=$((lulus+1)); echo "  ✓ teks halaman Notifikasi ada di bundel"
  else
    gagal=$((gagal+1)); echo "  ✗ teks halaman Notifikasi TIDAK ada di bundel"
  fi
else
  gagal=$((gagal+1)); echo "  ✗ tidak menemukan berkas bundel di halaman utama"
fi

echo
echo "════════════════════════════════"
echo "Lulus: $lulus   Gagal: $gagal"
[ "$gagal" -eq 0 ] || exit 1
