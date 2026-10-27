# Metsys task management rebuild

This app rebuilds Gr8r Studio's project and task workflows with Next.js, Prisma ORM 8, PostgreSQL, Better Auth, and Effect TypeScript v4 services.

## Development

Copy `.env.example` to `.env`, then start PostgreSQL and apply the checked-in database migrations:

```bash
bun install
bun run db:up
bun run db:migrate
bun run db:verify
bun run dev
```

Run backend behavior tests against the isolated `metsys_test` database with `bun run test`. Run `bun run typecheck` for strict TypeScript checking.

On a fresh database, create the first administrator once with:

```bash
BOOTSTRAP_ADMIN_NAME="Studio Admin" BOOTSTRAP_ADMIN_EMAIL="admin@example.com" bun run bootstrap:admin
```

The bootstrap command prints a generated temporary password once and requires a password change at first sign-in. Keep that output private. It refuses to run after an admin account exists.

The service, adapter, test coverage, and remaining work checklist is in [`docs/backend-progress.md`](docs/backend-progress.md). Prisma model groups and authorization policy are in [`docs/data-model.md`](docs/data-model.md).

## UI and browser tests

`bun run test:ui` runs the fast UI unit tests. `bun run test:e2e` runs the Playwright browser tests against a running app (`bun run dev`, or `bun run build` then `bun run start`). It needs prepared test accounts and workspace data, which the seed scripts below create in a disposable database.

Set `E2E_ADMIN_PASSWORD`, `E2E_EMPLOYEE_PASSWORD` and `E2E_PORTAL_PASSWORD` in the ignored `.env.e2e.local` file, which Playwright loads automatically, or export them in your shell. The first two are the admin and employee accounts; the third is the password for the handlers and the client accounts of the seeded "Acme" company. Specs skip themselves for a role whose password is not set. Seed a disposable database (never your working one) after `bun run db:migrate`, with the three passwords exported:

```bash
bun --preload ./tests/backend/support/server-only-stub.ts scripts/seed-e2e-accounts.ts
UI_FIXTURE_ADMIN_EMAIL=ui-admin@metsys.test UI_FIXTURE_EMPLOYEE_EMAIL=handler-one@metsys.test UI_FIXTURE_NOTIFIED_EMAIL=ui-employee@metsys.test UI_FIXTURE_CLIENT_EMAIL=client-one@acme.test bun --preload ./tests/backend/support/server-only-stub.ts scripts/seed-ui-fixtures.ts
```

The first script creates the admin, two handlers, the Acme client company with its client users, and a linked project; the second adds the projects, tasks, milestones, files and notifications the browser tests use. The first script is safe to run again; for the second, start from a fresh database. Serving the app for tests with the instant-navigation test hooks (`EXPOSE_TESTING_API=1`) is refused in production unless `CI` is set. Install the managed browser with `bunx playwright install chromium`.

Upload tests need working local storage. Set the S3 values in `.env` using `.env.example`, then run `docker compose up -d --build minio minio-init`. MinIO and its client are built from pinned upstream source releases because their previous container images are unavailable. The first build downloads and compiles Go dependencies. MinIO allows the exact `S3_BROWSER_ORIGIN` through `MINIO_API_CORS_ALLOW_ORIGIN`; the init service waits for readiness and creates the private bucket. [Upstream release build instructions](https://github.com/minio/minio/releases/tag/RELEASE.2025-10-15T17-29-55Z).

The suite checks keyboard use of every dialog, sheet and menu, WCAG A and AA rules with axe, and sideways scrolling at 320, 430, 768 and 1024px and at 200% and 400% zoom sizes, in both themes. Sign-ins are limited to five a minute, so wait a minute between full runs. A browser PUT to local S3-compatible storage needs a bucket CORS rule that allows your app's origin. Set `E2E_BASE_URL` or `E2E_CHROMIUM_PATH` if the app or the browser is somewhere else.

## Docker

Set `BETTER_AUTH_SECRET`, `SCHEDULER_TOKEN`, and a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in `.env`, then run `docker compose up --build`. Generate the auth and scheduler secrets independently. Generate the Next.js key with `openssl rand -base64 32`; use the same key for every app replica and keep it stable across deployments. The example key is a placeholder and must be replaced. The key is embedded at build time, so compose passes it to the image build as a BuildKit secret.

The app image is the Next.js standalone server and runs as a non-root user. The worker and the migration task share a separate `worker` image with the full source. `docker-compose.override.yml` publishes Postgres, MinIO and the app to the host for local development, and is loaded automatically, so `bun run db:up` keeps working. Migrations remain an explicit one-shot setup step:

```bash
docker compose --profile setup run --rm migrate
docker compose up --build -d
```

For production, add `-f docker-compose.yml -f docker-compose.prod.yml` to every command. That overlay publishes no Postgres or MinIO ports, binds the app to `127.0.0.1` for a reverse proxy, and requires real credentials. See [docs/operations.md](docs/operations.md) for the reverse proxy, backups (`docker/backup.sh`), bucket versioning and the restore drill.

## Production operation

The backend supports a managed Node.js host such as Vercel or a Docker deployment. Both use the same PostgreSQL schema, Effect services, and Server Actions. Apply migrations with `bun run db:migrate` as a deployment step before serving traffic; do not run migration commands independently from every app replica. Run `bun run db:verify` after migration. Back up the database and bucket and rehearse restores as described in [docs/operations.md](docs/operations.md).

Configure `DATABASE_URL` and `DATABASE_POOL_MAX` for the host's connection limits. Keep Better Auth's URL and trusted origins aligned with the public app URL. Keep `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable and identical across all replicas so encrypted Server Action payloads work during rolling deployments.

Serve the app only through a reverse proxy, and set `TRUSTED_IP_HEADER` to the header that proxy writes with the client address. Sign-in rate limits and the audit trail read only that header. Prefer a header the proxy overwrites, such as `x-real-ip` (nginx) or `cf-connecting-ip` (Cloudflare). The default is `x-forwarded-for` with `TRUSTED_PROXY_HOPS=1`: the app takes the entry that many places from the right, which your proxies appended, and ignores the client-controlled entries to its left. Set `TRUSTED_PROXY_HOPS` to the number of proxies that append to the chain. If clients can reach the app without passing the proxy, no header is trustworthy and they can rotate their apparent address.

Configure private S3-compatible storage with `S3_ENDPOINT` for server-to-storage access and `S3_PUBLIC_ENDPOINT` for URLs signed for browsers. They can be the same endpoint on a managed provider; with Docker and local MinIO, the app uses `http://minio:9000` internally and the browser uses `http://localhost:9000`. Set bucket CORS to the exact browser origin and permit signed `PUT`, `GET`, and `HEAD` requests.

Push delivery requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and a narrow `WEB_PUSH_ALLOWED_HOSTS` list. Register a production scheduler to call `POST /api/internal/jobs` hourly with `Authorization: Bearer $SCHEDULER_TOKEN`, or run the Docker worker continuously. Vercel deployments must use the external scheduler because request handlers do not run background work after the response. For Docker, inspect failures with the admin-only failed-job action and application logs; restart workers safely because expired leases are reclaimed.
