# Supabase development workflow

Target project: `qucyaothykoxwluaezwh`.
Run commands from the repository root. The CLI version is pinned in package.json and package-lock.json.

## Current setup status

- CLI and project commands are installed.
- Cloud account login and project linking are complete on this Windows user account.
- WSL 3.0.1 and Docker Desktop 4.94.0 are installed and the Docker engine was verified running.
- Baseline `20261008155340_initial_schema.sql` was captured and replayed successfully in a local shadow database on 2026-10-08. It includes 5 public tables, 4 SQL functions and 11 RLS policies.
- The baseline is recorded as applied in the cloud migration history. Local and remote histories match, and `npm run db:plan` reports that the remote database is up to date.
- Existing SQL files are historical references, not pending migrations.

The Publishable key in `vocab-app/.env.local` is for the frontend. It cannot deploy functions or manage the database schema. Do not put account access tokens, database passwords or service-role/secret keys in frontend files or Git.

## One-time setup

```powershell
npm ci
npm run supabase:login
npm run supabase:link
npm run db:migrations
```

Finish login in the official Supabase browser flow. Let the CLI store credentials in its native credential storage. If the CLI asks for a database password, enter it interactively in the local terminal, not in chat or command arguments.

The baseline has already been established for this project. On this machine, use `npm run db:migrations` and `npm run db:plan` to verify it before future changes. Do not create another initial baseline or mark it unapplied.

On a new clone, install dependencies, log in and link the same cloud project; the baseline is already in Git once these changes are committed. If someone modifies cloud schema directly later, capture and review the difference with `npm run db:pull -- describe_remote_change`. Standard `db pull` needs a working Docker daemon.

### Windows runtime

Docker Desktop is installed under `%LOCALAPPDATA%\Programs\DockerDesktop`. WSL installation and Docker engine startup have been verified on this machine. These commands can check the runtime:

```powershell
wsl --version
docker info
```

Reopen the development app/terminal if it does not see the new Docker PATH. If Docker reports a WSL or virtualization problem later, inspect the actual error before changing Windows features or BIOS settings.

Docker does not need to stay running for normal frontend development, `db:plan`, `db:push` or `functions:deploy` (which uses API bundling). Start it for local Supabase/database tests and schema pulls/diffs. The WSL welcome window can be closed. For mobile-assigned work, keep the host awake, online and the desktop app running; Docker can be started when the task needs it.

Baseline setup only replayed SQL in a local shadow database and recorded cloud migration metadata. Existing cloud application tables and data were not recreated or modified.

Do not reapply the files in `supabase/sql/` or the old `vocab-app/migration_*.sql` files to initialize migrations. Do not use remote `db reset` to establish a baseline.

The initial pull also completed its schema diff against the local shadow database. Keep the baseline migration as the existing schema snapshot and put all future changes in new migration files.

## Database changes

```powershell
npm run db:new -- add_word_notes
# Edit the new timestamped SQL file under supabase/migrations/.
npm run db:plan
npm run db:push
```

`db:plan` is a dry run: it shows pending files but does not validate that their SQL will execute successfully. Test changes on a development database/local Supabase before applying them to live data. `db:push` checks the linked project, requires a baseline migration, shows the dry run first, then applies pending migrations and records their history.

SQL functions/RPCs, table changes and RLS policies belong in migration files. Keep published migration files unchanged; make corrections in a new migration.

## Edge Functions

Edit `supabase/functions/ai-dictionary/`, run appropriate tests, then:

```powershell
npm run functions:deploy
```

This uses server-side bundling (`--use-api`), so deploying the function does not need Docker. It deploys only `ai-dictionary` to the configured cloud project; it does not deploy the frontend. The function validates session JWTs via Supabase Auth, including anonymous users, before reading its cache or calling Groq. Its `verify_jwt = false` setting delegates verification to that handler.

## Assigning work from a phone

