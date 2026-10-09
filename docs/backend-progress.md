# Backend implementation checklist

This checklist tracks the reference app's persistent actions against an Effect service, its authorized adapter, and behavior tests. A schema row alone does not count as implemented.

## Implemented vertical slices

| Reference action | Effect service | Adapter | Behavior test |
| --- | --- | --- | --- |
| Email/password sign-in | Better Auth protocol + `AuthSession` | `/api/auth/[...all]` | signup blocked; anonymous session rejected; temporary credentials sign in |
| Create employee/admin account | `UserManagement.createEmployee` | `createEmployeeAction` | one-time password signs in through Better Auth |
| Bootstrap first administrator | `UserManagement.createFirstAdmin` | `bun run bootstrap:admin` setup command | Better Auth login works; a second bootstrap is rejected |
| Change own password / clear onboarding gate | `PasswordManagement.changeOwnPassword` | `changeOwnPasswordAction` + Better Auth credential endpoint | forced-change account changes password then passes workspace auth |
| View and revoke sessions | `SessionManagement.listSessions` / `revokeSession` | own-session and admin employee-session Server Actions | employee sees only own sessions; revocation hides token and removes session |
| Deactivate account | `UserManagement.deactivateEmployee` | `deactivateEmployeeAction` | last active admin cannot be deactivated |
| Change role | `UserManagement.changeEmployeeRole` | `changeEmployeeRoleAction` | last active admin cannot be demoted |
| Change employee email, title, and team | `UserManagement.updateEmployeeDetails` | `updateEmployeeDetailsAction` | normalized email, title, and team visible in directory; email change revokes sessions |
| Reactivate account | `UserManagement.reactivateEmployee` | `reactivateEmployeeAction` | reactivated user appears in the active employee directory |
| Update own profile name | `UserManagement.updateOwnProfile` | `updateOwnProfileAction` | Effect Schema trims and bounds name; activity is retained |
| Upload and view own/team avatars | `Uploads.requestAvatarUpload` / `finalizeAvatarUpload` / `signedAvatar` | avatar upload and signed-preview Server Actions | verifies JPEG/PNG/WebP metadata, enforces 5 MB limit, and keeps the object private |
| Reset password | `UserManagement.resetEmployeePassword` | `resetEmployeePasswordAction` | Better Auth accepts replacement; forced-change flag set |
| Search employee directory | `UserManagement.listEmployees` | employee directory Server Action | authenticated request and bounded search |
| Manage teams | `TeamManagement.listTeams` / create / update / delete | team Server Actions | team lifecycle updates member counts and removes a team cleanly |
| Search active projects and tasks | `DiscoveryManagement.searchWorkspace` | `searchWorkspaceAction` | returns matching workspace records and records the recent search |
| Manage personal favorites and recent searches | `DiscoveryManagement.toggleProjectFavorite` / `toggleTaskFavorite` / list | discovery Server Actions | favorite state toggles and recent search list remains bounded |
| Manage personal display preferences | `PersonalPreferences.get` / `save` | personal preference Server Actions | settings persist per user; time zone and default view are validated |
| Manage company identity, branding, and default timezone | `CompanySettingsManagement.get` / `update` | company settings Server Actions | employees can read settings; only admins can update; changes are retained as activity; timezone defaults to `Asia/Kolkata` |
| Read and manage calendar events | `CalendarManagement.listEvents` / create / update / delete | calendar Server Actions | employees can read; admins create/edit/delete; attendee and project validity checked |
| Create project | `ProjectManagement.createProject` | `createProjectAction` | admin allowed; employee denied |
| Create project from a starter template | `ProjectManagement.createProject` | `createProjectAction` | selected reference templates create ordered starter tasks; blank selection creates none |
| Duplicate project | `ProjectManagement.duplicateProject` | `duplicateProjectAction` | copies memberships, milestones, active tasks, labels, subtasks; resets completion, remaps internal dependencies, excludes external dependencies |
| Edit project | `ProjectManagement.updateProject` | `updateProjectAction` | increments version; stale update rejected |
| Archive/restore project | `ProjectManagement.archiveProject` / `restoreProject` | matching project Server Actions | archive lifecycle advances versions |
| Assign project lead and members | `ProjectManagement.setProjectPeople` | `setProjectPeopleAction` | employee sees assigned lead/member metadata; project version advances |
| List projects and progress | `ProjectManagement.listProjects` | `listProjectsAction` Server Action | aggregates active task progress |
| Manage project milestones | `ProjectManagement.saveProjectMilestones` | `saveProjectMilestonesAction` | creates, edits, completes, orders, and removes milestones atomically |
| Create task | `WorkManagement.createTask` + `Idempotency.run` | `createTaskAction` with a required idempotency key | repeated matching requests replay the schema-validated result; key reuse with a changed payload conflicts; generated project number, multiple assignees, and preference-aware inbox/push notifications |
| List project tasks | `WorkManagement.listProjectTasks` | `listProjectTasksAction` | bounded pagination returns task status, priority, dates, assignment names, labels, dependencies, subtask totals, and archive state |
| Edit task | `WorkManagement.updateTask` | `updateTaskAction` | stale version rejected; newly added assignees are notified |
| Configure task recurrence | `WorkManagement.setTaskRecurrence` | `setTaskRecurrenceAction` | Effect Schema validates intervals and weekdays; due date is required |
| Generate recurring successor | `WorkManagement.updateTask` transaction | `updateTaskAction` | calendar-aware daily/weekly/biweekly/monthly dates, end-date bound, one generation per source task; Undo leaves the successor in place |
| Reorder tasks | `TaskOrdering.reorderTasks` | `reorderTasksAction` | atomic positions and version increments returned in saved order |
| Bulk task update | `WorkManagement.bulkUpdateTasks` | `bulkUpdateTasksAction` | all-or-nothing edits; every task must be editable |
| Assign labels and dependencies | `TaskRelations.setTaskRelations` | `setTaskRelationsAction` | stores relations and rejects dependency cycles |
| Manage company task labels | `LabelManagement.list` / create / update / remove | label Server Actions | employee read access; admin mutations; case-insensitive name conflict validation |
| Move task | `WorkManagement.moveTask` | `moveTaskAction` | fresh destination number; unfinished uploads block move |
| Duplicate task | `WorkManagement.duplicateTask` | `duplicateTaskAction` | new task ID/number, active assignees/labels/subtasks copied, completion reset |
| Archive/restore task | `WorkManagement.archiveTask` / `restoreTask` | admin-only task Server Actions | archived tasks reject edits; restore requires current version |
| Undo task archive | `WorkManagement.undoTaskArchive` | `undoTaskArchiveAction` | actor-bound five-minute receipt, one use, conflict after intervening version changes |
| Undo task completion | `WorkManagement.undoTaskCompletion` | `undoTaskCompletionAction` | actor-bound five-minute receipt restores prior status once and rejects reuse or intervening changes |
| Read/create/edit/remove/promote subtasks | `SubtaskManagement` | subtask Server Actions and service query | visible-task access, versioned parent writes, sanitized notes, completion reset on promotion |
| List, comment, mention, and react | `Collaboration.listComments` / `createComment` / `toggleReaction` | comment Server Actions | bounded comment history includes author names and per-emoji reaction summaries; active task comments remain plain text; validated mentions notify |
| Remove and undo a comment | `Collaboration.removeComment` / `undoCommentRemoval` | remove and undo comment Server Actions | actor-bound five-minute receipt; one use; removal reversal is retained in activity |
| Upload and list task and standalone project files | `Uploads.requestTaskUpload` / `requestProjectUpload` / `finalizeUpload` / `listTaskFiles` / `listProjectFiles` | task/project upload and list Server Actions plus private S3 adapter | upload metadata is verified; employees upload to editable tasks and list visible task files; admins upload and list project-level files |
| Preview and download files | `Uploads.signedPreview` / `signedDownload` | signed preview/download Server Actions | checks account, task/project scope, copy readiness, and safe inline MIME allowlist; other file types download as attachments |
| Duplicate file | `Uploads.requestFileCopy` / `processFileCopy` | `duplicateFileAction` and `storage.copy-file` worker job | copies private objects, tracks pending/ready/failed, and prevents download until ready |
| Rename task upload | `Uploads.renameFile` | `renameFileAction` | task edit permission is checked, object key is preserved, and activity is recorded |
| Remove own upload | `Uploads.removeFile` | `removeFileAction` | five-minute actor-bound undo restores download access |
| Undo own upload removal | `Uploads.undoFileRemoval` | `undoFileRemovalAction` | one-use undo restores access; reused receipt is rejected |
| Clean expired uploads, idempotency records, and orphaned objects | `Uploads.cleanupExpiredUploads` | registered `storage.cleanup-expired-uploads` job handler | removes expired intents, expired idempotency keys, and removed files, then lists old unclaimed objects under task/file prefixes; test asserts deletion of an orphan |
| Delete replaced avatar objects | `storage.delete-avatar` job handler | registered worker/scheduler job | validates the private avatar key prefix before deleting |
| Notification inbox | `Notifications.listInbox` / read / preference | notification Server Actions | marks recipient inbox item read |
| Manage web-push subscriptions and deliver events | `PushNotifications.register` / `unregister` / `deliver` | subscription Server Actions, `notifications.deliver-push` job, and `public/sw.js` | validates trusted HTTPS providers, honors push preferences, removes expired endpoints, records successful delivery receipts, suppresses duplicate deliveries, displays the stable collapse tag, and only navigates same-origin notification links; `service-worker.test.ts` covers display and navigation behavior |
| Notify task assignees and stakeholders | `WorkManagement.createTask` / `updateTask`; `Collaboration.createComment` | task and comment Server Actions plus durable push jobs | assignment, update, mention, and comment events honor inbox/push preferences and suppress self-notifications |
| Send daily due/overdue summaries | `Notifications.sendDailyDueSummaries` | hourly `notifications.daily-due-summary` worker job | checks 9 a.m. in each saved timezone; deterministic notification IDs suppress duplicate scans |
| Enqueue storage and reminder maintenance | `JobProcessor.enqueueMaintenance` | worker CLI and protected scheduler route | cleanup job deduplicated by UTC day; due-summary scan deduplicated by UTC hour |
| Claim/complete durable job | `JobProcessor.processBatch` | worker CLI and protected scheduler route | PostgreSQL lease completion and retry |
| Inspect dead jobs | `JobProcessor.listDeadJobs` | admin-only `listDeadJobsAction` | returns bounded error metadata and never returns job payloads |
| Dashboard and workload overview | `Dashboard.getOverview` | `getDashboardOverviewAction` | project/task status totals, overdue work, and assigned open-task counts |

