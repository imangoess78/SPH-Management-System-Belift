# Cloudflare D1 Import Preparation

**Status:** PREPARED FOR DESIGN ONLY — NO D1 CREATED, NO IMPORT EXECUTED

## Available datasets

- `profiles`: 1 row
- `user_roles`: 1 row
- `sph`: 9 rows
- `design_items`: 75 rows
- `sales`: 7 rows

## Recommended D1 representation

Preserve original UUIDs and timestamps. Keep JSONB-like fields as JSON text so the generator data is not flattened or altered prematurely:

- `sph.items`
- `sph.specs`
- `sph.terms`
- `sph.payments`
- `sph.designs`

Use SQLite-compatible scalar columns for searchable fields and JSON text for nested fields. Preserve `NULL` as SQL `NULL`, not the strings `"null"` or `""`.

## Relationships to preserve

- `profiles.user_id` → Supabase Auth user identity (Auth dataset unavailable)
- `user_roles.user_id` → Supabase Auth user identity (Auth dataset unavailable)
- `sph.user_id` → Supabase Auth user identity (Auth dataset unavailable)
- `sph` design references → `design_items` where present in JSON/state
- `sales` signature URLs → Supabase Storage objects (binary objects unavailable)

## Import blockers

1. Auth users are unavailable, so login identity cannot yet be migrated 1:1.
2. Storage binaries are unavailable, so image/signature assets cannot yet be restored to R2.
3. The source migration history must be reconciled with the actual exported row shapes before writing D1 SQL.
4. No D1 import should run until schema, null handling, JSON encoding, and IDs are reviewed.

## Required future sequence

1. Generate a schema from the actual migration files and backup column shapes.
2. Validate every JSON field and numeric value.
3. Generate deterministic D1 SQL or NDJSON import files.
4. Import into a disposable D1 staging database.
5. Compare row counts, IDs, timestamps, JSON hashes, and relationships.
6. Only after review, import into the intended target.

**Production modified:** NO  
**D1 created:** NO  
**D1 import:** NO
