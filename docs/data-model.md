# Database model

The Prisma ORM 8 contract is split into one model per `.prisma` file under `src/prisma/`. `prisma.config.ts` includes the files with a glob and emits one contract. Keep every source file opted in with `// use prisma-8`; edit the source files, not the emitted `contract.json` or `contract.d.ts`.

## Model groups

- **Authentication:** `User`, `Session`, `Account`, and `Verification` use the Better Auth core table and field names. `User` includes the Admin plugin's role and ban fields. Password hashes belong in `Account.password`.
- **People and company:** `Team` and singleton `CompanySettings`, including the company name, URL slug, brand color, and branding toggle from the reference. Each employee has zero or one team. `User.employeeNumber` is unique and sequence-generated; display it as `EMP` followed by the number padded to six digits (for example, `EMP000001`). The database never reuses sequence values. Deactivation time and the admin who deactivated the user are retained on the user record. Clear both deactivation fields when reactivating an employee, and reject login/session use while `deactivatedAt` is set.
- **Projects:** `Project`, `ProjectMember`, `ProjectMilestone`, `FileAsset`, `CalendarEvent`, and `CalendarEventAttendee` represent ownership, membership, dates, files, and the project calendar.
- **Tasks:** `Task` stores a project-scoped task number, status, priority, creator, dates, ordering, completion, and archive state. `TaskAssignee` allows multiple employees per task. `TaskLabel`, `Label`, `TaskSubtask`, `TaskDependency`, and `TaskRecurrence` normalize related work. Subtasks retain their own notes, assignee, due date, completion state, and order to match the reference app's subtask detail view.
- **Collaboration:** `Comment`, `CommentReaction`, `Activity`, and `Notification` retain discussion and history. Comments and files use soft deletion; project and task history is preserved through archive fields.
- **Personalization:** `UserPreference`, `NotificationPreference`, `SavedView`, `FavoriteProject`, `FavoriteTask`, and `RecentSearch` store per-user state. Saved filters, sort settings, hidden columns, and preference values use JSONB.
- **Operational backend:** `ProjectTaskCounter` allocates project task numbers; `Job` persists leased background work; `UploadIntent` records signed upload lifecycle; `PushSubscription` stores browser endpoints; `UndoRecord` and `IdempotencyKey` persist compensating actions and request deduplication; `RecurrenceGeneration` makes successor creation idempotent. `Project.version` and `Task.version` support optimistic concurrency.

## Roles and permissions

| Capability | Admin | Employee |
| --- | --- | --- |
| View company projects and tasks | All | All |
| Manage users, company settings, teams, and projects | Yes | No |
| Create tasks | Yes | Yes |
| Edit task details | All tasks | Tasks they created or are assigned to |
| Assign/reassign employees | Yes | Yes, within editable tasks |
| Comment on visible tasks | Yes | Yes |
| Upload files to tasks | Any task | Tasks they can edit |
| Remove comments or uploads | Any | Their own |
| Archive projects and tasks | Yes | No |
| Manage standalone project files and calendar events | Yes | No |

Enforce these rules in each Server Action or server-side query. Foreign keys and role fields describe the data; they do not provide authorization by themselves. Disable hard user deletion in Better Auth so task and audit history continues to reference its creator.

The reference app also includes guests, pending invitations, and private projects. This schema follows the requested two-role model and company-wide project visibility instead; invitations and private-project access rules are not part of this rebuild phase. Billing, multiple workspaces, OAuth, and two-factor authentication are also excluded.

## Local database workflow

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL 18 with `bun run db:up`.
3. Apply the reviewed migration packages with `bun run db:migrate`.
4. Verify the schema with `bun run db:verify`.

`bun run db:init` can initialize a disposable empty database without recording a migration package. For schema changes, emit the updated contract, run `bun run db:plan -- --name <change>`, review the generated package under `migrations/`, and apply it with `bun run db:migrate`. Stop the container with `bun run db:down`; the named volume keeps local data.

Better Auth connects directly to PostgreSQL through its supported adapter and the app uses Effect services for account provisioning and authorization. The current service and endpoint coverage is tracked in [`backend-progress.md`](backend-progress.md); schema coverage is broader than the implemented behavior coverage.
