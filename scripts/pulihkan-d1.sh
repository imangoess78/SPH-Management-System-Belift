#!/usr/bin/env bash
# ============================================================
#  PULIHKAN DATABASE SPH — SATU PERINTAH
#
#  Dipakai saat data rusak/hilang dan harus dikembalikan dari backup.
#
#  Skrip ini SENGAJA tidak menyentuh database produksi. Hasil pemulihan
#  selalu ditaruh di database BERNAMA LAIN, lalu Anda tukar sendiri setelah
#  memeriksa isinya. Ini disengaja: menimpa produksi langsung berarti tidak
#  ada jalan pulang kalau ternyata backup-nya salah.
#
#  Cara pakai:
#      ./scripts/pulihkan-d1.sh                      # lihat daftar backup
#      ./scripts/pulihkan-d1.sh 2026-10-01T22-45     # pulihkan backup itu
#      ./scripts/pulihkan-d1.sh 2026-10-01T22-45 db-baru
#
#  Syarat: sudah `npx wrangler login` dan berada di folder proyek.
# ============================================================
set -euo pipefail

PROYEK="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROYEK"

DB_PRODUKSI="sph-management-db"
AKUN="42a938ce4908ae486303fcdc63b09fd2"
PENANDA="${1:-}"
DB_TUJUAN="${2:-${DB_PRODUKSI}-pulihan}"

pesan() { printf '\n\033[1m%s\033[0m\n' "$*"; }
peringatan() { printf '\033[33m  ! %s\033[0m\n' "$*"; }
gagal() { printf '\033[31m  ✘ %s\033[0m\n' "$*"; exit 1; }

# Token Cloudflare TIDAK diurus di sini. Pembacaan token sepenuhnya dikerjakan
# scripts/r2-bantu.py, yang mencari di urutan: variabel lingkungan →
# ~/.config/sph/cloudflare-token (DI LUAR repo) → .env.local → .env.
#
# Dua alasan tidak diurus di shell:
#   1. Repo ini PUBLIK. Token yang ditulis di dalam folder proyek akan bocor
#      ke GitHub begitu ter-commit.
#   2. Parsing di shell pernah merusak token tanpa ketahuan (`tr -d` ikut
#      menghapus huruf 'n') — bug yang hanya muncul dengan token sungguhan.
BANTU="scripts/r2-bantu.py"
TMP_GALAT="$(mktemp)"
export CLOUDFLARE_ACCOUNT_ID="$AKUN"

# ────────────────────────────────────────────────────────────
#  1. TANPA ARGUMEN → tampilkan daftar backup
# ────────────────────────────────────────────────────────────
if [[ -z "$PENANDA" ]]; then
  pesan "Backup yang tersimpan di R2"

  if DAFTAR="$(python3 "$BANTU" daftar 2>"$TMP_GALAT")"; then
    :
  else
    DAFTAR=""
  fi

  if [[ -z "$DAFTAR" ]]; then
    pesan "Tidak bisa membaca daftar backup"
    sed 's/^/  /' "$TMP_GALAT" 2>/dev/null | head -8
    echo
    echo "  JANGAN hapus apa pun. Backup di Cloudflare kemungkinan besar masih"
    echo "  aman — yang bermasalah hanya cara mengaksesnya dari komputer ini."
    rm -f "$TMP_GALAT"
    exit 1
  fi

  echo "$DAFTAR" | while IFS='|' read -r K U; do
    KB=$((U/1024))
    # Berkas lama (sebelum skema ikut dibackup) hanya ~508 KB dan TIDAK BISA
    # membangun ulang database dari nol. Ditandai jelas supaya tidak terpilih
    # saat panik — ukuran adalah penanda paling cepat.
    if [[ "$KB" -lt 515 ]]; then
      printf '  %-44s %4s KB  ← tanpa skema, jangan dipakai untuk database hilang total\n' \
        "$(basename "$K")" "$KB"
    else
      printf '  %-44s %4s KB  ✔ lengkap\n' "$(basename "$K")" "$KB"
    fi
  done

  pesan "Cara memulihkan"
  echo "  ./scripts/pulihkan-d1.sh <penanda-waktu>"
  echo "  contoh: ./scripts/pulihkan-d1.sh 2026-10-01T22-45"
  echo
  echo "  Pilih berkas bertanda '✔ lengkap' yang PALING BARU."
  echo "  Yang 'tanpa skema' hanya berisi data tanpa definisi tabel — berguna"
  echo "  kalau tabelnya masih ada, tapi tidak bisa membangun database dari nol."
  exit 0
