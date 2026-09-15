# Scheduler backend

The production scheduler uses Supabase RPCs. GitHub Pages hosts only the static interface; pushing this repository does **not** update the database.

## Install / upgrade

1. Run `schema.sql` in the project's SQL Editor. It upgrades existing tables in a transaction; existing schedules, links, passwords and tokens remain intact. Requires pgcrypto in Supabase's `extensions` schema.
2. Run `security-tests.sql`. Its fixture schedules and responses are rolled back. A failed assertion aborts the transaction; do not deploy until resolved.
3. Configure `static/schedule/config.js` with the project URL and **publishable/anon key only**, never a secret/service-role key. Update the `connect-src` origin in `static/schedule/index.html` if changing projects.
4. Run `node --test tests/*.test.cjs`, then `SCHEDULER_LIVE_TESTS=1 node --test tests/live-access.test.cjs` for non-persistent API checks.
5. Build with Hugo, preview, then push. GitHub Actions runs the JS tests before publishing.

The separate local design-preview directory is not production code or a production backend test.

## Access model

- Anyone possessing a participant link can read all participant names and times. Links are not accounts or verified identities. Names are unique per event, not globally. Use distinguishable names for namesakes.
- Editing requires the response's random browser token or its optional password. Knowing a name alone never grants edit access. Passwords use bcrypt; hashes and edit tokens are excluded from public reads.
- Password recovery allows 10 attempts per response per five-minute window, shared by both authentication and save endpoints. A known browser token still works during cooldown. Failed attempts return a non-2xx HTTP status **without raising a SQL exception**, preserving the counter.
- No password minimum, by product choice; a strong, unique password is strongly recommended. The 72-UTF-8-byte maximum avoids bcrypt truncation. No email/password-reset facility exists. Without a password, losing browser storage requires organizer-assisted removal/re-entry.
- The private organizer link is a bearer credential. Share only the participant link. Organizer tokens stay in the URL fragment/browser storage, never in public schedule reads. There is no organizer recovery or token rotation UI.
- Tables are inaccessible to `anon` and `authenticated`; public operations go through five explicitly granted RPCs with fixed empty search paths and explicit schema references. RLS remains enabled.
- New share links have 128 bits of randomness. Older 48-bit links remain valid.
- New events: at most 31 dates, complete 15/30/60-minute intervals. Up to 200 participants. The API validates dates, colors, time zones, slot membership, duplicates and payload counts.

## Operational limits / remaining risks

This is a small-group scheduling tool, not a hardened public SaaS or a place for sensitive schedules. Optional weak passwords remain guessable. Shared browser storage grants access to whoever uses that browser. Same-participant concurrent edits are last-write-wins; avoid editing the same response on two devices at once.

The application-level password cooldown is not a global/IP rate limiter: an attacker can temporarily lock password recovery, create spam events, fill a shared event with fake participants, or send high-volume requests. Close responses after collecting times, keep organizer links private, and add gateway-level rate limits/CAPTCHA before broad anonymous promotion. RLS is authorization, not DDoS protection.

Arrange database backups/export and check Supabase quota/availability before important use. No backup schedule, automatic retention, uptime monitoring, or disaster recovery was configured by this code change. The organizer can remove responses; full event deletion currently requires the project administrator.

## Review references

- [Supabase database-function security](https://supabase.com/docs/guides/database/functions)
- [Supabase API security](https://supabase.com/docs/guides/api/securing-your-api)
- [PostgREST transaction status overrides](https://docs.postgrest.org/en/stable/references/transactions.html)
- [PostgreSQL pgcrypto password hashing](https://www.postgresql.org/docs/18/pgcrypto.html)
