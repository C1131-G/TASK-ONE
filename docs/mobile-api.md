# Mobile API

All routes use the authenticated mobile API. Paths use braces for route parameters.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/v1/me` | Authenticated bearer token | Who the bearer token belongs to. |
| `POST` | `/api/v1/me/password` | Authenticated bearer token | Replace the caller's password, which also ends their other sessions. Open to an account that must change its password first. |
| `GET` | `/api/v1/workspace/tasks` | Authenticated bearer token | The workspace's open tasks, newest first, one page at a time. Bugs and archived tasks are left out; filter by project, status or the caller's own assignments. |
| `GET` | `/api/v1/workspace/me/work` | Authenticated bearer token | Open tasks assigned to the caller: all of them, those due today or earlier, or only the overdue ones. |
| `GET` | `/api/v1/workspace/tasks/{taskId}` | Authenticated bearer token | One task with its assignees, subtasks, discussion, version and what the caller may do with it. |
| `PATCH` | `/api/v1/workspace/tasks/{taskId}` | Authenticated bearer token | Change a task's status, priority, due date or assignees. Needs the version the caller last saw; a stale one answers 409. |
| `POST` | `/api/v1/workspace/tasks` | Authenticated bearer token | Create a task in an active project and assign it. Admins and employees follow the same rules as the web. |
| `POST` | `/api/v1/workspace/tasks/{taskId}/subtasks` | Authenticated bearer token | Add a subtask to a task the caller may edit. Answers with the task's new version. |
| `PATCH` | `/api/v1/workspace/tasks/{taskId}/subtasks/{subtaskId}` | Authenticated bearer token | Update or toggle a subtask of a task the caller may edit. Fields left out keep their value. |
| `POST` | `/api/v1/workspace/tasks/{taskId}/subtasks/{subtaskId}/status` | Authenticated bearer token | Mark a subtask done or not done. Needs the task version the caller last saw; a stale one answers 409. |
| `POST` | `/api/v1/workspace/tasks/{taskId}/comments` | Authenticated bearer token | Add a comment to a task. It is internal unless the caller makes a public reply on a client bug. |
| `GET` | `/api/v1/workspace/me/timer` | Authenticated bearer token | The caller's running timer, or null when no timer is running. |
| `POST` | `/api/v1/workspace/me/timer/start` | Authenticated bearer token | Start the caller's timer on an open task, saving the timer that was running before. |
| `POST` | `/api/v1/workspace/me/timer/stop` | Authenticated bearer token | Stop the caller's timer and save its time as an entry. Answers 404 when none is running. |
| `GET` | `/api/v1/portal/bug-reports` | Authenticated bearer token | The company's bug reports, newest first, one page at a time. Takes the same filters as the older list. |
| `POST` | `/api/v1/portal/bugs` | Authenticated bearer token | Report a bug for the client's company. |
| `GET` | `/api/v1/portal/bugs/{bugId}` | Authenticated bearer token | One of the company's bug reports, with only what a client may see. |
| `POST` | `/api/v1/portal/bugs/{bugId}/comments` | Authenticated bearer token | Answer the team or reply on one of the company's bug reports. |
| `POST` | `/api/v1/portal/bugs/{bugId}/confirm` | Authenticated bearer token | Confirm that the fix works, which closes the report. |
| `POST` | `/api/v1/portal/bugs/{bugId}/reopen` | Authenticated bearer token | Say the fix did not work, with the reason, to send the report back. |
| `GET` | `/api/v1/portal/approvals` | Authenticated bearer token | The client's pending and decided approvals, pending first, one page at a time. |
| `GET` | `/api/v1/portal/approvals/{requestId}` | Authenticated bearer token | One approval request, with its files and earlier versions. |
| `POST` | `/api/v1/portal/approvals/decide` | Authenticated bearer token | Approve a deliverable or ask the team for changes. |
| `GET` | `/api/v1/workspace/bugs/{bugId}` | Authenticated bearer token | A bug's full staff history, with its client context. |
| `GET` | `/api/v1/workspace/bugs` | Authenticated bearer token | The bugs the caller handles or is assigned to (an admin sees all), most recently changed first, one page at a time. |
| `GET` | `/api/v1/workspace/bug-approvals` | Authenticated bearer token | The bug approvals with their status, newest first, one page at a time. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/comments` | Authenticated bearer token | Reply in a bug's discussion, as an internal note or as a reply the client sees. |
| `POST` | `/api/v1/workspace/approvals` | Authenticated bearer token | Ask a client company to approve a shared task with its finished files. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/approval` | Authenticated bearer token | Send a verified fix to an admin for approval. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/approval/decision` | Authenticated bearer token | Approve a fix for release or send it back with a reason. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/fix-attempts` | Authenticated bearer token | Record the root cause, the fix and how to verify it. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/pick` | Authenticated bearer token | Pick up a client report. Only a designated handler of the client's company may. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/reassign` | Authenticated bearer token | Hand a picked client bug to exactly one employee. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/request-info` | Authenticated bearer token | Ask the client a question and wait for their answer. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/triage` | Authenticated bearer token | Set the assignees, priority and severity of a client report. |
| `POST` | `/api/v1/workspace/bugs/{bugId}/verifications` | Authenticated bearer token | Say whether a fix attempt passed its verification. |
| `GET` | `/api/v1/workspace/notifications` | Authenticated bearer token | The caller's notifications, newest first, one page at a time, with the unread counts. |
| `POST` | `/api/v1/workspace/notifications/{id}/read` | Authenticated bearer token | Mark one of the caller's notifications read. Repeating it changes nothing. |
| `POST` | `/api/v1/workspace/notifications/read-all` | Authenticated bearer token | Mark every unread notification of the caller read; answers how many changed. |
| `GET` | `/api/v1/workspace/notifications/preferences` | Authenticated bearer token | The kinds of notification the caller switched on or off, per channel. |
| `PATCH` | `/api/v1/workspace/notifications/preferences` | Authenticated bearer token | Switch one kind of notification on or off for one channel; email exists only for some kinds. |
| `GET` | `/api/v1/portal/notifications` | Authenticated bearer token | The caller's notifications, newest first, one page at a time, each tied to a bug or request they can open now. |
| `POST` | `/api/v1/portal/notifications/{id}/read` | Authenticated bearer token | Mark one of the caller's notifications read. Repeating it changes nothing. |
| `POST` | `/api/v1/portal/notifications/read-all` | Authenticated bearer token | Mark every unread notification of the caller read; answers how many changed. |
| `GET` | `/api/v1/workspace/notifications/{id}/target` | Authenticated bearer token | The task or bug one of the caller's notifications opens, checked again now; answers not found when it cannot be opened. |
| `GET` | `/api/v1/portal/notifications/{id}/target` | Authenticated bearer token | The bug or request one of the caller's notifications opens, checked again now; answers not found when it cannot be opened. |
| `GET` | `/api/v1/portal/notifications/preferences` | Authenticated bearer token | The kinds of notification a client switched on or off, per channel; only kinds a client can receive. |
| `PATCH` | `/api/v1/portal/notifications/preferences` | Authenticated bearer token | Switch one kind of notification on or off for one channel; only replies and status changes can be set. |
| `POST` | `/api/v1/workspace/attachments/uploads` | Authenticated bearer token | A signed URL for uploading one file to a task. |
| `POST` | `/api/v1/workspace/attachments/uploads/{uploadIntentId}/finalize` | Authenticated bearer token | Turns a finished upload into a file on the task. |
| `GET` | `/api/v1/workspace/attachments` | Authenticated bearer token | The files attached to a task. |
| `GET` | `/api/v1/workspace/attachments/{fileId}/download` | Authenticated bearer token | A short-lived link that downloads one file. |
| `GET` | `/api/v1/workspace/attachments/{fileId}/preview` | Authenticated bearer token | A short-lived link that shows one image or PDF inline. |
| `POST` | `/api/v1/workspace/attachments/bug-evidence` | Authenticated bearer token | Links a finished upload to a bug as before or after evidence. |
| `POST` | `/api/v1/portal/attachments/uploads` | Authenticated bearer token | A signed URL for uploading one file to the client's own bug. |
| `POST` | `/api/v1/portal/attachments/uploads/{uploadIntentId}/finalize` | Authenticated bearer token | Turns a finished upload into an attachment of the bug. |
| `GET` | `/api/v1/portal/attachments` | Authenticated bearer token | The files the client company attached to one of its bugs. |
| `GET` | `/api/v1/portal/attachments/{fileId}/download` | Authenticated bearer token | A short-lived link that downloads one visible file. |
| `GET` | `/api/v1/portal/attachments/{fileId}/preview` | Authenticated bearer token | A short-lived link that shows one visible image or PDF inline. |
| `GET` | `/api/v1/workspace/projects` | Authenticated bearer token | The workspace's active projects with their task counts and progress, one page at a time. |
| `GET` | `/api/v1/workspace/budgets` | Authenticated bearer token | Each project's time budget with what has been spent and its alert level, one page at a time. |
| `GET` | `/api/v1/portal/projects` | Authenticated bearer token | The projects shared with the client's company, one page at a time. |
| `GET` | `/api/v1/workspace/members` | Authenticated bearer token | The employee directory, optionally narrowed by a search text, one page at a time. |
| `GET` | `/api/v1/workspace/teams` | Authenticated bearer token | The teams with their member counts, one page at a time. |
| `GET` | `/api/v1/workspace/clients` | Authenticated bearer token | The client companies with their project, user and open bug counts, one page at a time. |
| `GET` | `/api/v1/workspace/activity` | Authenticated bearer token | The workspace's most recent activity, newest first, one page at a time. The feed reaches back over the latest 100 entries. |
| `GET` | `/api/v1/workspace/workload` | Authenticated bearer token | Each person's open work over the coming weeks, in hours against the weekly capacity. |
| `GET` | `/api/v1/workspace/my-time` | Authenticated bearer token | The caller's own time entries for the week that holds `date` (today when left out), with totals per day. |
| `GET` | `/api/v1/workspace/search` | Authenticated bearer token | Projects and tasks whose name matches the text. The answer is short by design: the best matches only. |
| `GET` | `/api/v1/workspace/favorites` | Authenticated bearer token | The projects and tasks the caller starred, projects first, one page at a time. |
| `GET` | `/api/v1/workspace/archive` | Authenticated bearer token | Archived projects and tasks, most recently archived first, one page at a time. The list reaches back over the latest 500 archived tasks. |
| `GET` | `/api/v1/workspace/files` | Authenticated bearer token | The standalone files (not attached to a task) of one project, or of every active project when `projectId` is left out, newest first, one page at a time. Admins only, as on the web: for anyone else a named project answers 403 and the unnamed list is empty. |
