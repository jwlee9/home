# Scheduled database check

The GitHub Actions workflow `Scheduler database check` makes three read-only
lookups per day (11:23, 19:23, and 03:23 Korea time). It also supports manual runs.
It becomes active only after the workflow and script reach the default branch.

It uses the public key already shipped with the website. No private database
credentials or service-role keys are needed. It looks up a deliberately nonexistent
slug and recognizes only the exact PostgreSQL `P0002` / HTTP 500 response from
`get_schedule`. This confirms that the database query executed without fetching
participants or creating fake events. Other errors fail the workflow, without
printing response data. Enable GitHub Actions failure notifications to notice them.

This is best-effort activity, not a guarantee against Supabase inactivity pauses.
Supabase does not publish an exact threshold or guarantee that these failed
lookups qualify. Its documentation says a few database requests daily are typically
sufficient. An already-paused project must be resumed manually in Supabase.

GitHub schedules can be delayed or dropped. Public-repository schedules are
disabled after 60 days without repository activity; re-enable the workflow in
Actions if that happens. Do not rely on this for guaranteed rehearsal availability.
Disable this workflow in Actions to stop the checks.

References:
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