fi

# ────────────────────────────────────────────────────────────
#  2. Penjaga: jangan pernah menyentuh produksi
# ────────────────────────────────────────────────────────────
if [[ "$DB_TUJUAN" == "$DB_PRODUKSI" ]]; then
  gagal "Tujuan TIDAK BOLEH database produksi ($DB_PRODUKSI).
  Tulis nama lain, misal: $0 $PENANDA ${DB_PRODUKSI}-pulihan"
fi

pesan "Memulihkan backup '$PENANDA' → database '$DB_TUJUAN'"
peringatan "Database produksi ($DB_PRODUKSI) TIDAK akan disentuh skrip ini."

# ────────────────────────────────────────────────────────────
#  3. Cari berkasnya
# ────────────────────────────────────────────────────────────
DAFTAR_SEMENTARA="$(mktemp)"
if ! python3 "$BANTU" daftar > "$DAFTAR_SEMENTARA" 2>"$TMP_GALAT"; then
  # Kalau gagal membaca daftar, JANGAN bilang "tidak ditemukan" — itu menyesatkan
  # dan bisa membuat orang mengira backup-nya hilang padahal hanya soal akses.
  pesan "Gagal membaca daftar backup"
  sed 's/^/  /' "$TMP_GALAT" 2>/dev/null | head -10
  echo
  echo "  Penyebab yang paling sering: token Cloudflare tidak terbaca."
  echo "  Perbaikan: buat berkas .env di folder proyek berisi:"
  echo "      CLOUDFLARE_API_TOKEN=***"
  echo "      CLOUDFLARE_ACCOUNT_ID=42a938ce4908ae486303fcdc63b09fd2"
  echo
  echo "  JANGAN hapus apa pun. Database produksi ($DB_PRODUKSI) aman."
  rm -f "$DAFTAR_SEMENTARA"
  exit 1
fi

# Semua berkas yang memuat penanda, lalu ambil yang paling baru (urutan nama =
# urutan waktu, karena nama berkasnya memakai stempel ISO).
KUNCI="$(cut -d'|' -f1 < "$DAFTAR_SEMENTARA" | grep -F -- "$PENANDA" | sort -r | head -1 || true)"
rm -f "$DAFTAR_SEMENTARA"

if [[ -z "$KUNCI" ]]; then
  gagal "Backup dengan penanda '$PENANDA' tidak ditemukan.
  Jalankan tanpa argumen untuk melihat daftar yang tersedia."
fi
echo "  berkas: $KUNCI"

# ────────────────────────────────────────────────────────────
#  4. Unduh & periksa isinya SEBELUM menyentuh database
# ────────────────────────────────────────────────────────────
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

python3 "$BANTU" unduh "$KUNCI" "$TMP/b.json" \
  || gagal "Gagal mengunduh berkas backup."
rm -f "$TMP_GALAT"

python3 - "$TMP/b.json" <<'PY' || exit 1
import json, sys
d = json.load(open(sys.argv[1]))
man = (d.get('manifest') or {}).get('tabel') or {}
skema = d.get('skema') or []
baris_total = sum(v.get('baris', 0) for v in man.values())

print(f"  dibuat pada   : {(d.get('manifest') or {}).get('dibuat_pada','?')[:19]}")
print(f"  perintah skema: {len(skema)}")
print(f"  tabel         : {len(man)}  |  baris: {baris_total}")

