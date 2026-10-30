# Taskora

> Type: readme · Status: current · Updated: 2026-10-29

Taskora is a project and work management platform for teams and their clients. It includes a web application, a companion mobile app, and a server that handles authentication, workspace data, files, notifications, and background jobs.

The repository is open source under the [MIT License](LICENSE). Taskora is built with Next.js, React, PostgreSQL, Prisma ORM 8, Better Auth, and Effect. The mobile client uses Expo and React Native.

## What you can do

- Plan work in projects, task lists, boards, calendars, and timelines.
- Assign tasks, track time and budgets, manage milestones, dependencies, and recurring work.
- Coordinate teams, clients, approvals, bug reports, and project updates.
- Share files, comments, notifications, saved views, and activity history.
- Connect integrations and automation through webhooks, email intake, GitHub events, and scheduled jobs.
- Use the Expo mobile app for workspace tasks, projects, notifications, time, and client portal workflows.

Feature access depends on the signed-in role and workspace configuration.

## Project status

Taskora is actively developed. The web app and server are the primary product. The mobile app is under development and connects to the server API; some mobile operations can use fixtures in hybrid mode while server support is completed. Mobile production builds default to live API mode.

## Contents

- [Documentation](#documentation)
- [Requirements](#requirements)
- [Run the web app locally](#run-the-web-app-locally)
- [Create the first administrator](#create-the-first-administrator)
- [Environment variables](#environment-variables)
- [Run the mobile app](#run-the-mobile-app)
- [Tests and quality checks](#tests-and-quality-checks)
- [Docker](#docker)
- [Production deployment](#production-deployment)
- [Architecture and repository layout](#architecture-and-repository-layout)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)

## Documentation

Use the [documentation hub](docs/README.md) to find the [system architecture](docs/architecture.md) and the [mobile API reference](docs/mobile-api.md). The generated [OpenAPI document](docs/mobile-openapi.json) describes the same mobile API contract.

## Requirements

- [Bun](https://bun.sh/) 1.4 or newer.
- [Docker Compose](https://docs.docker.com/compose/) for local PostgreSQL and optional MinIO.
- Git.
- A supported Node.js hosting environment or Docker for deployment.

The mobile app also needs the [Expo tooling](https://docs.expo.dev/) and an iOS simulator or Android emulator for device development.

## Run the web app locally

From the repository root, install dependencies, create a local environment file, start PostgreSQL, apply migrations, and start Next.js:

```bash
bun install
cp .env.example .env
```

In PowerShell, use `Copy-Item .env.example .env` for the copy command.

Set a unique `BETTER_AUTH_SECRET` and `SCHEDULER_TOKEN` in `.env` before starting services. For example, generate values with:

```bash
openssl rand -base64 32
```

Then initialize the database and start the app:

```bash
bun run db:up
bun run db:migrate
bun run db:verify
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The development Docker Compose override publishes PostgreSQL on port `5434` and MinIO on `9000`/`9001`. `bun run db:up` (also run by `bun run dev`) starts Docker Desktop if it is not running, then starts the single `taskora-postgres` and `taskora-minio` containers, which use `restart: always`. The default `.env.example` database URLs match this local setup.

Migrations are checked into [`migrations/`](migrations/). Apply them with `bun run db:migrate` whenever you set up a fresh database or pull changes that include migrations. `bun run db:verify` checks that the database matches the generated Prisma contract.

For a full multi-company test data set (every table, 2 admins, 11 employees, 4 client companies with portal logins), run `bun run seed:dev`. It wipes the local database first and prints every login; all share one password (`SEED_PASSWORD`, default `Taskora#Dev2026`). `bun run setup:dev` runs infra, migrations and the seed in one go.

To stop local services:

```bash
bun run db:down
```

## Create the first administrator

On a new database, bootstrap the first administrator once:

```bash
BOOTSTRAP_ADMIN_NAME="Studio Admin" \
BOOTSTRAP_ADMIN_EMAIL="admin@example.com" \
bun run bootstrap:admin
```

In PowerShell, set `$env:BOOTSTRAP_ADMIN_NAME` and `$env:BOOTSTRAP_ADMIN_EMAIL` before running `bun run bootstrap:admin`.

The command prints a generated temporary password. Keep it private and sign in to change it. The command refuses to create an initial administrator if one already exists.

## Environment variables

Use [`.env.example`](.env.example) as the complete variable reference. Keep `.env` and all real credentials out of version control. The file is ignored by Git.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by the app and CLI. |
| `TEST_DATABASE_URL` | Optional isolated database URL for backend tests. Use a disposable database with a name ending in `_test`. |
| `BETTER_AUTH_SECRET` | Private Better Auth signing secret. Use a unique value with at least 32 characters. |
| `BETTER_AUTH_URL` | Public base URL used by authentication and email links. |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated trusted browser origins. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Stable base64-encoded 32-byte key shared by all web replicas. It is also required at Docker build time. |
| `SCHEDULER_TOKEN` | Bearer token used to authorize scheduled job requests. |
| `DATABASE_POOL_MAX` | Maximum database pool size for the app instance. |
| `S3_ENDPOINT` | Private object storage endpoint accessed by the server. |
| `S3_PUBLIC_ENDPOINT` | Browser-reachable endpoint used to sign file URLs. |
| `S3_BUCKET`, `S3_REGION` | Object storage bucket and region. |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Credentials for the private object storage bucket. |
| `S3_BROWSER_ORIGIN` | Exact browser origin allowed by the local MinIO CORS configuration. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Optional web push delivery credentials. |
| `WEB_PUSH_ALLOWED_HOSTS` | Host allowlist for push delivery destinations. Keep this list narrow. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | Optional outbound email transport. Without an SMTP host, email is logged rather than delivered. |
| `WEBHOOK_ENCRYPTION_KEY` | Optional dedicated key for stored webhook signing secrets. |
| `TRUSTED_IP_HEADER`, `TRUSTED_PROXY_HOPS` | Client IP extraction settings for a trusted reverse proxy. |
| `INTAKE_EMAIL_SECRET` | Optional shared secret for inbound email intake. Leave unset to disable the endpoint. |

Additional local database, MinIO, retention, and port variables are documented inline in `.env.example`. Production credentials must come from the hosting platform's secret manager, not the example values.

## Run the mobile app

The Expo project lives in [`apps/mobile/`](apps/mobile/). Configure `EXPO_PUBLIC_API_URL` to the web server's base URL. For a physical device, use a URL reachable from that device, not `localhost`.

From the repository root:

```bash
cd apps/mobile
bun run start
```

Use the Expo CLI prompts to open the app in a simulator or on a connected device. Useful scripts from `apps/mobile/` include:

```bash
bun run android
bun run ios
bun run typecheck
bun run test:effect
bun run test:ui
```

`EXPO_PUBLIC_API_MODE` accepts `live` or `hybrid`. Live mode sends operations to the server. Hybrid mode uses local fixtures for operations that are still pending on the server. The default is live, so a typo does not silently switch the app to mock data. EAS development and preview profiles select hybrid mode; the production profile selects live mode.

The mobile client consumes the server's `/api/v1` endpoints. Run `bun run openapi:write` from the repository root to regenerate the OpenAPI description from the server contract.

## Tests and quality checks

| Command | Run from | Purpose |
| --- | --- | --- |
| `bun run lint` | Repository root | Check formatting and lint rules for web and mobile code. |
| `bun run typecheck` | Repository root | Generate Next.js route types and type-check the web app. |
| `bun run test:ui` | Repository root | Run web UI unit tests. |
| `bun run test:backend` | Repository root | Run backend tests against a dedicated local test database. |
| `bun run test:e2e` | Repository root | Run Playwright browser tests against a running app. |
| `bun run lint` | `apps/mobile/` | Lint the Expo app. |
| `bun run typecheck` | `apps/mobile/` | Type-check the Expo app. |
| `bun run test:effect` | `apps/mobile/` | Run mobile Effect tests. |
| `bun run test:ui` | `apps/mobile/` | Run mobile UI tests. |

CI also builds the production web app and Docker images and runs Playwright against Chromium.

The backend test runner creates or migrates a dedicated local `taskora*_test` database and checks for leftover fixture rows. If `TEST_DATABASE_URL` is unset, it derives a test database name from a local `taskora` database URL. It refuses to derive a test database from a remote URL. Never point it at data you need to keep.

The mobile checks are listed in the table.

### Browser tests

`bun run test:e2e` runs Playwright against a running app. Start it with `bun run dev`, or build it and run `bun run start`. Browser tests require prepared accounts and fixture data in a disposable database.

Install Chromium with:

```bash
bunx playwright install chromium
```

Set `E2E_ADMIN_PASSWORD`, `E2E_EMPLOYEE_PASSWORD`, and `E2E_PORTAL_PASSWORD` in the ignored `.env.e2e.local` file or in the shell that runs Playwright. The portal password is shared by the seeded client users and handlers. Specs skip roles that do not have a password configured.

After running migrations against the disposable browser-test database, seed test accounts and workspace fixtures:

```bash
bun --preload ./tests/backend/support/server-only-stub.ts scripts/seed-e2e-accounts.ts
```

```bash
UI_FIXTURE_ADMIN_EMAIL=ui-admin@taskora.test \
UI_FIXTURE_EMPLOYEE_EMAIL=handler-one@taskora.test \
UI_FIXTURE_NOTIFIED_EMAIL=ui-employee@taskora.test \
UI_FIXTURE_CLIENT_EMAIL=client-one@acme.test \
bun --preload ./tests/backend/support/server-only-stub.ts scripts/seed-ui-fixtures.ts
```

The account seeder can be rerun. The UI fixture seeder expects a fresh test database. Keep this database separate from local development data.

Tests that upload files need an S3-compatible service. For local MinIO, configure the S3 variables in `.env` and run:

```bash
docker compose up -d --build minio minio-init
```

The MinIO images are built from pinned upstream source releases. The first build downloads and compiles their Go dependencies. The bucket CORS policy must allow the exact `S3_BROWSER_ORIGIN` and signed `PUT`, `GET`, and `HEAD` requests. Set `E2E_BASE_URL` or `E2E_CHROMIUM_PATH` when the app or browser runs at a non-default location.

Playwright also checks keyboard interaction, axe WCAG A and AA rules, and horizontal overflow at supported viewport and zoom sizes. Authentication is rate limited, so allow the configured limit window between repeated full sign-in runs.

## Docker

Docker Compose provides PostgreSQL, MinIO, the web app, a background worker, and a one-shot migration service. Copy `.env.example` to `.env`, set unique values for `BETTER_AUTH_SECRET`, `SCHEDULER_TOKEN`, and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, then build and start the local stack:

```bash
docker compose up --build
```

For a controlled setup sequence, run migrations before starting the app and worker:

```bash
docker compose --profile setup run --rm migrate
docker compose up --build -d
```

The Compose development override is loaded automatically. It exposes local service ports for development. The app image is a standalone Next.js server that runs as a non-root user. The worker image includes the source and full dependencies for background work and one-shot maintenance commands.

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is passed to Docker as a BuildKit secret and embedded in the Next.js build. Generate a stable base64 key with `openssl rand -base64 32`. Build every replica in the same release with the same key, and keep it stable across rolling deployments.

For a production Compose deployment, use the production overlay on each Compose command:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile setup run --rm migrate
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

The production overlay does not publish PostgreSQL or MinIO ports and binds the app to loopback for a reverse proxy. It requires production credentials and browser-reachable object storage configuration.

## Production deployment

Taskora can run on a managed Node.js host or with Docker. Both use PostgreSQL, private S3-compatible object storage, and the same web server. Plan a deployment around these steps:

1. Provision PostgreSQL and private object storage. Configure browser CORS for the exact app origin and signed `PUT`, `GET`, and `HEAD` requests.
2. Set secrets and service URLs in the hosting platform. Set `DATABASE_URL`, `DATABASE_POOL_MAX`, Better Auth URL and origins, storage credentials, `SCHEDULER_TOKEN`, and a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`.
3. Apply migrations once as a deployment step with `bun run db:migrate`, then run `bun run db:verify`. Do not run migrations independently on every app replica.
4. Deploy the web app and background job processing described below.
5. Configure a trusted reverse proxy and backups for both the database and the object bucket. Rehearse restores before relying on the backups.

### Proxy and client IP

Serve the app through a reverse proxy that overwrites the trusted client IP header. Set `TRUSTED_IP_HEADER` to that header. Sign-in rate limits and the audit trail use this value. Examples include `x-real-ip` with nginx and `cf-connecting-ip` with Cloudflare.

If using `x-forwarded-for`, set `TRUSTED_PROXY_HOPS` to the number of trusted proxies that append to the chain. The app selects the entry counted from the right. Direct access that bypasses the proxy makes forwarded headers untrusted.

### Background jobs

Run `bun run worker` as a persistent process, or call `POST /api/internal/jobs` from a trusted external scheduler at least hourly with `Authorization: Bearer <SCHEDULER_TOKEN>`. The Docker Compose worker continuously processes jobs. Hosts that stop work after an HTTP response, including serverless request handlers, need the external scheduler. Workers reclaim jobs after an expired lease, so they can be restarted safely.

Push delivery requires VAPID credentials and a narrow `WEB_PUSH_ALLOWED_HOSTS` list. Email delivery requires SMTP settings. Configure only the integrations you intend to use.

### Operations

The app exposes `/api/health` for health checks. Back up PostgreSQL and the object bucket, enable bucket versioning where supported, and test a full restore. The repository includes [`docker/backup.sh`](docker/backup.sh) for Docker-based database backups. Retention settings for email receipts, webhook deliveries, and automation runs are in `.env.example`.

## Architecture and repository layout

The web application uses Next.js App Router. Product pages, queries, Server Actions, and view models are grouped by feature. Domain authorization, validation, database operations, and business rules live in Effect services under `src/server/`. PostgreSQL schema sources are organized in `src/prisma/`, with migrations in `migrations/`.

| Path | Contents |
| --- | --- |
| `apps/web/app/` | Next.js routes, layouts, API routes, and global styles. |
| `features/` | Web product features, UI, queries, and Server Actions. |
| `src/server/` | Domain services for auth, work, storage, jobs, notifications, integrations, and more. |
| `src/prisma/` | Prisma schema and generated database contract sources. |
| `migrations/` | Versioned PostgreSQL schema migrations. |
| `apps/mobile/` | Expo and React Native mobile client. |
| `apps/web/` | Next.js web application and its project configuration. |
| `components/`, `hooks/`, `lib/` | Shared interface components and utilities. |
| `tests/` | Web backend, UI, and end-to-end tests. |
| `scripts/` | Database, test, bootstrap, worker, and API contract scripts. |
| `docker/` | Container build and backup support files. |

See [Architecture](docs/architecture.md) for the verified web, mobile, API, service, and persistence boundaries.

## Contributing

Contributions are welcome. Before opening a pull request:

1. Open an issue or discussion for larger changes so the scope can be agreed on.
2. Keep changes focused and follow the existing feature and service boundaries.
3. Add or update tests for behavior you change.
4. Run the relevant lint, typecheck, and test commands from [Tests and quality checks](#tests-and-quality-checks).
5. Include migration and documentation updates when your change affects the schema or setup.

This repository uses Ultracite for linting and formatting. Run `bun run lint` to check files and `bun run format` to apply formatting. Do not commit secrets, local environment files, generated test data, or database dumps.

## Security

Do not report security vulnerabilities in public issues. Contact the maintainers privately with steps to reproduce the issue. Do not include real credentials, personal data, or production database contents in a report.

## License

Taskora is distributed under the [MIT License](LICENSE).
