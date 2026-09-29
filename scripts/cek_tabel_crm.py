#!/usr/bin/env python3
"""Cek tabel referensi CRM tetap utuh setelah hapus data demo."""
import json, subprocess

DB = 'sph-management-db'
tabel = ['crm_ref_kanal', 'crm_ref_sales', 'crm_ref_diskon', 'crm_ref_status',
         'crm_leads', 'crm_lead_riwayat', 'crm_dokumen', 'crm_biaya_iklan']

print("TABEL CRM — sph-management-db (live)")
print("=" * 44)
for t in tabel:
    p = subprocess.run(
        ['npx', 'wrangler', 'd1', 'execute', DB, '--remote', '--json',
         '--command', f'SELECT COUNT(*) AS n FROM {t};'],
        capture_output=True, text=True, timeout=180, cwd='/home/ubuntu/SPH-Management-System-Belift')
    out = p.stdout
    i = out.find('[')
    if i < 0:
        print(f"  {t:20} : ERROR -> {out[:80]}")
        continue
    try:
        n = json.loads(out[i:], strict=False)[0]['results'][0]['n']
    except Exception as e:
        print(f"  {t:20} : parse error {e}")
        continue
    jenis = 'referensi' if t.startswith('crm_ref') else 'transaksi'
    tanda = '✅ utuh' if (t.startswith('crm_ref') and n > 0) or (not t.startswith('crm_ref') and n == 0) else '⚠️'
    print(f"  {t:20} : {n:>3} baris  ({jenis})  {tanda}")