if not skema:
    print('\n  ✘ BERKAS INI TIDAK MEMUAT SKEMA — tidak bisa membangun ulang')
    print('    database dari nol. Pilih berkas bertanda "✔ lengkap".')
    sys.exit(1)
if baris_total == 0:
    print('\n  ✘ BERKAS INI KOSONG — semua tabel 0 baris. Jangan dipakai.')
    sys.exit(1)
print('  ✔ berkas lengkap dan berisi')
PY

# ────────────────────────────────────────────────────────────
#  5. Siapkan database tujuan
# ────────────────────────────────────────────────────────────
pesan "Menyiapkan database tujuan"
if npx wrangler d1 list 2>/dev/null | grep -q "$DB_TUJUAN"; then
  echo "  database '$DB_TUJUAN' sudah ada — dipakai ulang."
  peringatan "Kalau isinya sudah penuh dan ingin mulai bersih, hapus dulu:"
  echo "     npx wrangler d1 delete $DB_TUJUAN --skip-confirmation"
else
  npx wrangler d1 create "$DB_TUJUAN" >/dev/null 2>&1 || true
  echo "  database '$DB_TUJUAN' dibuat."
fi

# ────────────────────────────────────────────────────────────
#  6. Tulis skema + data ke database tujuan
# ────────────────────────────────────────────────────────────
pesan "Mengisi skema dan data (bagian yang paling lama)"
python3 - "$TMP/b.json" "$PROYEK" "$DB_TUJUAN" "$TMP" <<'PY'
import json, sys, subprocess, time, os

berkas, proyek, db, tmp = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
d = json.load(open(berkas))
skema, data = d.get('skema') or [], d.get('data') or {}

# Batas aman: perintah SQL dikirim lewat BERKAS, bukan lewat argumen baris
# perintah. Sempat dikirim lewat argumen dan gagal dengan "Argument list too
# long" pada tabel berisi teks panjang (design_items) — ketahuan hanya saat
# pemulihan sungguhan dicoba.
BATAS_PERNYATAAN = 60_000   # ukuran satu perintah INSERT
BATAS_BERKAS = 400_000      # ukuran satu berkas .sql