Pair ChatGPT mobile with the desktop host separately. Keep the host awake, online and the desktop app running. Open this repository as the task project.

Example task: "Add a notes field for vocabulary. Inspect the existing schema and migrations, implement the frontend and migration, test on the development database, show the migration plan, and apply it to the named target environment."

Once account access and the baseline are configured on the host, Codex can run these commands there. Choose the target environment explicitly for database changes; deleting data or changing a live schema needs the corresponding task authorization. GitHub push alone does not deploy database migrations or Edge Functions.

## Daily review cloud sync

`20261013001000_daily_review_cloud_sync.sql` adds account-owned `review_preferences`
and `review_days` tables and the `sync_daily_review` RPC. It uses `auth.uid()` with
security-invoker execution and owner-only RLS, including valid anonymous sessions.
The RPC locks the account preferences row, unions each day's word IDs, and preserves
already earned check-ins. A merged total can earn a check-in even if neither device
reached the goal alone. `20261013002800_preserve_daily_review_targets.sql`
preserves each day's target and re-evaluates incomplete historical days after
delayed offline uploads, preventing missed check-ins after midnight. The first device establishes the account's calendar timezone;
other devices use that timezone for daily progress and streaks.

The frontend keeps a per-account cache and pending goal edit in localStorage for
offline retry. Existing per-account browser history is imported on initial sync;
guest history is not silently assigned to a different signed-in account. Cached
goals initialize an absent cloud profile, but never overwrite an existing cloud
goal unless the user explicitly changes the setting. Refresh occurs on focus,
network reconnection, manual retry, and every 30 seconds. Subsequent syncs upload
only changed days. Users must sign in to the same permanent account on each device;
separate anonymous sessions are separate accounts.

`supabase/tests/daily_review_cloud.sql` is a rollback-only integration test for a
local/development database. Supply `user_a` and `user_b` as psql variables for two
disposable Auth users with no existing review history; user A needs at least five
library entries. It checks merges, goal changes, future-date rejection, owner-only
RLS and rejection of unauthenticated RPC calls. Do not run it against real users.

The database migration and frontend deployment remain separate steps.

## Background daily review reminders

The frontend setting lives under Settings → Review. Each browser/account gets its
own opt-in subscription, daily time, IANA timezone, and notification language.
Anonymous Auth sessions work too. Signing out unsubscribes the browser; switching
accounts detaches the previous account's subscription. Other devices opt in separately.

`20261024100000_review_reminders.sql` stores subscriptions behind owner-read RLS;
only the server can write credentials or delivery state. The service-only claim
RPC skips completed check-ins using the account's review timezone, claims up to
50 due devices with row locks and five-minute leases, and suppresses same-day
duplicates. It catches up for up to 60 minutes on the same local day and retries
transient failures up to three times. A delivery timeout can be ambiguous; browser
notification tags collapse replacements, but absolute exactly-once delivery is
not guaranteed. HTTP 404/410 removes expired subscriptions.

`20261024100100_schedule_review_reminders.sql` installs a minutely pg_cron/pg_net
job. Its credential is generated directly in Vault. The Edge Function validates
this credential through a service-only RPC, or validates a user's JWT through
Supabase Auth before settings/test actions. It never accepts a user JWT for a
dispatch action. Push destinations are restricted to browser push services, and
redirects are rejected. Test pushes have a per-subscription one-minute cooldown.

Deployment is separate from implementation. After verifying CLI login/link/history
and testing the migrations, deploy all three parts to make reminders available:

```powershell
npm run reminders:keys
npm run reminders:secrets
npm run functions:deploy:reminders
npm run db:plan
npm run db:push
# Deploy the frontend using the project's normal Vercel workflow.
```

The setup script creates `.env.review-push.local` (ignored) without printing the
private key, and preserves it on reruns. Keep a private backup; rotating VAPID keys
invalidates existing subscriptions. The contact URL can be changed in that ignored
file if the deployment's public support URL changes. No push secret belongs in a
VITE environment variable. The scheduler targets project `qucyaothykoxwluaezwh`.

