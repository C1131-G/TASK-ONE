# Operations

How to build, deploy, back up and restore Taskora when it is self-hosted with Docker. The README covers local development.

## Images

The `Dockerfile` has two targets built from one dependency install:

| Target | Contents | Runs |
| --- | --- | --- |
| `runner` (default) | `.next/standalone`, `.next/static` and `public` only | `bun server.js` on port 3000, as the `bun` user |
| `worker` | Source and full dependencies (including the Prisma CLI) | `scripts/run-worker.ts`, or `bun run db:migrate` |

The `runner` image declares a `HEALTHCHECK` against `GET /api/health`, the readiness check: it returns 503 when the database (`SELECT 1`) or, when S3 is configured, the private bucket (`HeadBucket`) does not answer within two seconds. `GET /api/health/ready` is the same check. `GET /api/health/live` is the liveness check: it touches no dependency and answers 200 while the process serves requests, so point restart policies at it and traffic routing at readiness. Neither response carries error details; failures are logged.

### Data retention

The daily maintenance run enqueues `maintenance.purge-expired-data`, which deletes, in batches of 5,000 rows: completed jobs older than 14 days, dead jobs older than 30 days, push delivery records older than 30 days, finished webhook delivery logs older than 30 days (pending and retrying deliveries are kept), automation run logs older than 30 days, GitHub delivery ids older than 30 days (the replay guard for the GitHub integration; they follow the same override as webhook deliveries), sent-email receipts older than 90 days (the duplicate-send guard for instant mail and the daily digest), expired idempotency keys, sessions and verification tokens, and rate-limit counters idle for a day. Override the windows with `RETENTION_COMPLETED_JOB_DAYS`, `RETENTION_DEAD_JOB_DAYS`, `RETENTION_PUSH_DELIVERY_DAYS`, `RETENTION_WEBHOOK_DELIVERY_DAYS` and `RETENTION_AUTOMATION_RUN_DAYS` and `RETENTION_EMAIL_DELIVERY_DAYS` (whole days). Audit events are never purged by this job; they are the compliance record and need an explicit retention decision.

### Server Actions encryption key

Next.js embeds `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` into the build output, so the key is a **build input**. Pass it as a BuildKit secret, never as a build `ARG` (arguments are stored in the image history):

```bash
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(openssl rand -base64 32)"   # once; store it in your secret manager
docker build --secret id=next_server_actions_encryption_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY -t taskora-app .
docker build --target worker -t taskora-worker .
```

The build fails if the secret is missing. Every replica must run an image built with the **identical** key, and the key should stay the same across releases; otherwise a Server Action posted to a replica built with another key fails with "Failed to find Server Action". `docker compose build` reads the key from the environment or `.env` through the `secrets:` entry in `docker-compose.yml`.

### Running more than one app replica

Each replica keeps its own Next.js cache, so `updateTag` from one replica does not invalidate the cached reference data (company settings, team summaries) held by another. Until a shared `cacheHandlers` backend is configured, run one app replica, or accept that cached reference data can be stale on other replicas for up to its `cacheLife` window.

## Production compose

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile setup run --rm migrate
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Naming both files skips `docker-compose.override.yml`, which publishes development ports. In production:

- Postgres and MinIO publish **no** host ports; only containers on the compose network reach them.
- The app binds to `127.0.0.1:${APP_PORT:-3000}`. Put a reverse proxy (nginx, Caddy, Traefik) on the same host to terminate TLS, cap request body size and rate-limit before traffic reaches Next.js.
- The proxy must overwrite, not append to, the client IP header it forwards. Configure the app's trusted client-IP header (`TRUSTED_IP_HEADER`) to that header name so sign-in rate limits key on the real client and not on the proxy.
- Browsers upload and download files directly against `S3_PUBLIC_ENDPOINT` with signed URLs. Prefer managed S3-compatible storage. If you keep MinIO, attach the reverse proxy to the compose network and route a storage hostname to `minio:9000`; do not publish MinIO's port.
- The prod overlay refuses to start without real values for the database password, MinIO root credentials, S3 keys, public URLs and trusted origins, so local defaults cannot leak into production.

