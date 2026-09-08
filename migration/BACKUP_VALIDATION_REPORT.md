# Emergency Backup Validation Report

**Source file:** `production-backup-2026-08-19T05-21-13-892Z.json`  
**Backup status:** COMPLETE (per manifest)  
**Validation date:** 2026-08-19

## Integrity

All five exported tables passed manifest verification:

- `profiles`: 1 row — checksum matches
- `user_roles`: 1 row — checksum matches
- `sph`: 9 rows — checksum matches
- `design_items`: 75 rows — checksum matches
- `sales`: 7 rows — checksum matches

**Total exported rows:** 93

## Primary/identifier checks

- No duplicate `id` values detected in any table.
- `sph.nomor_sph` values are unique across the 9 exported documents.
- `sph.user_id` repeats across records as expected for ownership; this is not a duplicate primary key.
- All inspected IDs are non-null.

## Limitations

- `auth.users`: NOT BACKED UP
- Password hashes/session/refresh/recovery tokens: NOT BACKED UP
- Storage objects: NOT BACKED UP
- `design-images` and `signatures` URLs may exist in row data, but the binary files were not exported.
- The backup reflects data visible to the authenticated production session and must not be assumed to contain rows hidden by RLS.

## Safety

No production data was modified during validation. No import was executed.