def jalankan_file(sql_teks):
    """Kirim SQL lewat berkas sementara."""
    path = os.path.join(tmp, 'muat.sql')
    with open(path, 'w') as f:
        f.write(sql_teks)
    r = subprocess.run(['npx', 'wrangler', 'd1', 'execute', db, '--remote', '-y',
                        '--file=' + path],
                       cwd=proyek, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(((r.stderr or '') + (r.stdout or ''))[:500])


def jalankan(sql):
    return jalankan_file(sql)


def kutip(x):
    if x is None:
        return 'NULL'
    if isinstance(x, bool):
        return '1' if x else '0'
    if isinstance(x, (int, float)):
        return str(x)
    return "'" + str(x).replace("'", "''") + "'"


print(f"  skema: {len(skema)} perintah...", end=' ', flush=True)
jalankan('\n'.join(s['sql'] + ';' for s in skema))
print('selesai')

total = 0
besar_sekaligus = []
for tabel, baris in data.items():
    if not baris:
        print(f"  {tabel:30} 0 baris")
        continue

    kolom = list(baris[0].keys())
    daftarkolom = ', '.join(f'"{k}"' for k in kolom)
    t0 = time.time()
    pernyataan, panjang = [], 0
    terbesar = 0

    def tulis(s):
        """Kumpulkan pernyataan, jalankan kalau sudah cukup besar."""
        global panjang
        pernyataan.append(s)
        panjang += len(s)
        if panjang >= BATAS_BERKAS:
            jalankan('\n'.join(pernyataan))
            pernyataan.clear()
            panjang = 0

    for r in baris:
        nilai = '(' + ', '.join(kutip(r.get(k)) for k in kolom) + ')'
        s = f'INSERT OR REPLACE INTO "{tabel}" ({daftarkolom}) VALUES {nilai};'
        terbesar = max(terbesar, len(s))
        if len(s) > BATAS_PERNYATAAN:
            # Satu baris saja sudah melebihi batas. Dijalankan sendiri supaya
            # kalau gagal, pesannya jelas menyebut baris mana.
            tulis(s)
        else:
            tulis(s)
    if pernyataan:
        jalankan('\n'.join(pernyataan))

    total += len(baris)
    catatan = f"  (baris terbesar {terbesar//1024} KB)" if terbesar > 20_000 else ''
    print(f"  {tabel:30} {len(baris):4} baris  ({time.time()-t0:.1f}s){catatan}")
print(f"  TOTAL: {total} baris")
PY

# ────────────────────────────────────────────────────────────
#  7. Verifikasi: hitung ulang langsung dari database
# ────────────────────────────────────────────────────────────
pesan "Memeriksa hasil"
python3 - "$TMP/b.json" "$PROYEK" "$DB_TUJUAN" "$DB_PRODUKSI" <<'PY' || exit 1
import json, sys, subprocess

berkas, proyek, db, db_produksi = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
man = (json.load(open(berkas)).get('manifest') or {}).get('tabel') or {}


def hitung(database, sql):
    r = subprocess.run(['npx', 'wrangler', 'd1', 'execute', database, '--remote',
                        '--json', '--command', sql],
                       cwd=proyek, capture_output=True, text=True)
    t = r.stdout
    i = t.find('[')
    if i < 0:
        return None
    try:
        return json.JSONDecoder().raw_decode(t[i:])[0][0].get('results', [])
    except Exception:
        return None


beda = []
for tabel in sorted(man.keys()):
    r = hitung(db, f'SELECT COUNT(*) AS n FROM "{tabel}"')
    n = r[0]['n'] if r else -1
    if n != man[tabel]['baris']:
        beda.append(f"{tabel}: harap {man[tabel]['baris']}, dapat {n}")

print(f"  tabel diperiksa : {len(man)}")
print(f"  tabel berbeda   : {len(beda)}")
for b in beda[:10]:
    print('    ✘', b)

prod = hitung(db_produksi, 'SELECT COUNT(*) AS n FROM sph')
print(f"\n  produksi ({db_produksi}): {prod[0]['n'] if prod else '?'} SPH — TIDAK tersentuh")

if beda:
    print('\n  ✘ PEMULIHAN BELUM UTUH. Jangan tukar database dulu.')
    sys.exit(1)
print('\n  ✔ PEMULIHAN UTUH — semua tabel cocok')
PY

# ────────────────────────────────────────────────────────────
#  8. Langkah penukaran (dijelaskan, TIDAK dijalankan otomatis)
# ────────────────────────────────────────────────────────────
pesan "SELESAI — sekarang giliran Anda memutuskan"
cat <<EOF
  Database hasil pemulihan : $DB_TUJUAN
  Database produksi        : $DB_PRODUKSI  (belum tersentuh)

  Langkah berikutnya TIDAK dilakukan otomatis, supaya Anda sempat memeriksa
  dulu. Urutannya:

  1) Periksa isinya:
       npx wrangler d1 execute $DB_TUJUAN --remote --json \\
         --command "SELECT nomor_sph, status FROM sph ORDER BY nomor_sph DESC LIMIT 5"

  2) Kalau sudah yakin, tukar binding di wrangler.jsonc:
       "database_name": "$DB_TUJUAN"      ← dari $DB_PRODUKSI
     lalu deploy ulang:
       npm run build
       npx wrangler pages deploy dist --project-name sph-management-clone --branch main

  3) SIMPAN database lama dulu, jangan langsung dihapus. Minimal 7 hari.
     Hapus hanya setelah yakin:
       npx wrangler d1 delete $DB_PRODUKSI --skip-confirmation

  PENTING: berkas foto, tanda tangan, dan gambar desain TIDAK ada di dalam
  backup ini — hanya database. Lihat docs/DARURAT.md bagian 6.
EOF