Run migrations once per release, from the `migrate` service or a CI deploy step, before the new app version takes traffic. Never run them from each replica. Run `bun run db:verify` afterwards.

## Backups

### Database

Choose one:

- **Managed Postgres (preferred).** Turn on point-in-time recovery (PITR) with at least 7 days of WAL retention, plus the provider's daily snapshots. PITR covers "restore to just before the bad deploy"; snapshots cover loss of the instance.
- **Self-hosted Postgres in compose.** Run `docker/backup.sh` from the project directory on a schedule. It runs `pg_dump --format=custom` inside the `postgres` container, checks the dump with `pg_restore --list`, writes `backups/taskora-<UTC timestamp>.dump` with owner-only permissions, and deletes dumps older than `BACKUP_RETENTION_DAYS` (default 14).

  ```cron
  # Every 6 hours; the host keeps 14 days locally.
  0 */6 * * * cd /srv/taskora && BACKUP_DIR=/var/backups/taskora docker/backup.sh >> /var/log/taskora-backup.log 2>&1
  ```

  Set `BACKUP_DATABASE_URL` to dump a database reachable from the host instead (requires a local `pg_dump` of Postgres 18 or newer).

Local dumps die with the host. Copy each dump off-host, for example to a separate bucket with `aws s3 cp`, and keep 30 daily plus 12 monthly copies there. Encrypt that bucket at rest and give the backup job write-only credentials.

### Object storage

Uploaded files live only in the S3 bucket; the database holds their keys.

- Enable **bucket versioning** so an overwritten or deleted object can be recovered (`mc version enable local/taskora-private` on MinIO, or the provider console).
- Add a **lifecycle rule** that expires non-current versions after 30 days and aborts incomplete multipart uploads after 1 day, so versioning does not grow storage without bound.
- For disaster recovery, replicate the bucket to a second region or provider (`mc mirror --watch`, or provider replication). Snapshot the MinIO volume if MinIO is the only copy.

A database restored to time T references objects that existed at T. Keep non-current object versions at least as long as the oldest database backup you might restore.

### Secrets

Back up `.env` (or the secret manager entries) separately from the data. A database restore is useless without `BETTER_AUTH_SECRET`, and Server Actions break across releases without the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.

## Restore drill

Run this quarterly, and after any change to the backup job. Record the date, dump name and time to restore.

1. Pick the newest off-host dump and copy it to the drill machine.
2. Start an empty Postgres 18: `docker run -d --name taskora-restore -e POSTGRES_PASSWORD=drill -p 127.0.0.1:5499:5432 postgres:18-alpine`.
3. Restore: `docker exec -i taskora-restore pg_restore -U postgres --create --no-owner -d postgres < taskora-<timestamp>.dump`.
4. Verify the schema matches the release that took the dump: `DATABASE_URL=postgresql://postgres:drill@127.0.0.1:5499/taskora?sslmode=disable bun run db:verify`.
5. Spot-check data: row counts for users, tasks and files against production, and that the newest task is from shortly before the dump time.
6. Point a local app at the restored database and a copy of the bucket, sign in, and open a task with an attachment.
7. Remove the drill database: `docker rm -f taskora-restore`.

To restore production, stop `app` and `worker`, restore into a fresh database, run `bun run db:verify`, switch `DATABASE_URL_DOCKER` to it, then start `worker` and `app`.

## CI

`.github/workflows/ci.yml` runs on every push and pull request, cancels superseded runs on the same ref, and grants the token read-only repository access. Actions are pinned to full commit SHAs; update the SHA and its version comment together.

- `verify` audits dependencies, applies every migration to an empty database and runs `db:verify` (migration drift check), then lint, typecheck, unit, backend and browser tests.
- `docker` builds the `runner` and `worker` images without pushing them.

`bun audit` fails the build on critical advisories. High advisories are reported but do not fail the build, because the current ones sit in tooling chains (`shadcn`, `ultracite`, `prisma` CLI) that the `runner` image does not ship. Review the report on each dependency update.
