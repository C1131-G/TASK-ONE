# Mobile API (`/api/v1`)

The mobile app calls versioned JSON routes under `app/api/v1`. They are thin adapters over the same Effect services in `src/server/<domain>/` that the web Server Actions use, so authorization, validation and transactions live in one place. A route never calls a Server Action, and web `refresh()` stays inside the Server Actions.

## Sign-in and sessions

- Sign in with `POST /api/auth/sign-in/email`. The response carries the session token in the `set-auth-token` header.
- Send it on every call as `Authorization: Bearer <token>`.
- The token is the same database session the web cookie uses. It lasts 8 hours; a client account is also signed out after 2 idle hours. Revoking the session (signed-in devices) or deactivating the account makes the token return `401` at once.
- Identity, role, company and handler permissions are always read from the session on the server. A request never states who it is.

## Contract

- `src/mobile-api/routes.ts` lists every route with its operation ID, method, path and response schema. It imports nothing from the server.
- `GET /api/v1/openapi.json` is generated from that list.
- `src/mobile-api/client.ts` is the typed client generated from the same list.
- `tests/backend/mobile-api-contract.test.ts` fails when a route file has no entry in the list, or an entry has no route file.
- `docs/mobile-openapi.json` is the same contract as a file the app team can read without running the server. `tests/backend/mobile-api-openapi-file.test.ts` fails while it differs from what the code generates; refresh it with `bun run openapi:write` and commit it with the route change.

Add a route by: writing the route file, adding its entry to `mobileRoutes`, testing it through the route handler, and running `bun run openapi:write`.

## Versioning