## Remaining backend work

All backend checklist items are implemented and covered by service or adapter behavior tests. Browser push delivery is wired through the user-gesture control and service worker; its end-to-end permission and click flow should be exercised when the sign-in/workspace screens are added.

- [x] Include project team, appearance, date, and position fields in create/update inputs and project summaries; archived projects and tasks can be discovered through explicit read query flags.
- [x] Read bounded task/project activity feeds with actor identity and retained event details through an authenticated Server Action.
- [x] Make expired upload cleanup claim intents and remove metadata before deleting external objects, so finalization/Undo cannot restore metadata after cleanup has deleted the object. Failed object deletion remains discoverable by the orphan cleanup pass.
- [x] Self profile name, avatar changes, personal preferences, database-backed rate limiting, employee administration, and team lifecycle.
- [x] Project duplication and all seven reference templates. Concurrent people and milestone updates at one version produce one winner and one `CONFLICT`.
- [x] Task creation, editing, board changes, numbering, bulk changes, relations, movement, duplication, archives, Undo, assignments, and stakeholder notifications. Concurrent moves of one task produce one winner, and file links follow a moved task to its new project.
- [x] Subtasks, comments, mentions, reactions, retained activity, completion Undo, and recurring successor generation. Weekly and biweekly weekday selection, end-date inclusion and exclusion, and concurrent completion creating exactly one successor are covered.
- [x] Avatar upload/preview, task and standalone project file upload/list/preview/download, rename/copy/removal/Undo, size validation, expired-intent cleanup, expired-removed-file cleanup, and S3 orphan inventory cleanup. Task-file authorization, standalone admin access, file copy lifecycle, and orphan deletion have behavior coverage.
- [x] Push subscriptions, mention/comment/assignment/update delivery, preferences, expired endpoint removal, and timezone-based daily due summaries. Persisted delivery receipts suppress re-delivery after a completed provider send. Delivery is at-least-once: if the provider accepts a push but the receipt write fails, the job retries and may resend. Each push carries a Web Push `topic` and a payload `tag` derived from the notification ID, so a resend replaces the earlier notification. The receipt write is retried three times before the job fails, and a unique-constraint hit counts as recorded. The service worker must pass `tag` to `showNotification` for the collapse to take effect.
- [x] Saved views, personal display preferences, calendar event CRUD, and dashboard/workload overview.
- [x] Durable job leases, bounded retries, immediate dead-lettering of permanent failures, upload/avatar/file-copy/push/reminder handlers, and worker/scheduler adapters.
- [x] Project create, duplicate, update, archive, restore, set people, and save milestones require an actor-scoped idempotency key. Replays return the schema-validated stored result, a changed payload conflicts, concurrent same-key requests execute once, and a failed run frees the key. Idempotency tests cover these paths.
- [x] Comment create, remove, undo removal, and reaction toggle, plus subtask create, update, remove, and promote, require an actor-scoped idempotency key. Replays return the stored result; a reaction toggle retried with the same key does not flip back.
- [x] Request-level idempotency covers every mutation Server Action except those that return credentials or signed URLs: calendar events, employees (deactivate, reactivate, role, details, own profile), labels, teams, saved views, notifications and push registration, personal preferences, company settings, favorites, projects, tasks, subtasks, comments, file finalize/rename/duplicate/remove/undo, and avatar finalize. Each result is validated before replay, and the first call returns the same decoded value a replay returns, so a client never sees a different shape on a retry. `action-replay.test.ts` runs every one of these actions twice with the same key and checks the replay is identical; it also fails if a new action is neither a read, a listed exclusion, nor replayed. Excluded by design: temporary-password actions (create employee, reset password), signed-URL and upload-intent actions, the own-password change, and session revocation. Those must never persist or replay credentials or URLs; session revocation is already naturally idempotent.
- [x] Idempotency reservations, domain writes, activity, notifications, durable jobs, and the serialized response now share one Prisma transaction. The transaction context is request-scoped and routes ORM operations plus nested service transactions through the same transaction; `idempotency.test.ts` proves a command write rolls back when output serialization fails.
- [x] Competing comment-removal Undo: exactly one of several concurrent undo requests succeeds. The consume step is guarded by `consumedAt: null`.
- [x] Acceptance coverage for permission bypasses and high-contention operations. `action-permissions.test.ts` calls every exported Server Action directly: anonymous, deactivated, and forced-password-change accounts are refused on all of them (the onboarding actions excepted), an employee is refused on every administrator-only action, an outsider is refused on task, subtask, comment, and file edits, and archived tasks and projects reject edits. A test fails if a new Server Action is added without being listed. Contention tests cover task numbering, subtask promotion, task moves, recurring-task completion, project people and milestones, idempotency key reuse, and competing Undo for task archive, task completion, comment removal, and file removal.
- [x] Version-guarded and state-transition writes are atomic. The ORM's `update` on a filtered collection runs a `SELECT` for the filter and then an `UPDATE` by id, so two concurrent writers could both pass a check. Every guarded write now uses `updateAndCount`, which sends the guard and the id in the `UPDATE` itself, and a zero count is reported as `CONFLICT`: task, project, subtask-parent, relation, ordering, bulk, move, archive and restore writes; every Undo consume step; file rename, removal, restore and copy completion; upload and avatar finalization (the intent is claimed first, so a concurrent finalization gets `CONFLICT` instead of a duplicate file); the task-number counter; job lease completion; the onboarding gate; and the idempotency reservation. Concurrent removal and finalization of the same file, and two administrators deactivating or demoting each other, each leave exactly one winner.
- [x] Every application Server Action and internal scheduler handler now passes an explicit Effect output schema. Operations with a domain result schema use it for Type-side projection; the shared serializable-tree schema covers other outputs, including supported `Date` values. Saved-view JSON fields use `Schema.Json` on reads and writes rather than permissive unknown values. `server-action.test.ts` covers rejection, Date support, and output projection.
- [x] Task calendar/timeline queries filter by range, projects, status, priority, and assignees; sort by supported task fields; group by status, project, or assignee; and return bounded results. Subtask listing and ordering are exposed through authorized actions; ordering is version-guarded and transactional.
- [x] Job leases renew while handlers run, cannot be renewed after expiry, and completion/retry require the current unexpired lease token. `jobs.test.ts` uses a short lease and a longer handler to verify renewal through the processor interface.

