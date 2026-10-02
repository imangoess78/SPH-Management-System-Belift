#!/usr/bin/env python3
"""
Salinan luring berkas SPH dari Cloudflare R2 → komputer lokal.

KENAPA LURING, BUKAN KE R2 LAGI:
Foto survey, tanda tangan, dan gambar desain SUDAH tersimpan di R2. Menyalin
mereka ke R2 yang sama hanya menggandakan di tempat yang sama, dan TIDAK
menyelamatkan dari kejadian yang paling mungkin: akun Cloudflare bermasalah,
bucket terhapus, atau salah hapus. Salinan di komputer terpisah dari Cloudflare,
jadi tetap aman kalau Cloudflare bermasalah.

PENTING — BUCKET INI DIPAKAI BERSAMA:
`belift-media` juga dipakai aplikasi `belift-monitoring` (awalan `reports/` dan
`thumbs/`). Skrip ini HANYA menyentuh awalan `recovery/` yang milik SPH — sekitar
47 MB dari total 173 MB. Sisanya sengaja tidak disentuh.

Cara pakai:
    python3 scripts/salin-media.py                 # salin yang baru/kurang
    python3 scripts/salin-media.py --periksa       # periksa tanpa mengunduh
    python3 scripts/salin-media.py --daftar        # lihat isi salinan
    python3 scripts/salin-media.py --sasaran DIR   # ganti folder tujuan
"""
import os
import re
import sys
import json
import hashlib
import urllib.request
from datetime import datetime, timezone

AKUN = os.environ.get('CLOUDFLARE_ACCOUNT_ID', '42a938ce4908ae486303fcdc63b09fd2')
BUCKET = 'belift-media'

# Hanya awalan milik SPH. Jangan diubah tanpa memeriksa pemakai bucket lain.
AWALAN = 'recovery/'

# Cadangan: folder salinan DILUAR repo. Repo ini PUBLIK — foto pelanggan dan
# tanda tangan tidak boleh ikut ter-commit.
SASARAN_BAWAAN = os.path.expanduser('~/salinan-belift-media')

# Berkas keterangan supaya salinan bisa diperiksa tanpa menyentuh Cloudflare.
NAMA_CATATAN = '_catatan-salinan.json'


def muat_token() -> str:
    """
    Cari token Cloudflare.

    Urutan: variabel lingkungan → ~/.config/sph/cloudflare-token (DI LUAR repo)
    → .env di folder proyek. Pembacaan di sini, bukan di shell: shell pernah
    merusak token tanpa ketahuan (`tr -d` ikut menghapus huruf 'n').
    """
    v = (os.environ.get('CLOUDFLARE_API_TOKEN') or '').strip()
    if v:
        return v

    proyek = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    kandidat = [
        os.path.expanduser('~/.config/sph/cloudflare-token'),
        os.path.join(proyek, '.env.local'),
        os.path.join(proyek, '.env'),
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
        if f.endswith('cloudflare-token'):
            baris = [b for b in isi.splitlines() if b.strip()]
            if baris:
                return baris[0].strip().strip('"').strip("'")
    return ''


TOKEN = muat_token()


def _minta(url: str) -> bytes:
    """
    Ambil satu balasan dan kembalikan ISINYA.

    PENTING: isinya dibaca sampai habis di dalam blok `with`. Sempat ditulis
    `return resp` dari dalam `with` — responsnya sudah ditutup begitu keluar
    blok, sehingga pembacaan berikutnya menghasilkan kosong dan JSON gagal
    diurai dengan pesan "Expecting value: line 1 column 1". Bug yang tidak
    terlihat sampai skripnya benar-benar dijalankan.
    """
    r = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {TOKEN}',
        'User-Agent': 'Mozilla/5.0',   # tanpa UA, Cloudflare balas 403 (1010)
    })
    with urllib.request.urlopen(r, timeout=120) as resp:
        return resp.read()