- Everything under `/api/v1` stays compatible with the apps already released. Inside `v1` we only add: new routes, new optional request fields, new response fields, new values the app must tolerate in `error.reason` and other open lists. An app must ignore response fields it does not know.
- A change that would break a released app (removing or renaming a route, field or error code, making an optional field required, changing a field's meaning or type, tightening who may call a route) goes to `/api/v2`, and `v1` keeps working beside it.
- A route or field that will go away is first marked deprecated in `docs/mobile-openapi.json` and in the route's summary. `v1` keeps it for at least 6 months after the first app release that stops using it, and is switched off only after the release notes announce a date.
- `info.version` in the contract is the contract's own version: the minor number rises when something is added, and the major number only changes with a new `/api/v{n}`.
- A pull request that changes `docs/mobile-openapi.json` must say in its description whether it only adds; reviewers reject a removal inside `v1`.

## Responses

Every response is JSON and carries the request ID in the `x-request-id` header and in the body.

```json
{ "ok": true, "data": {}, "requestId": "…" }
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "…", "requestId": "…", "fieldErrors": { "title": "…" } } }
```

| Code                                               | HTTP status |
| -------------------------------------------------- | ----------- |
| `UNAUTHENTICATED`                                  | 401         |
| `FORBIDDEN`                                        | 403         |
| `NOT_FOUND`                                        | 404         |
| `CONFLICT` (stale version, duplicate, in progress) | 409         |
| `VALIDATION_FAILED`                                | 422         |
| `RATE_LIMITED`                                     | 429         |
| `UNAVAILABLE`                                      | 503         |

### Why a 401 happened

A `401` carries `error.reason`, so the app can tell a person what to do:

| `reason` | Meaning | What the app shows |
| --- | --- | --- |
| `session_ended` | The token is missing, was never issued, expired, or was revoked (signed out elsewhere, password changed). The session store cannot tell these apart. | Sign in again |
| `deactivated` | The account was switched off. | Contact your administrator |
| `inactivity` | A client account was idle for more than 2 hours. | Signed out for inactivity; sign in again |

Answers other than `401` have no `reason`.

### Limits

- **Body size.** A JSON body over about 1 MiB answers `422` ("The request body is too large.") before any field is read. The reverse proxy should cap bodies as well.
- **Request rate.** Each signed-in person may make 300 requests a minute to one server (set `MOBILE_API_RATE_LIMIT_PER_MINUTE` to change it). Past that the answer is `429` with `error.retryAfterSeconds` and a `Retry-After` header; wait that long. Requests with a bad token are not counted against anyone. The count lives in one server process, so the reverse proxy must enforce the limit that holds across servers and per address.
- **Sign-in and password attempts** are limited separately: 5 wrong passwords lock an account for 15 minutes.

### Pages

A list that can grow takes `limit` (1 to 100, default 50) and `cursor`, and answers `items` plus `nextCursor`. Send the `nextCursor` of one answer as the `cursor` of the next request until it is `null`. On the notification lists the cursor is the last row's position in time (newest first, with the id as the tie-breaker), so it stays valid even if that row is removed. On the approval lists the cursor names the last row you saw; if that row has since left the list (for example an approval was cancelled), the answer is `422` on `cursor` and the app starts again from the top. A page never repeats or skips a row while the list stays the same.

On `GET /portal/notifications` a page is filled with rows the client can open now: rows whose bug or request is no longer visible are skipped while reading on, so a page can be shorter than `limit` only at the end of the list.

Paged today: `GET /workspace/notifications`, `GET /workspace/bugs`, `GET /portal/notifications`, `GET /portal/bug-reports`, `GET /portal/approvals` and `GET /workspace/bug-approvals`.

`GET /portal/bugs` answers a bare array capped at 200, so it could not gain a cursor without breaking released apps. It stays as it is, marked deprecated in the contract, and `GET /portal/bug-reports` takes its place with the same filters (`mine`, `projectId`, `status`) and the page fields. Per the versioning rules below it is kept for at least 6 months after the first app release that stops using it. The portal bug reports cursor is the last bug's position in time (newest first, id as the tie-breaker), and a page skips bugs whose task is archived while reading on, as the older list did.

### Logs

Every request writes one `Mobile API request` line with `requestId`, `method`, `operationId`, `status`, `code` (on failures), `userId` and `durationMs`. Bodies, query strings, headers and signed URLs are never logged. Support finds a failed request by the `requestId` the app shows (the `x-request-id` header).

## Writes

- Every `POST`, `PATCH` and `DELETE` needs an `Idempotency-Key` header of 8 to 128 characters. Resend the same key when retrying; the first result is replayed instead of acting twice. A key reused for a different request returns `409`. `readIdempotencyKey` (`src/server/api/idempotency-key.ts`) reads it, and the service passes it to `Idempotency.run`.
- A route that returns a signed storage URL opts out with `idempotency: "none"` in its definition: it neither needs nor documents the header, like the web actions that hand out signed URLs. Everything else that writes needs it.
- Records that can be edited concurrently carry a `version`. Send it back as `expectedVersion`; a stale value returns `409`.

## Writing a route

1. Add its entry to the domain's list (`src/mobile-api/routes-tasks.ts`, `routes-bugs.ts`, `routes-notifications.ts`, `routes-attachments.ts`). An entry names the operation, method, path, response `data` schema and, when it takes them, `params`, `query` and `body` schemas. Paths start with `/api/v1/workspace/` for staff or `/api/v1/portal/` for clients.
2. Add `app/api/v1/<path>/route.ts`. A dynamic segment `{id}` is the folder `[id]`. Next passes `params` as a promise.
3. In the handler, run one Effect program through `respondWith`: resolve the caller with `AuthSession` (`requireWorkspaceAccess` or `requirePortalAccess`), read the input with `readRouteInput(route, request, await params)`, then call the domain service in `src/server/<domain>/`. Domain rules, authorization and transactions stay in the service, never in the route.
4. A write passes `input.idempotencyKey` to the service, which wraps its work in `Idempotency.run`, and passes `expectedVersion` through where the record has a `version`.
5. Test it through the route handler with a bearer token (`personaBearerToken` in `tests/backend/support/action-harness.ts`), including the denied cases and that a refused write leaves the database unchanged.

Use `Schema.FiniteFromString` for numeric query values: `Schema.NumberFromString` accepts text such as `many` as `NaN`.

## Pending routes and the mobile app

The Expo app in apps/mobile keeps its own pending route definitions under src/api/pending-routes/ for domains whose live lists have not landed on main yet. When a domain's routes-<domain>.ts lands: merge main, delete that domain's pending file and mock, and flip its screens to the live client. The app's pending-audit test lists the domains still pending.

## Routes

| Method | Path | Who | Idempotency-Key | Purpose |
| --- | --- | --- | --- | --- |
| `GET` | `/api/v1/me` | any signed-in account | read | Who the bearer token belongs to. |
| `POST` | `/api/v1/me/password` | any signed-in account | not used | Replace the caller's password, which also ends their other sessions. Open to an account that must change its password first. |
| `GET` | `/api/v1/workspace/me/work` | admin, employee | read | Open tasks assigned to the caller: all of them, those due today or earlier, or only the overdue ones. |
| `GET` | `/api/v1/workspace/tasks/{taskId}` | admin, employee | read | One task with its assignees, subtasks, discussion, version and what the caller may do with it. |
| `PATCH` | `/api/v1/workspace/tasks/{taskId}` | admin, employee | required | Change a task's status, priority, due date or assignees. Needs the version the caller last saw; a stale one answers 409. |
| `GET` | `/api/v1/workspace/projects` | admin, employee | read | The workspace's active projects with their task counts and progress, one page at a time. |
| `GET` | `/api/v1/workspace/budgets` | admin, employee | read | Each project's time budget with what has been spent and its alert level, one page at a time. |
| `GET` | `/api/v1/workspace/tasks` | admin, employee | read | The workspace's open tasks, newest first, one page at a time. Bugs and archived tasks are left out; filter by project, status or the caller's own assignments. |
| `POST` | `/api/v1/workspace/tasks` | admin, employee | required | Create a task in an active project and assign it. Admins and employees follow the same rules as the web. |
| `POST` | `/api/v1/workspace/tasks/{taskId}/subtasks` | admin, employee | required | Add a subtask to a task the caller may edit. Answers with the task's new version. |
| `PATCH` | `/api/v1/workspace/tasks/{taskId}/subtasks/{subtaskId}` | admin, employee | required | Update or toggle a subtask of a task the caller may edit. Fields left out keep their value. |
| `POST` | `/api/v1/workspace/tasks/{taskId}/subtasks/{subtaskId}/status` | admin, employee | required | Mark a subtask done or not done. Needs the task version the caller last saw; a stale one answers 409. |
| `POST` | `/api/v1/workspace/tasks/{taskId}/comments` | admin, employee | required | Add a comment to a task. It is internal unless the caller makes a public reply on a client bug. |
| `GET` | `/api/v1/workspace/me/timer` | admin, employee | read | The caller's running timer, or null when no timer is running. |
| `POST` | `/api/v1/workspace/me/timer/start` | admin, employee | required | Start the caller's timer on an open task, saving the timer that was running before. |
| `POST` | `/api/v1/workspace/me/timer/stop` | admin, employee | required | Stop the caller's timer and save its time as an entry. Answers 404 when none is running. |
| `GET` | `/api/v1/portal/bugs` | client | read | Deprecated: use `/api/v1/portal/bug-reports`. The company's newest 200 bug reports, with no way to reach older ones. |
| `GET` | `/api/v1/portal/bug-reports` | client | read | The company's bug reports, newest first, one page at a time, with the same filters. |
| `POST` | `/api/v1/portal/bugs` | client | required | Report a bug for the client's company. |
| `GET` | `/api/v1/portal/bugs/{bugId}` | client | read | One of the company's bug reports, with only what a client may see. |
| `POST` | `/api/v1/portal/bugs/{bugId}/comments` | client | required | Answer the team or reply on one of the company's bug reports. |
| `POST` | `/api/v1/portal/bugs/{bugId}/confirm` | client | required | Confirm that the fix works, which closes the report. |
| `POST` | `/api/v1/portal/bugs/{bugId}/reopen` | client | required | Say the fix did not work, with the reason, to send the report back. |
| `GET` | `/api/v1/portal/projects` | client | read | The projects shared with the client's company, one page at a time. |
| `GET` | `/api/v1/portal/approvals` | client | read | The client's pending and decided approvals. |
| `GET` | `/api/v1/portal/approvals/{requestId}` | client | read | One approval request, with its files and earlier versions. |
| `POST` | `/api/v1/portal/approvals/decide` | client | required | Approve a deliverable or ask the team for changes. |
| `GET` | `/api/v1/workspace/bugs` | admin, employee | read | The bugs the caller handles or is assigned to (an admin sees all), most recently changed first, one page at a time. |
| `GET` | `/api/v1/workspace/bugs/{bugId}` | admin, employee | read | A bug's full staff history, with its client context and evidence. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/comments` | admin, employee | required | Reply in a bug's discussion, as an internal note or as a reply the client sees. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/pick` | admin, employee | required | Pick up a client report. Only a designated handler of the client's company may. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/triage` | admin, employee | required | Set the assignees, priority and severity of a client report. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/reassign` | admin, employee | required | Hand a picked client bug to exactly one employee. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/request-info` | admin, employee | required | Ask the client a question and wait for their answer. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/fix-attempts` | admin, employee | required | Record the root cause, the fix and how to verify it. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/verifications` | admin, employee | required | Say whether a fix attempt passed its verification. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/approval` | admin, employee | required | Send a verified fix to an admin for approval. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/approval/decision` | admin, employee | required | Approve a fix for release or send it back with a reason. |
| `GET` | `/api/v1/workspace/bug-approvals` | admin, employee | read | The bug approvals with their status, newest first. |
| `POST` | `/api/v1/workspace/approvals` | admin, employee | required | Ask a client company to approve a shared task with its finished files. |
| `GET` | `/api/v1/workspace/notifications` | admin, employee | read | The caller's notifications, newest first, one page at a time, with the unread counts. |
| `POST` | `/api/v1/workspace/notifications/{id}/read` | admin, employee | required | Mark one of the caller's notifications read. Repeating it changes nothing. |
| `POST` | `/api/v1/workspace/notifications/read-all` | admin, employee | required | Mark every unread notification of the caller read; answers how many changed. |
| `GET` | `/api/v1/workspace/notifications/{id}/target` | admin, employee | read | The task or bug one of the caller's notifications opens, checked again now; answers not found when it cannot be opened. |
| `GET` | `/api/v1/workspace/notifications/preferences` | admin, employee | read | The kinds of notification the caller switched on or off, per channel. |
| `PATCH` | `/api/v1/workspace/notifications/preferences` | admin, employee | required | Switch one kind of notification on or off for one channel; email exists only for some kinds. |
| `GET` | `/api/v1/portal/notifications` | client | read | The caller's notifications, newest first, each tied to a bug or request they can open now. |
| `POST` | `/api/v1/portal/notifications/{id}/read` | client | required | Mark one of the caller's notifications read. Repeating it changes nothing. |
| `POST` | `/api/v1/portal/notifications/read-all` | client | required | Mark every unread notification of the caller read; answers how many changed. |
| `GET` | `/api/v1/portal/notifications/{id}/target` | client | read | The bug or request one of the caller's notifications opens, checked again now; answers not found when it cannot be opened. |
| `GET` | `/api/v1/portal/notifications/preferences` | client | read | The kinds of notification a client switched on or off, per channel; only kinds a client can receive. |
| `PATCH` | `/api/v1/portal/notifications/preferences` | client | required | Switch one kind of notification on or off for one channel; only replies and status changes can be set. |
| `POST` | `/api/v1/workspace/attachments/uploads` | admin, employee | not used | A signed URL for uploading one file to a task. |
| `POST` | `/api/v1/workspace/attachments/uploads/{uploadIntentId}/finalize` | admin, employee | required | Turns a finished upload into a file on the task. |
| `GET` | `/api/v1/workspace/attachments` | admin, employee | read | The files attached to a task. |
| `GET` | `/api/v1/workspace/attachments/{fileId}/download` | admin, employee | read | A short-lived link that downloads one file. |
| `GET` | `/api/v1/workspace/attachments/{fileId}/preview` | admin, employee | read | A short-lived link that shows one image or PDF inline. |
| `POST` | `/api/v1/workspace/attachments/bug-evidence` | admin, employee | required | Links a finished upload to a bug as before or after evidence. |
| `POST` | `/api/v1/portal/attachments/uploads` | client | not used | A signed URL for uploading one file to the client's own bug. |
| `POST` | `/api/v1/portal/attachments/uploads/{uploadIntentId}/finalize` | client | required | Turns a finished upload into an attachment of the bug. |
| `GET` | `/api/v1/portal/attachments` | client | read | The files the client company attached to one of its bugs. |
| `GET` | `/api/v1/portal/attachments/{fileId}/download` | client | read | A short-lived link that downloads one visible file. |
| `GET` | `/api/v1/portal/attachments/{fileId}/preview` | client | read | A short-lived link that shows one visible image or PDF inline. |
| `GET` | `/api/v1/openapi.json` | public | read | This contract. |

## Who may call what

Every route under `/api/v1/workspace/` is for admins and employees, every route under `/api/v1/portal/` is for client accounts, and `/api/v1/me` and `/api/v1/me/password` are for any signed-in account. The gate runs before anything the caller sent is read (`readRouteInput`), so every kind of caller gets the same answer whatever is in the body:

| Caller | `/me` | `/workspace/*` | `/portal/*` |
| --- | --- | --- | --- |
| No token, a token that was never issued, a revoked session, a deactivated account | 401 | 401 | 401 |
| Account that must change its password first | allowed in | 403 | 403 |
| Admin or employee | allowed in | allowed in | 403 |
| Client (any company) | allowed in | 403 | allowed in |

### Changing the password

A new employee or client signs in with a temporary password and every workspace and portal route answers `403` ("Change your password before continuing.") until it is replaced. The app sends `POST /api/v1/me/password` with `{ "currentPassword": "…", "newPassword": "…" }` and the bearer token; no `Idempotency-Key` is needed, and the password is never stored for replay. The new password must be 12 to 128 characters. On success the answer is `{ "changed": true }`, the account is no longer forced, every other session of the account ends (this one stays), and the change is audited.

A wrong current password answers `422`. Wrong current passwords count against the same lock as wrong sign-ins: after 5 in a row the account is locked for 15 minutes, and the route answers `429` (`RATE_LIMITED`) until the lock runs out. A correct change resets the count.

"Allowed in" only means the caller passed the door; what the route then does is decided by the service. In particular: only a designated handler of a company may pick up its reports; only an admin, the creator or an assignee may edit a task; a client sees only its own company's bugs, approvals, files and notifications, never internal notes; and every refused write leaves the database unchanged. `tests/backend/mobile-api-permission-matrix.test.ts` asks every route in this table as each kind of caller, and `tests/backend/mobile-api-docs.test.ts` fails when this table and the route list disagree.

## Audit of the selected workflows

A static read of the schema and services plus the tests above. "Fixed" items have a test that failed before the change.

**Fixed in Phase 1**

- Two stops of the same timer could each save a time entry, and two starts surfaced as 503. A counted delete now lets one stop win, and the second start answers 409.
- A client account could be set as the assignee of a subtask.
- `BugHistory.get` and `listComments` relied on their callers to keep clients out; both now refuse a client themselves.
- A client's ten-file cap per bug could be exceeded by requests made together; they now take turns on the bug's row. Finalizing a file for a bug closed after the ticket was issued is refused (checked: already safe through the mobile route).
- Nine routes read and validated the body before checking the session, so a bad token with a bad body answered 422 instead of 401; the audience gate now runs first for every route.
- Finalizing an upload whose object was never written answered 503; it now answers 422 "has not been uploaded yet".

**Accepted: the web already works this way**

- Any active staff member can read any task or bug by id, and download any task file; the mobile bug _list_ is narrower (bugs the caller handles or is assigned to; admins see all). Opening a notification therefore still works after a person is unassigned.
- Any user of a client company can decide that company's approval requests; an admin can decide a fix approval they submitted themselves.
- Approval requests have no expiry. Older notifications without a recorded target answer "cannot be opened".
- A concurrent duplicate request (the same `Idempotency-Key` while the first is still running) answers 409 "already being processed". The app waits a moment and sends the same key again; once the first finishes, the retry gets the stored result. The server does not hold the second request open.
- The client idle timeout follows the account's last activity, not each device.

**Fixed in the second batch** (each has a test that failed before the change)

- The auto-close jobs for bugs waiting on a client read the bug twice, so a confirmation committed in between could be overwritten. They now decide from the same row they update.
- A removed file that an approval request still lists made the file cleanup job fail on every run, stopping all cleanup behind it. The job now skips such a file and carries on. Approval detail and lists no longer show or count a removed file.
- Subtasks of a bug task were editable through the subtask routes (the web hides them) and the task context offered `manageSubtasks` for bugs. Both are refused now.
- Comments were accepted on tasks of an archived project. They now answer 404, like archived tasks.
- Who may edit a task (admin, creator or assignee) was decided in several places. It is one function now, and the update, subtask, label and upload routes check it before the version, so someone who may not edit gets 403 and never learns that the task changed.
- The database now refuses a task archived without saying who archived it (or the reverse), a subtask whose completed flag disagrees with its completion time, and a fix attempt with a partly recorded verification.
- A timer still saves its time when its task is archived while it runs (checked, and now covered by a test).
- Bug status changes were checked by each caller, and the transition table disagreed with the code (it lacked withdraw, asking for information, the client's answer, closing as not a bug, and a client reopen to `reported` or `in_progress`). There is one table now (`bug-status-edges.ts`), built from the moves the workflow really makes, and `updateBugStatus` refuses any other move. A test lists all 169 pairs.
- `GET /portal/approvals` and `GET /workspace/bug-approvals` had no cap and now take `limit` and `cursor` (see Pages above). `GET /portal/notifications` read only the newest 50 rows and skipped the ones the client could no longer open, so a client could never reach older notifications; it now pages through all of them.
- `GET /portal/notifications` skipped the rate limit and the request log, because it never went through the same gate as the other routes. It does now, and a test calls every route and fails, naming it, if one skips the gate.
- A client could only ever see the company's newest 200 bug reports. `GET /portal/bug-reports` pages through all of them.

**Open: found, not changed**

- `GET /portal/bugs` is still silently capped at 200 until it is switched off; it is deprecated in favour of `GET /portal/bug-reports`.
- A file that is on an approval request can still be removed by its owner (it is hidden from the request, but the row stays until nothing references it).
- A few web actions still check the version before the edit permission (task reschedule, client visibility, approval requests), so a person who may not edit can see a version conflict instead of a refusal. The mobile routes are consistent.