## UI-only reference interactions

Drag previews, popovers, modal open/close state, optimistic visual feedback, responsive navigation, keyboard shortcuts, and browser push permission/click flows belong to the later UI phase. Their persisted changes must call the authorized services.

## Excluded by scope

Billing, subscriptions, multiple workspaces, OAuth, two-factor authentication, email recovery, public signup, hard account deletion, impersonation, and imported demo data are excluded.

## Local setup and tests

```sh
cp .env.example .env
bun install
bun run db:up
bun run db:migrate
bun run db:verify
bun run dev
```

`bun run test:backend` (alias: `bun run test`) creates or reuses a dedicated local `metsys_test` database, applies migrations there, verifies the Prisma contract against it, and runs Bun behavior tests. It refuses to derive a test database from a non-local `DATABASE_URL`. Set `TEST_DATABASE_URL` and optionally `TEST_DATABASE_ADMIN_URL` for another isolated PostgreSQL server. Tests do not migrate the ordinary development database.

Run the durable worker with `bun run worker`. The bounded HTTP scheduler is `POST /api/internal/jobs` with `Authorization: Bearer $SCHEDULER_TOKEN`. Production must invoke that endpoint hourly from an external scheduler or run a dedicated worker service so the processor can scan each employee's local 9 a.m. reminder window; business work does not depend on a server timer.

Docker Compose can run the app and worker after secrets are set in `.env`. `DATABASE_URL_DOCKER` must address the Compose `postgres` service.
