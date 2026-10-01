#!/usr/bin/env python3
"""
Bantuan untuk scripts/pulihkan-d1.sh — daftar dan unduh backup dari R2.

KENAPA DIPISAH: awalnya semua dikerjakan `wrangler r2 object get`, tapi perintah
itu TIDAK BISA membaca berkas backup sama sekali (mengembalikan "key does not
exist" padahal berkasnya ada — sudah diperiksa langsung lewat API Cloudflare).
Jadi jalur utamanya memakai API Cloudflare.

Jalur cadangan kalau CLOUDFLARE_API_TOKEN tidak ada: perintah `wrangler r2
object list/get`. Perlu dicatat bahwa di mesin ini jalur itu terbukti gagal
untuk berkas backup, jadi ia hanya dipakai kalau memang tidak ada pilihan lain.

Cara pakai:
    python3 scripts/r2-bantu.py daftar
    python3 scripts/r2-bantu.py unduh <kunci> <berkas-tujuan>
"""
import os
import re
import sys
import json
import subprocess
import urllib.request

AKUN = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '42a938ce4908ae486303fcdc63b09fd2')
BUCKET = 'belift-media'
PROYEK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _muat_token() -> str:
    """
    Cari token Cloudflare.

    Urutannya dari yang paling aman:
      1. variabel lingkungan
      2. ~/.config/sph/cloudflare-token   ← DI LUAR repo, jadi mustahil
         ikut ter-commit. Repo ini PUBLIK, jadi token TIDAK BOLEH ditaruh
         di dalam folder proyek.
      3. .env.local / .env (cadangan lama)

    Pembacaan sengaja dilakukan di sini, bukan di shell: shell pernah merusak
    token tanpa ketahuan (pembersihan memakai `tr -d` ikut menghapus huruf 'n').
    """
    v = (os.environ.get('CLOUDFLARE_API_TOKEN') or '').strip()
    if v:
        return v

    kandidat = [
        os.path.expanduser('~/.config/sph/cloudflare-token'),
        os.path.join(PROYEK, '.env.local'),
        os.path.join(PROYEK, '.env'),
    ]
    for f in kandidat:
        if not os.path.isfile(f):
            continue
        try:
            isi = open(f, encoding='utf-8', errors='ignore').read()
        except OSError:
            continue

        m = re.search(r'^CLOUDFLARE_API_TOKEN\s*=\s*(.+)$', isi, re.M)
        if m:
            return m.group(1).strip().strip('"').strip("'")

        # Berkas di luar repo biasanya berisi token saja, tanpa "NAMA=".
        if f.endswith('cloudflare-token'):
            baris = [b for b in isi.splitlines() if b.strip()]
            if baris:
                return baris[0].strip().strip('"').strip("'")
    return ''


TOKEN = _muat_token()


def _minta(url: str) -> dict:
    req = urllib.request.Request(url, headers={
        'Authorization': 'Bearer ' + TOKEN,
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)',
    })
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def daftar() -> int:
    """Cetak 'kunci|ukuran' per baris untuk setiap berkas backup."""
    if TOKEN:
        d = _minta(f'https://api.cloudflare.com/client/v4/accounts/{AKUN}'
                   f'/r2/buckets/{BUCKET}/objects?per_page=200')
        res = d.get('result') or {}
        objs = res if isinstance(res, list) else (res.get('objects') or [])
    else:
        # Cadangan: wrangler. Bentuk keluarannya teks, jadi diurai seadanya.
        r = subprocess.run(['npx', 'wrangler', 'r2', 'object', 'list',
                            f'{BUCKET}/backups/d1/', '--remote'],
                           cwd=PROYEK, capture_output=True, text=True, timeout=300)
        objs = []
        for baris in (r.stdout or '').splitlines():
            bagian = baris.split()
            if len(bagian) >= 2 and 'backups/d1/' in baris:
                kunci = next((b for b in bagian if b.startswith('backups/d1/')), None)
                if kunci:
                    try:
                        ukuran = int(bagian[0])
                    except ValueError:
                        ukuran = 0
                    objs.append({'key': kunci, 'size': ukuran})

    if not objs and not TOKEN:
        # Jangan kembalikan daftar kosong begitu saja: pemanggil akan
        # menyimpulkan "backup tidak ada", padahal masalahnya akses tidak
        # terbaca. Salah simpul seperti ini berbahaya saat panik.
        print('Tidak ada CLOUDFLARE_API_TOKEN, dan jalur cadangan `wrangler` '
              'tidak mengembalikan apa pun.\n'
              'Perintah `wrangler r2 object list/get` TIDAK BISA membaca berkas '
              'backup di mesin ini.\n'
              'Perbaikan: taruh token di berkas .env folder proyek:\n'
              '    CLOUDFLARE_API_TOKEN=***    CLOUDFLARE_ACCOUNT_ID=' + AKUN, file=sys.stderr)
        return 3

    backup = [o for o in objs
              if str(o.get('key', '')).startswith('backups/d1/')
              and o.get('size', 0) > 0]
    backup.sort(key=lambda x: x.get('key', ''))
    for o in backup:
        print(f"{o['key']}|{o['size']}")
    return 0


def unduh(kunci: str, tujuan: str) -> int:
    """Simpan satu berkas backup ke `tujuan`."""
    if not kunci.startswith('backups/d1/'):
        print('kunci tidak sah: ' + kunci, file=sys.stderr)
        return 2

    if TOKEN:
        req = urllib.request.Request(
            f'https://api.cloudflare.com/client/v4/accounts/{AKUN}'
            f'/r2/buckets/{BUCKET}/objects/{kunci}',
            headers={'Authorization': 'Bearer ' + TOKEN,
                     'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64)'})
        with urllib.request.urlopen(req, timeout=300) as r:
            isi = r.read()
        open(tujuan, 'wb').write(isi)
        return 0 if isi else 1

    # Cadangan: wrangler.
    r = subprocess.run(['npx', 'wrangler', 'r2', 'object', 'get',
                        f'{BUCKET}/{kunci}', '--file', tujuan],
                       cwd=PROYEK, capture_output=True, text=True, timeout=600)
    if r.returncode != 0:
        print((r.stderr or r.stdout)[:400], file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    if sys.argv[1] == 'daftar':
        sys.exit(daftar())
    if sys.argv[1] == 'unduh' and len(sys.argv) == 4:
        sys.exit(unduh(sys.argv[2], sys.argv[3]))
    print(__doc__)
    sys.exit(2)
