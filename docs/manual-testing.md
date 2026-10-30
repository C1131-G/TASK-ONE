# Manual testing guide

> Type: how-to. Status: current. Updated: 2026-10-30

You need to test Taskora by hand and want ready-made accounts, companies, and data. This guide gives you every login, what each account can do, and a checklist of things to try.

When you finish setup you have one Postgres database, one MinIO bucket, and a seeded workspace with admins, employees, and four client companies.

## Set up

You need Docker Desktop and [Bun](https://bun.sh) installed, and a `.env` file copied from `.env.example`.

1. Start Docker, apply migrations, and seed the data:

   ```bash
   bun run setup:dev
   ```

2. Start the app:

   ```bash
   bun run dev
   ```

   `bun run dev` starts Docker Desktop for you if it is closed.

3. Open [http://localhost:3000/login](http://localhost:3000/login).

Seeding wipes the whole local database first, then refills every table. Run `bun run seed:dev` any time you want a clean slate. The seed refuses to run against a non-local or `_test` database.

## Services and ports

| Service | Address | Login |
| --- | --- | --- |
| App | http://localhost:3000 | see accounts below |
| Health check | http://localhost:3000/api/health | none |
| PostgreSQL | `localhost:5434`, database `taskora` | user `taskora`, password `local-dev-password` |
| MinIO API | http://localhost:9000 | none |
| MinIO console | http://localhost:9001 | user `taskora`, password `local-minio-password` |

These values come from `.env.example`. If you changed them in `.env`, use yours.

## Password

Every seeded account uses the same password:

```
Taskora#Dev2026
```

To use another one, run `SEED_PASSWORD=YourPassword bun run seed:dev`.

## Staff accounts

Sign in at `/login`. Staff see the workspace.

| Email | Name | Role | Team | Notes |
| --- | --- | --- | --- | --- |
| owner@taskora.test | Olivia Owner | admin | none | Full access. Member of every project. |
| admin@taskora.test | Adam Admin | admin | Support | Full access. Lead of Internal Tooling. |
| eli@taskora.test | Eli Engineer | employee | Engineering | Lead of Acme Web Platform. Has a running timer. |
| ena@taskora.test | Ena Backend | employee | Engineering | Lead of Globex Partner API. Picks and fixes bugs. |
| ravi@taskora.test | Ravi Frontend | employee | Engineering | Lead of Acme Mobile App. |
| dana@taskora.test | Dana Designer | employee | Design | Lead of Globex Brand Refresh. |
| dev@taskora.test | Dev Visual | employee | Design |  |
| sia@taskora.test | Sia Support | employee | Support | Handler for Acme and Initech. |
| sam@taskora.test | Sam Success | employee | Support | Handler for Acme, Globex, and Umbrella. |
| mia@taskora.test | Mia Marketer | employee | Marketing | Lead of Website Content Calendar. |
| max@taskora.test | Max Content | employee | Marketing |  |
| newhire@taskora.test | Nia NewHire | employee | Engineering | Must change the password at first sign-in. |
| former@taskora.test | Finn Former | employee | Engineering | Deactivated. Sign-in must fail. |

## Client portal accounts

Clients sign in at the same `/login` page and land in the portal at `/portal`. Each client sees only their own company.

| Email | Name | Company |
| --- | --- | --- |
| casey@acme.test | Casey Client | Acme Corp |
| corin@acme.test | Corin Buyer | Acme Corp |
| cleo@acme.test | Cleo Ops | Acme Corp |
| gina@globex.test | Gina Globex | Globex Industries |
| greg@globex.test | Greg Lead | Globex Industries |
| ian@initech.test | Ian Initech | Initech Labs |
| ivy@initech.test | Ivy Product | Initech Labs (must change the password at first sign-in) |
| uma@umbrella.test | Uma Umbrella | Umbrella Retail (company is deactivated) |

## Client companies

| Company | Projects visible in the portal | Handlers | Intake form |
| --- | --- | --- | --- |
| Acme Corp | ACME, ACMEM | Sia, Sam | `/intake/acme-bugs` |
| Globex Industries | GLBX, GLAPI | Sam, Eli | `/intake/globex-bugs` |
| Initech Labs | INIT | Sia | `/intake/initech-bugs` (disabled) |
| Umbrella Retail | UMB | Sam | none |

Initech was linked to the Internal Tooling project and then unlinked. Check that Initech users cannot see it.

## Projects

| Key | Name | Status | Team | Lead | Client |
| --- | --- | --- | --- | --- | --- |
| ACME | Acme Web Platform | active | Engineering | Eli | Acme |
| ACMEM | Acme Mobile App | risk | Engineering | Ravi | Acme |
| GLBX | Globex Brand Refresh | active | Design | Dana | Globex |
| GLAPI | Globex Partner API | planning | Engineering | Ena | Globex |
| INIT | Initech Portal Rebuild | active | Engineering | Eli | Initech |
| UMB | Umbrella Campaign | hold | Marketing | Mia | Umbrella |
| INT | Internal Tooling | active | Engineering | Adam | none (internal) |
| MKT | Website Content Calendar | planning | Marketing | Mia | none (internal) |
| ARCH | Archived Legacy Site | complete | Engineering | Adam | none (archived) |

## What is seeded

Every table has data. The main parts are:

- **Tasks:** about 110 across all projects, in every status and priority, with due dates from two weeks ago to three weeks ahead. Some have subtasks, labels, dependencies, comments, reactions, and custom field values. Some are archived.
- **Recurring tasks:** three tasks in Internal Tooling repeat daily, weekly, biweekly, or monthly.
- **Bugs:** 19 bug reports. There is one at each workflow stage: reported, triaged, in progress, in verification, awaiting admin approval, approved for release, released, closed, needs info, awaiting client, duplicate, rejected, and withdrawn. Some come from client users, some from staff.
- **Intake:** each company has a web and an email submission linked to a bug.
- **Approvals:** four approval requests on Acme tasks and milestones: pending, approved, changes requested, and cancelled.
- **Time tracking:** about 90 time entries over the last 20 days. Eli has a timer running now.
- **Budgets:** Acme (retainer), Globex (one-off), and Initech (one-off, with an overrun alert).
- **Calendar:** six events with attendees.
- **Integrations:** a GitHub connection on Acme Web Platform with three pull requests, two webhook endpoints with deliveries in each state, and three automation rules.
- **Custom fields:** Acme Web Platform and Initech Portal Rebuild each have a text, number, select, date, and checkbox field.
- **Per-user data:** notifications, saved views, favorites, recent searches, notification preferences, and email settings for every staff account.

## Test checklist

Work through these. Each line names the account to use.

### Sign in

- Sign in as `owner@taskora.test`. You reach the workspace.
- Sign in as `casey@acme.test`. You reach the portal.
- Sign in as `newhire@taskora.test` or `ivy@initech.test`. You are asked to change the password first.
- Try `former@taskora.test` and `uma@umbrella.test`. Sign-in should fail or be blocked.
- Enter a wrong password five times for one account. The account locks for 15 minutes. Reset it by running `bun run seed:dev` again.

### Access between companies

- As `casey@acme.test`, open ACME and ACMEM. Confirm you see no Globex, Initech, or internal projects.
- As `gina@globex.test`, confirm you see only GLBX and GLAPI.
- As `ian@initech.test`, confirm you cannot see Internal Tooling.
- As `eli@taskora.test`, confirm you cannot open projects you are not a member of.

### Tasks

- As `eli@taskora.test`, create a task in ACME, assign it to `ravi@taskora.test`, and set a due date.
- Change its status through backlog, todo, progress, review, and done. Check the activity feed.
- Add a subtask, a label, a comment with a mention, and a reaction.
- Archive the task, then restore it from the archive.
- Open My Tasks as `dana@taskora.test` and check the list matches her assignments.

### Bugs and client reports

- As `casey@acme.test`, report a bug in the portal. Check that Sia or Sam get a notification.
- As `ena@taskora.test`, pick the new bug, add a fix attempt, and move it to verification.
- As `sia@taskora.test`, verify the fix. As `admin@taskora.test`, approve it and record a release.
- Back as `casey@acme.test`, confirm the bug and leave a satisfaction rating.
- Open the awaiting client and needs info bugs as the client and answer them.
- Open `/intake/acme-bugs` without signing in and submit a report. Open `/intake/initech-bugs` and confirm it is disabled.

### Approvals

- As `casey@acme.test`, open the pending approval and approve it.
- As `corin@acme.test`, open the changes requested approval and read the comment.
- As `eli@taskora.test`, request a new approval on an Acme task.

### Time and budgets

- As `eli@taskora.test`, stop the running timer and check a time entry appears.
- Add a manual entry for yesterday. Mark it billable.
- As `owner@taskora.test`, open the Initech budget. Confirm the overrun alert shows.

### Calendar, notifications, and settings

- Open the calendar as `dana@taskora.test` and check the events she attends.
- Open the inbox, mark notifications read, and change notification preferences.
- Create a saved view and mark it shared. Open it as another employee.

### Admin

- As `owner@taskora.test`, create an employee. Note the temporary password shown.
- Deactivate then reactivate an employee.
- Create a client user in a company, then reset its password.
- Add a webhook endpoint and an automation rule. Check the delivery and run logs.

## Known limits

- **File downloads:** file records exist, but the seed does not upload the files to MinIO. Opening a seeded file fails. Upload a new file in the app to test uploads and downloads.
- **Email and push:** no SMTP or push keys are set, so emails are logged and push is not delivered.
- **Sessions:** the seed adds a few sessions, but you sign in fresh for real tests.
- **Sign-in rate limit:** many sign-ins from one address in a short time are blocked. Wait a few minutes, or run the seed again, which clears the limit.

## Reset

Run `bun run seed:dev` to put everything back to the starting state. To start from an empty database instead, run `bun run db:down`, delete the `taskora-postgres-data` volume, then run `bun run setup:dev`.
