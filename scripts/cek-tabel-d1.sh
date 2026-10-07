#!/usr/bin/env bash
# Periksa tabel apa saja yang ada di D1 produksi.
# Dipakai untuk memastikan migrasi benar-benar dijalankan, bukan sekadar
# berkas .sql ada di repo.
set -u
cd /home/ubuntu/SPH-Management-System-Belift

npx wrangler d1 execute sph-management-db --remote --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name" 2>/dev/null \
  | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)[0]['results']
    nama=sorted(r['name'] for r in d)
except Exception as e:
    print('GAGAL membaca daftar tabel:', e); sys.exit(1)

print('Tabel di D1 produksi (%d):' % len(nama))
for n in nama: print('  -', n)

wajib_notif=['app_notifikasi','app_notifikasi_baca']
wajib_sandi=['app_reset_kode','app_percobaan','app_keamanan_riwayat']
print()
for label,grup in [('NOTIFIKASI',wajib_notif),('GANTI PASSWORD',wajib_sandi)]:
    hilang=[t for t in grup if t not in nama]
    print(('  OK   ' if not hilang else '  HILANG ') + label +
          ('' if not hilang else ' -> ' + ', '.join(hilang)))
"
