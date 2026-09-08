# Backup Capability Report

**Phase:** 1 Recovery — production application capability audit  
**Date:** 2026-08-19  
**Production modified:** No

## Decision

**OPTION B — BACKUP PARTIALLY POSSIBLE**

The existing authenticated application client may read some production records for the currently authenticated user, and repository RLS policies indicate broader access for admin/staff in selected tables. But the current application has no complete backup/export workflow and no storage inventory/download backup function.

Therefore a complete production backup cannot be claimed or executed from existing functionality.

## Database tables

Known tables:

- `profiles` — authenticated user profile access; admin-wide SELECT is described by repository migrations.
- `user_roles` — authenticated own-role access; admin-wide SELECT is described by repository migrations.
- `sph` — authenticated CRUD constrained by owner/admin/staff policies.
- `design_items` — authenticated SELECT; admin/staff writes according to current migration intent.
- `sales` — authenticated SELECT; admin/staff writes.

**Actual production row counts:** UNAVAILABLE. No numbers were fabricated.

## Storage buckets

Known buckets:

- `design-images`
- `signatures`

The application currently uploads files and creates public URLs. It does not implement complete object listing, download export, manifest creation, or checksum verification.

**Actual object counts/sizes/checksums:** UNAVAILABLE.

## Admin access

Roles found:

- `admin`
- `staff`

Repository migrations describe admin-wide read access for profiles, roles, and SPH, and admin/staff management access for design items and sales. Live production policies were not queried because no authorized authenticated session was supplied or used.

## Server-side access

The repository contains `supabase/functions/seed-users/index.ts`, which references a runtime service-role key. It is an existing privileged provisioning function, not a backup/export function. No Vercel server-side backup route was found.

**Service-role credential value:** NOT FOUND in audited source; not printed or accessed.

## Recommended safe method

1. Do not build or deploy a backup feature yet.
2. Obtain explicit authorization for a staging/admin-only export workflow.
3. If approved, implement it outside the current production deployment first.
4. Enforce server-side admin verification, rate limiting, audit events, pagination, row counts, null preservation, UUID/timestamp preservation, and per-object checksums.
5. Export Auth only as non-sensitive metadata; never export password hashes, tokens, or sessions.
6. Export Storage through an authorized server-side listing/download mechanism, preserving object keys and metadata.
7. Validate the resulting manifests before any D1/R2 work.

## Security risks

- Frontend credentials and browser sessions are not suitable for unrestricted backup.
- RLS may omit rows depending on the current user's role and live policy state.
- Public URLs do not prove complete storage access.
- A backup endpoint using service-role access would be highly sensitive and must not be exposed to the browser.
- The tracked public `.env` remains a separate credential hygiene issue.

## Final scope result

**No production data was modified.**  
**No backup was generated.**  
**No production behavior was changed.**