def daftar_objek() -> list:
    """Semua objek di bawah AWALAN, lengkap dengan sidik jarinya."""
    objs, kursor = [], None
    while True:
        u = (f'https://api.cloudflare.com/client/v4/accounts/{AKUN}'
             f'/r2/buckets/{BUCKET}/objects?per_page=1000&prefix={AWALAN}')
        if kursor:
            u += f'&cursor={kursor}'
        d = json.loads(_minta(u))
        hasil = d.get('result') or []
        objs += hasil
        info = d.get('result_info') or {}
        kursor = info.get('cursor')
        if not kursor or not hasil:
            break

    rapi = []
    for o in objs:
        k = o.get('key', '')
        if not k.startswith(AWALAN):
            continue          # sabuk pengaman kedua
        etag = (o.get('etag') or '').strip('"')
        rapi.append({
            'kunci': k,
            'ukuran': o.get('size', 0),
            # `etag` R2 untuk unggahan tunggal = MD5 isi berkas. Dipakai untuk
            # memastikan berkas yang tersimpan benar-benar sama.
            'etag': etag,
            'diubah': o.get('uploaded') or o.get('last_modified') or '',
        })
    rapi.sort(key=lambda x: x['kunci'])
    return rapi


def rekat(teks: str) -> str:
    """Ubah '\' jadi '/' supaya daftar tetap seragam di Windows."""
    return teks.replace('\\', '/')


def nama_lokal(sasaran: str, kunci: str) -> str:
    """Path lokal untuk satu kunci R2. Struktur folder dipertahankan."""
    return os.path.join(sasaran, *kunci.split('/'))


def muat_catatan(sasaran: str) -> dict:
    p = os.path.join(sasaran, NAMA_CATATAN)
    if os.path.isfile(p):
        try:
            return json.load(open(p, encoding='utf-8'))
        except (OSError, ValueError):
            pass
    return {'berkas': {}, 'terakhir_dijalankan': None}


def simpan_catatan(sasaran: str, catatan: dict) -> None:
    catatan['terakhir_dijalankan'] = datetime.now(timezone.utc).isoformat()
    p = os.path.join(sasaran, NAMA_CATATAN)
    tmp = p + '.sementara'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(catatan, f, indent=1, sort_keys=True)
    os.replace(tmp, p)      # ganti sekaligus: catatan tidak pernah setengah jadi


def md5_berkas(p: str) -> str:
    h = hashlib.md5()
    with open(p, 'rb') as f:
        for blok in iter(lambda: f.read(1024 * 1024), b''):
            h.update(blok)
    return h.hexdigest()


def unduh(kunci: str, tujuan: str) -> int:
    """Unduh satu berkas. Dikembalikan jumlah byte yang ditulis."""
    u = (f'https://api.cloudflare.com/client/v4/accounts/{AKUN}'
         f'/r2/buckets/{BUCKET}/objects/{kunci}')
    os.makedirs(os.path.dirname(tujuan), exist_ok=True)
    sementara = tujuan + '.sementara'
    n = 0
    # Isi berkas diambil utuh dulu (bukan dialirkan dari respons), karena
    # responsnya ditutup begitu `_minta` selesai.
    isi = _minta(u)
    with open(sementara, 'wb') as f:
        f.write(isi)
        n = len(isi)
    os.replace(sementara, tujuan)   # berkas jadi hanya setelah selesai utuh
    return n


# ────────────────────────────────────────────────────────────
#  Kembalikan salinan lokal → R2
# ────────────────────────────────────────────────────────────

JENIS = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.pdf': 'application/pdf',
    '.json': 'application/json;charset=utf-8',
}


def jenis_berkas(nama: str) -> str:
    return JENIS.get(os.path.splitext(nama)[1].lower(), 'application/octet-stream')


