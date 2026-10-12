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
