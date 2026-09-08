# Production Application Access Audit

**Phase:** 1 Recovery — application capability audit  
**Date:** 2026-08-19  
**Repository:** `imangoess78/SPH-Management-System-Belift`  
**Production modified:** No

## Executive result

The production application has an authenticated browser Supabase client and a Supabase Edge Function with privileged runtime access. However, the repository does **not** show an existing backup/export feature, a server-side backup endpoint, or a storage listing/download backup workflow.

The frontend client is subject to the currently authenticated user's Supabase Auth identity and RLS. It cannot be assumed to read all production data merely because an admin UI exists.

## Client configuration

`src/integrations/supabase/client.ts` creates the client with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

The client persists Auth sessions in browser `localStorage`. No service-role key is used in frontend code.

## Table access map from source code

| Table | Operations found | Authentication | RLS/role dependency | Backup implication |
|---|---|---|---|---|
| `profiles` | SELECT current profile; UPDATE own profile | Authenticated | Own row; admin may read all according to migrations | Admin-wide export is not implemented |
| `user_roles` | SELECT role; INSERT self-role in auth flow | Authenticated | Own role/admin visibility; repository history includes self-staff insertion policy | Not a complete role export feature |
| `sph` | SELECT, INSERT, UPSERT, UPDATE, DELETE | Authenticated | Owner; admin/staff read rules evolved in migrations; delete rules exist | User sees only permitted rows; no export endpoint |
| `design_items` | SELECT, INSERT, UPDATE, DELETE | Authenticated | Current migrations intend authenticated read and admin/staff write | No table export feature |
| `sales` | SELECT, INSERT, UPDATE, DELETE | Authenticated | Authenticated read; admin/staff write | No table export feature |

The exact live policy state must still be verified from the production database or authenticated API responses. Repository migrations are not proof of the current production state.

## Supabase Auth access

Found in `src/hooks/useAuth.tsx`, `LoginPage`, `SignupPage`, and `SettingsPage`:

- session listener
- `getSession()`
- `getUser()`
- password sign-in
- signup
- sign-out
- password update/re-authentication

The application does not contain an Auth user export capability. It does not expose password hashes, refresh tokens, or session credentials, and none should be added to a backup.

`profiles` is not a replacement for Supabase-managed `auth.users`.

## Storage access map

Buckets found in source/migrations:

- `design-images`
- `signatures`

Frontend operations found:

- upload
- `getPublicUrl`

Not found in application source:

- authenticated storage `.list()` inventory
- storage `.download()` backup workflow
- object checksum generation
- object manifest generation
- admin-only storage backup endpoint

The migrations define public-read policies for these buckets and authenticated upload/update/delete policies. Actual live policy state and object inventory remain unverified.

## Admin capability assessment

The source defines role values:

- `admin`
- `staff`

The UI reads the current user's role and conditionally exposes management functionality. Repository RLS migrations indicate admin-wide access for:

- `profiles` — SELECT all
- `user_roles` — SELECT all
- `sph` — SELECT all; admin DELETE policy also exists
- `design_items` — admin write access
- `sales` — admin/staff write access

This means an authenticated production admin may be able to read a broad subset through existing UI/API calls, but the source does not prove that every row and every relationship can be exported. No backup action was executed.

## Server-side / privileged access audit

Found:

`supabase/functions/seed-users/index.ts`

It creates a Supabase client using runtime variables:

- `SUPABASE_URL` — referenced, value **NOT FOUND in audited repository source**
- `SUPABASE_SERVICE_ROLE_KEY` — referenced, value **NOT FOUND in audited repository source**

The function uses privileged Auth admin user creation and writes `user_roles`/`profiles`. It is a provisioning function, not a backup function. No Vercel server/API route or server-side backup client was found in the repository.

No privileged credential was printed, copied, or used.

## Backup strategy decision

- Existing authenticated Supabase client: **PARTIAL capability only**
- Existing server-side Supabase client: **FOUND for seed-users, but not backup-capable**
- Existing admin functionality: **PARTIAL data-management access, no backup/export feature**
- Existing safe application-level backup: **NOT IMPLEMENTED**

## Security and integrity limitations

1. Browser export would be constrained by the logged-in user's RLS permissions.
2. Admin UI visibility cannot replace server-side role verification for a new backup endpoint.
3. Storage public URLs do not provide a complete object inventory or checksum-safe backup.
4. Auth users cannot be reconstructed from `profiles` alone.
5. No row counts from production were generated; inventing them would violate the migration rules.
6. Adding a backup feature to the live production application would change production behavior and is explicitly out of scope for this audit.

## Conclusion

The application can potentially support a future **authorized admin-scoped export**, but no existing application functionality currently provides a complete, verifiable backup of the required database tables, Auth metadata, and Storage objects.

No production data was modified.
