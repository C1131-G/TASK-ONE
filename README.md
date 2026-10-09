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

For local UI testing on an already initialized database, seed one test admin and one test employee with:

```bash
bun run seed:test-users
```

The command prints each account's employee ID, email, and generated temporary password once. Both accounts must change their password after their first sign-in. It only runs against a local, non-test Metsys database and refuses to overwrite either test email.

The command prints a generated temporary password once and requires a password change at first sign-in. Keep that output private. It refuses to run after an admin account exists.

The service, adapter, test coverage, and remaining work checklist is in [`docs/backend-progress.md`](docs/backend-progress.md). Prisma model groups and authorization policy are in [`docs/data-model.md`](docs/data-model.md).

## Docker

Set `BETTER_AUTH_SECRET`, `SCHEDULER_TOKEN`, and a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` in `.env`, then run `docker compose up --build`. Generate the auth and scheduler secrets independently. Generate the Next.js key with `openssl rand -base64 32`; use the same key for every app replica and keep it stable across deployments. The example key is a placeholder and must be replaced.

The app and worker use the same database pool limit and business services. Migrations remain an explicit one-shot setup step:

```bash
docker compose --profile setup run --rm migrate
docker compose up --build -d
```

## Production operation

The backend supports a managed Node.js host such as Vercel or a Docker deployment. Both use the same PostgreSQL schema, Effect services, and Server Actions. Apply migrations with `bun run db:migrate` as a deployment step before serving traffic; do not run migration commands independently from every app replica. Run `bun run db:verify` after migration.

Configure `DATABASE_URL` and `DATABASE_POOL_MAX` for the host's connection limits. Keep Better Auth's URL and trusted origins aligned with the public app URL. Keep `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` stable and identical across all replicas so encrypted Server Action payloads work during rolling deployments.

Configure private S3-compatible storage with `S3_ENDPOINT` for server-to-storage access and `S3_PUBLIC_ENDPOINT` for URLs signed for browsers. They can be the same endpoint on a managed provider; with Docker and local MinIO, the app uses `http://minio:9000` internally and the browser uses `http://localhost:9000`. Set bucket CORS to the exact browser origin and permit signed `PUT`, `GET`, and `HEAD` requests.

Push delivery requires `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and a narrow `WEB_PUSH_ALLOWED_HOSTS` list. Register a production scheduler to call `POST /api/internal/jobs` hourly with `Authorization: Bearer $SCHEDULER_TOKEN`, or run the Docker worker continuously. Vercel deployments must use the external scheduler because request handlers do not run background work after the response. For Docker, inspect failures with the admin-only failed-job action and application logs; restart workers safely because expired leases are reclaimed.
