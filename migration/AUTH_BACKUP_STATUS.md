# AUTH_BACKUP_STATUS

**Status:** NOT RECOVERED  
**Date:** 2026-08-19  
**Production modified:** No

The application does not contain an Auth backup/export mechanism.

The following were not accessed or exported:

- Supabase `auth.users` complete dataset
- Password hashes
- Session tokens
- Refresh tokens
- Recovery tokens
- Service credentials

`profiles` and `user_roles` do not replace Supabase-managed `auth.users`. Any future authentication migration requires a separately authorized strategy such as user re-authentication or password reset.