def unggah(kunci: str, sumber: str) -> int:
    """Unggah satu berkas kembali ke R2. Dikembalikan jumlah byte."""
    isi = open(sumber, 'rb').read()
    u = (f'https://api.cloudflare.com/client/v4/accounts/{AKUN}'
         f'/r2/buckets/{BUCKET}/objects/{kunci}')
    r = urllib.request.Request(u, data=isi, method='PUT', headers={
        'Authorization': f'Bearer {TOKEN}',
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': jenis_berkas(sumber),
    })
    with urllib.request.urlopen(r, timeout=300) as resp:
        resp.read()
    return len(isi)


def rencana_pulih(sasaran: str) -> dict:
    """
    Bandingkan salinan lokal dengan R2. TIDAK mengunggah apa pun.

    Yang dicari: berkas yang ADA di salinan tapi TIDAK ADA di R2 (atau ukurannya
    berbeda). Itulah yang perlu dikembalikan.
    """
    catatan = muat_catatan(sasaran)
    berkas = dict(catatan.get('berkas') or {})
    jauh = {o['kunci']: o for o in daftar_objek()}

    perlu, sudah = [], 0
    for k, v in sorted(berkas.items()):
        p = nama_lokal(sasaran, k)
        if not os.path.isfile(p):
            continue                      # catatan bilang ada, berkasnya tidak
        if k not in jauh:
            perlu.append({'kunci': k, 'ukuran': v['ukuran'], 'sebab': 'tidak ada di Cloudflare'})
        elif jauh[k]['ukuran'] != v['ukuran']:
            perlu.append({'kunci': k, 'ukuran': v['ukuran'],
                          'sebab': f"ukuran berbeda ({jauh[k]['ukuran']} vs {v['ukuran']})"})
        else:
            sudah += 1

    # Berkas di salinan yang tidak tercatat (mis. catatan terhapus)
    tercatat = set(berkas)
    for akar, _, nama_nama in os.walk(sasaran):
        for n in nama_nama:
            if n == NAMA_CATATAN or n.endswith('.sementara'):
                continue
            penuh = os.path.join(akar, n)
            kunci = rekat(os.path.relpath(penuh, sasaran))
            if not kunci.startswith(AWALAN) or kunci in tercatat:
                continue
            if kunci not in jauh:
                perlu.append({'kunci': kunci, 'ukuran': os.path.getsize(penuh),
                              'sebab': 'tidak ada di Cloudflare (tak tercatat)'})

    return {'perlu': perlu, 'sudah': sudah, 'sasaran': sasaran}


def pulihkan(sasaran: str, benar_benar: bool = False) -> dict:
    """Kembalikan berkas yang hilang di R2 dari salinan lokal."""
    h = rencana_pulih(sasaran)
    if not h['perlu']:
        print(f"  tidak ada yang perlu dikembalikan ({h['sudah']} berkas sudah cocok)")
        return {**h, 'diunggah': 0, 'gagal': []}

    print(f"  {len(h['perlu'])} berkas perlu dikembalikan:")
    for x in h['perlu'][:30]:
        print(f"    {x['ukuran']//1024:>6} KB  {x['kunci']}")
        print(f"             sebab: {x['sebab']}")
    if len(h['perlu']) > 30:
        print(f"    … dan {len(h['perlu'])-30} lagi")

    if not benar_benar:
        print()
        print('  Ini baru RENCANA — belum ada yang diunggah.')
        print('  Untuk benar-benar mengembalikan, jalankan ulang dengan --jalankan:')
        print(f"      python3 scripts/salin-media.py --pulihkan --jalankan --sasaran {sasaran}")
        return {**h, 'diunggah': 0, 'gagal': []}

    print()
    diunggah, gagal = 0, []
    for x in h['perlu']:
        p = nama_lokal(sasaran, x['kunci'])
        try:
            n = unggah(x['kunci'], p)
            if n != x['ukuran']:
                raise ValueError(f'ukuran tidak cocok saat diunggah: {n} vs {x["ukuran"]}')
            diunggah += 1
            print(f"  ✔ dikembalikan: {x['kunci']}")
        except Exception as e:                      # noqa: BLE001
            gagal.append({'kunci': x['kunci'], 'sebab': str(e)})
            print(f"  ✘ GAGAL {x['kunci']} → {e}")

    return {**h, 'diunggah': diunggah, 'gagal': gagal}


