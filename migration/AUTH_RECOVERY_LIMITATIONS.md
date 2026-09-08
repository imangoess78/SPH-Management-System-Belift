# Auth Recovery Limitations

**Phase:** 1 Recovery — application capability audit  
**Status:** LIMITATIONS IDENTIFIED  
**Production modified:** No

## Findings

The application uses Supabase Auth for login, signup, sessions, sign-out, and password changes. It can read the currently authenticated user's identity/session through the normal Supabase client, but the repository contains no authorized Auth export mechanism.

The application does not provide a complete export of:

- Supabase-managed `auth.users` metadata
- authentication providers
- password hashes
- refresh tokens
- session tokens
- recovery credentials

## Migration consequence

`profiles` and `user_roles` cannot be treated as a complete replacement for `auth.users`. Existing user IDs are relationship-critical, but password hashes and session credentials must not be copied through an application backup.

A future authentication migration requires a separately authorized strategy, such as re-authentication, password reset, or another officially supported migration process. This audit does not select or execute that strategy.

## Safety

No Auth credential, password hash, refresh token, or session token was accessed, exported, displayed, or modified.