Production rollout completed on 2026-10-24: both reminder migrations and the
`review-reminders` function are deployed, VAPID secrets are configured, and the
frontend is live at `https://spaced-vocabulary.vercel.app`. The minutely cron job
is active. A real pg_net call using the Vault credential returned HTTP 200 with
an empty queue. Live API checks verified anonymous Auth, configuration reads,
disabled reminder save/read/delete, and rejection of unauthenticated/user-dispatch
requests. The disposable smoke-test account was deleted. The production UI bundle
and exact service worker file were verified over HTTPS. Each user must still
opt in on their own device and send a test notification to verify OS delivery.

Vercel production deployments triggered by GitHub build only committed files.
Keep the complete reminder frontend, service worker, backend sources, and applied
migrations in Git even when they were originally deployed directly from the CLI.
Before pushing `main`, confirm the commit includes all features already running
in production. After deployment, verify both the reminder settings and quiz are
present and `/review-sw.js` returns JavaScript matching the tracked file.

Validate frontend tests/build as described above. For the Edge Function:

```powershell
deno check --config supabase/functions/review-reminders/deno.json supabase/functions/review-reminders/index.ts
deno test --allow-env --allow-read --config supabase/functions/review-reminders/deno.json supabase/functions/review-reminders/index_test.ts
```

`supabase/tests/review_reminders.sql` is a rollback-only PostgreSQL test with two
disposable Auth accounts (`user_a`/`user_b` psql variables). It checks claims,
completion skips, leases, retry limits, daily deduplication, timezones, expiry,
disabled/future schedules, owner-read RLS and forbidden client writes/RPC calls.
It does not exercise actual pg_cron/pg_net extensions or a real device delivery.

Browser push requires HTTPS and notification permission. On iOS/iPadOS 16.4+,
install the site on the Home Screen and enable notifications from that app.
Push can arrive while the page is closed; OS settings, network availability and
desktop browser background-process settings can delay or prevent delivery.
Clicking a notification opens `/?review=daily`, or navigates an existing app window
to that URL and focuses it. The service worker handles push only; it does
not cache or serve application requests.

## Streak protection and recovery

`20261013010000_streak_protection_and_recovery.sql` adds server-owned protection
and recovery fields. Each account gets two automatic protections per calendar
month, with no rollover. Only one missed day immediately after a real check-in
can be protected; shields cannot chain consecutive missed days. Protection starts
at feature activation, and a genuine late completion supersedes the shield and
returns that month's allowance. Protected days bridge streaks but never increase
actual study/check-in totals or add a study day to the streak length.

After at least three missed days since the last real check-in, today's recovery
mode offers a five-word target (or the smaller library size), pauses automatic new
words, and retains the permanent goal. Recovery choices are per-day, cloud-shared,
and queued offline with the account calendar date, so yesterday's choice cannot
change tomorrow's mode. Users can opt out for today or voluntarily select a gentler
five-word day; extra practice remains available.

The public `sync_daily_review` wrapper is security-definer with an explicit
`auth.uid()` guard, empty search path, and user-filtered queries. Its original
merge implementation is renamed `sync_daily_review_base` and is no longer directly
callable by clients. Column grants prevent clients from allocating protection or
changing server-owned recovery fields.
`20261013010200_lock_review_support_history.sql` also removes the default client
DELETE/TRUNCATE grants so monthly protection accounting cannot be erased through
direct table requests; server-side Auth account deletion still cascades. Existing four-argument RPC clients remain
compatible with the fifth optional `p_recovery_choice` argument.

Run `supabase/tests/streak_protection_recovery.sql` on the disposable development
users described above to verify monthly caps, refunding late check-ins, forbidden
client writes, recovery completion and opt-out persistence. All fixtures roll back.