# ────────────────────────────────────────────────────────────
#  Periksa & salin
# ────────────────────────────────────────────────────────────

def periksa(sasaran: str) -> dict:
    """
    Bandingkan R2 dengan salinan lokal. TIDAK mengunduh apa pun.

    Dikembalikan empat kelompok:
      baru      : ada di R2, belum ada di lokal
      berubah   : ada di lokal tapi isinya berbeda (ukuran beda)
      hilang    : ada di lokal, TIDAK ada lagi di R2  ← foto yang hilang!
      utuh      : sudah sama
    """
    jauh = daftar_objek()
    catatan = muat_catatan(sasaran)
    lokal = dict(catatan.get('berkas') or {})

    baru, berubah, utuh = [], [], 0
    kunci_jauh = set()

    for o in jauh:
        kunci_jauh.add(o['kunci'])
        p = nama_lokal(sasaran, o['kunci'])
        ada = os.path.isfile(p)
        if not ada:
            baru.append(o)
            continue
        if os.path.getsize(p) != o['ukuran']:
            berubah.append(o)
            continue
        utuh += 1

    hilang = [{'kunci': k, **v} for k, v in lokal.items() if k not in kunci_jauh]

    return {
        'jauh': jauh, 'baru': baru, 'berubah': berubah,
        'hilang': hilang, 'utuh': utuh, 'sasaran': sasaran,
    }


def salin(sasaran: str, kering: bool = False) -> dict:
    """Unduh yang baru/berubah, lalu simpan catatan. Dikembalikan ringkasannya."""
    h = periksa(sasaran)
    os.makedirs(sasaran, exist_ok=True)

    catatan = muat_catatan(sasaran)
    berkas_catatan = dict(catatan.get('berkas') or {})

    perlu = h['baru'] + h['berubah']
    ditulis, gagal = 0, []

    for o in perlu:
        p = nama_lokal(sasaran, o['kunci'])
        try:
            n = unduh(o['kunci'], p)
            if n != o['ukuran']:
                raise ValueError(f'ukuran tidak cocok: {n} vs {o["ukuran"]}')
            # Periksa isi dengan sidik jari. Kalau tidak diperiksa, salinan yang
            # rusak akan dianggap baik-baik saja sampai benar-benar dibutuhkan.
            if o.get('etag') and len(o['etag']) == 32:
                if md5_berkas(p) != o['etag'].lower():
                    raise ValueError('sidik jari tidak cocok')
            berkas_catatan[o['kunci']] = {
                'ukuran': o['ukuran'],
                'etag': o.get('etag', ''),
                'diubah': o.get('diubah', ''),
                'disalin_pada': datetime.now(timezone.utc).isoformat(),
            }
            ditulis += 1
            print(f"  ✔ {o['kunci']}  ({o['ukuran']//1024} KB)")
        except Exception as e:                      # noqa: BLE001
            gagal.append({'kunci': o['kunci'], 'sebab': str(e)})
            print(f"  ✘ {o['kunci']}  → {e}")

    if not kering:
        catatan['berkas'] = berkas_catatan
        simpan_catatan(sasaran, catatan)

    return {**h, 'ditulis': ditulis, 'gagal': gagal}


