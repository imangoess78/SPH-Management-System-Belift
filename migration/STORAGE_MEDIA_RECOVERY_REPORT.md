# Storage Media Recovery Report

**Status:** COMPLETE  
**Source:** Supabase public Storage object URLs referenced by validated production database backup  
**Target:** Cloudflare R2 bucket `belift-media`  
**R2 prefix:** `recovery/2026-08-19/`  
**Production modified:** NO

## Upload result

- `design-images`: 74 uploaded
- `signatures`: 1 uploaded
- Total objects: 75
- Failed: 0
- Total bytes: 49,881,401
- Object paths preserved under the recovery prefix.

## Integrity

Every downloaded object received a SHA-256 checksum before upload. The media manifest records the source URL, target R2 key, content type, byte size, and checksum.

A signature object was downloaded back from R2 and compared with the original local checksum:

- Original SHA-256: `4f19159777adf9b05c2de167b52b574e8c704597527d95ca6d9b15378c1cad91`
- R2 downloaded SHA-256: `4f19159777adf9b05c2de167b52b574e8c704597527d95ca6d9b15378c1cad91`
- Result: MATCH

## Manifest

`migration/MEDIA_BACKUP_MANIFEST.json`

- Objects: 75
- Failed: 0
- Manifest SHA-256: `903d14d73c540e2dbcf5564830f72eb556bf90d8fed6440b68de85110f5808e1`

## Important security note

The target bucket is an existing R2 bucket. Objects were uploaded under a dedicated recovery prefix; no existing objects were deleted or overwritten intentionally. Keep the bucket private and do not expose this prefix through a public URL until access controls are designed.
