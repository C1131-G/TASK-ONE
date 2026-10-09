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

The command prints a generated temporary password once and requires a password change at first sign-in. Keep that output private. It refuses to run after an admin account exists.

The service, adapter, test coverage, and remaining work checklist is in [`docs/backend-progress.md`](docs/backend-progress.md). Prisma model groups and authorization policy are in [`docs/data-model.md`](docs/data-model.md).

## Docker

Set `BETTER_AUTH_SECRET` and `SCHEDULER_TOKEN` in `.env`, then run `docker compose up --build`. The app and worker share backend services and `DATABASE_URL_DOCKER`. Migrations remain an explicit setup step:

```bash
docker compose run --rm app bun run db:migrate
```