def laporkan(h: dict) -> None:
    """Cetak ringkasan yang bisa dibaca saat panik."""
    total_byte = sum(o['ukuran'] for o in h['jauh'])
    print(f"  lokasi salinan : {h['sasaran']}")
    print(f"  di Cloudflare  : {len(h['jauh'])} berkas, {total_byte/1024/1024:.1f} MB")
    print(f"  sudah utuh     : {h['utuh']}")
    print(f"  belum disalin  : {len(h['baru'])}")
    print(f"  perlu disegarkan: {len(h['berubah'])}")
    if h['hilang']:
        print()
        print(f"  ⚠️  ADA DI SALINAN TAPI TIDAK ADA DI CLOUDFLARE: {len(h['hilang'])} berkas")
        for x in h['hilang'][:20]:
            print(f"       {x['kunci']}")
        if len(h['hilang']) > 20:
            print(f"       … dan {len(h['hilang'])-20} lagi")
        print()
        print("  Berkas-berkas itu masih AMAN di salinan ini. Jangan hapus apa pun,")
        print("  dan jangan menjalankan apa pun yang menimpa salinan sebelum")
        print("  memastikan penyebabnya.")


def baca_args(argv):
    sasaran = SASARAN_BAWAAN
    if '--sasaran' in argv:
        i = argv.index('--sasaran')
        if i + 1 < len(argv):
            sasaran = os.path.expanduser(argv[i + 1])
    mode = 'salin'
    if '--periksa' in argv:
        mode = 'periksa'
    if '--daftar' in argv:
        mode = 'daftar'
    if '--pulihkan' in argv:
        mode = 'pulihkan'
    return mode, sasaran, ('--jalankan' in argv)


if __name__ == '__main__':
    if not TOKEN:
        print('Token Cloudflare tidak ditemukan.\n'
              'Simpan sekali saja, lalu tidak akan diminta lagi:\n\n'
              '    mkdir -p ~/.config/sph && chmod 700 ~/.config/sph\n'
              "    printf '%s' 'TOKEN-ANDA' > ~/.config/sph/cloudflare-token\n"
              '    chmod 600 ~/.config/sph/cloudflare-token\n\n'
              'Repositori ini PUBLIK — jangan taruh token di dalam folder proyek.')
        sys.exit(2)

    mode, sasaran, benar_benar = baca_args(sys.argv[1:])

    if mode == 'pulihkan':
        print('Mengembalikan berkas SPH dari salinan lokal ke Cloudflare…')
        print(f'  (hanya awalan "{AWALAN}" — bucket ini dipakai bersama aplikasi lain)')
        print()
        hasil = pulihkan(sasaran, benar_benar)
        print()
        if hasil['gagal']:
            print(f"  {len(hasil['gagal'])} berkas GAGAL dikembalikan.")
            sys.exit(1)
        if hasil.get('diunggah'):
            print(f"  ✔ {hasil['diunggah']} berkas dikembalikan.")
        sys.exit(0)

    if mode == 'daftar':
        catatan = muat_catatan(sasaran)
        berkas = catatan.get('berkas') or {}
        print(f'Salinan di: {sasaran}')
        print(f'  {len(berkas)} berkas, terakhir dijalankan {catatan.get("terakhir_dijalankan") or "(belum pernah)"}')
        for k in sorted(berkas):
            print(f"    {berkas[k]['ukuran']//1024:>6} KB  {k}")
        sys.exit(0)

    if mode == 'periksa':
        print('Memeriksa salinan (tanpa mengunduh)…')
        laporkan(periksa(sasaran))
        sys.exit(0)

    print('Menyimpan salinan luring berkas SPH dari Cloudflare…')
    print(f'  (hanya awalan "{AWALAN}" — bucket ini dipakai bersama aplikasi lain)')
    print()
    hasil = salin(sasaran)
    print()
    laporkan(hasil)
    if hasil['gagal']:
        print()
        print(f"  {len(hasil['gagal'])} berkas GAGAL disalin — jalankan ulang nanti.")
        sys.exit(1)
    print()
    print('  ✔ Salinan lengkap.')
    sys.exit(0)
