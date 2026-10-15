import type { Pool } from "pg";
// Removes everything the harness and the flows run through it created. Rows
// are found by the harness email domain and by project and team name prefixes,
// so records created inside a test flow are cleaned up as well.
export const cleanActionFixtures = async (
  authPool: Pool,
  EMAIL_DOMAIN: string,
  startedAt: Date,
  originalCompanySettings: Record<string, unknown> | null
): Promise<void> => {
  const users = `(SELECT id FROM "user" WHERE email LIKE '%@${EMAIL_DOMAIN}')`;
  const projects = `(SELECT id FROM project WHERE name LIKE 'Harness%' OR name LIKE 'Replay%')`;
  const tasks = `(SELECT id FROM task WHERE "projectId" IN ${projects} OR "createdById" IN ${users})`;
  const bugs = `(SELECT id FROM bug_report WHERE "taskId" IN ${tasks} OR "reporterId" IN ${users})`;
  const statements = [
    `DELETE FROM recurrence_generation WHERE "sourceTaskId" IN ${tasks} OR "successorTaskId" IN ${tasks}`,
    `DELETE FROM upload_intent WHERE "taskId" IN ${tasks} OR "projectId" IN ${projects} OR "ownerId" IN ${users}`,
    `DELETE FROM bug_release WHERE "bugReportId" IN ${bugs}`,
    `DELETE FROM bug_approval WHERE "bugReportId" IN ${bugs}`,
    `DELETE FROM bug_evidence WHERE "bugReportId" IN ${bugs}`,
    `DELETE FROM bug_relation WHERE "fromBugReportId" IN ${bugs} OR "toBugReportId" IN ${bugs}`,
    `DELETE FROM bug_fix_attempt WHERE "bugReportId" IN ${bugs}`,
    `DELETE FROM bug_sla WHERE "bugId" IN ${bugs}`,
    `DELETE FROM bug_report WHERE id IN ${bugs}`,
    `DELETE FROM file_asset WHERE "projectId" IN ${projects} OR "taskId" IN ${tasks} OR "uploadedById" IN ${users} OR "deletedById" IN ${users}`,
    `DELETE FROM comment WHERE "taskId" IN ${tasks} OR "authorId" IN ${users} OR "deletedById" IN ${users}`,
    `DELETE FROM comment_reaction WHERE "userId" IN ${users}`,
    `DELETE FROM task_subtask WHERE "taskId" IN ${tasks} OR "assigneeId" IN ${users}`,
    `DELETE FROM task_assignee WHERE "taskId" IN ${tasks} OR "userId" IN ${users} OR "assignedById" IN ${users}`,
    `DELETE FROM notification WHERE "userId" IN ${users} OR "actorId" IN ${users}`,
    `DELETE FROM activity WHERE "actorId" IN ${users}`,
    `DELETE FROM audit_event WHERE "actorId" IN ${users} OR "subjectUserId" IN ${users}`,
    `DELETE FROM undo_record WHERE "actorId" IN ${users}`,
    `DELETE FROM idempotency_key WHERE "actorId" IN ${users}`,
    `DELETE FROM push_delivery WHERE "userId" IN ${users}`,
    `DELETE FROM calendar_event WHERE "createdById" IN ${users}`,
    `DELETE FROM calendar_event_attendee WHERE "userId" IN ${users}`,
    `DELETE FROM project_member WHERE "projectId" IN ${projects} OR "userId" IN ${users}`,
    `DELETE FROM task WHERE id IN ${tasks}`,
    `DELETE FROM "user" WHERE email LIKE '%@${EMAIL_DOMAIN}' AND role = 'client'`,
    `DELETE FROM client_company_handler WHERE "companyId" IN (SELECT id FROM client_company WHERE "createdById" IN ${users}) OR "employeeId" IN ${users}`,
    `DELETE FROM client_company_project WHERE "companyId" IN (SELECT id FROM client_company WHERE "createdById" IN ${users}) OR "projectId" IN ${projects}`,
    `DELETE FROM client_company WHERE "createdById" IN ${users}`,
    `DELETE FROM project WHERE id IN ${projects}`,
    `DELETE FROM label WHERE name LIKE 'replay-%'`,
    `DELETE FROM team WHERE name LIKE 'Replay%'`,
    `DELETE FROM "user" WHERE email LIKE '%@${EMAIL_DOMAIN}' AND "deactivatedById" IS NOT NULL`,
    `DELETE FROM "user" WHERE email LIKE '%@${EMAIL_DOMAIN}'`,
  ];
  for (const statement of statements) {
    // Order matters because of the foreign keys between these tables.
    // eslint-disable-next-line no-await-in-loop
    await authPool.query(statement);
  }
  // Actions such as file duplication queue background jobs; remove the ones
  // this run created so they never reach another test's job processor.
  await authPool.query('DELETE FROM job WHERE "createdAt" >= $1', [startedAt]);
  if (originalCompanySettings) {
    await authPool.query(
      'UPDATE company_settings SET name = $1, slug = $2, "brandColor" = $3, "brandEnabled" = $4, "timeZone" = $5',
      [
        originalCompanySettings["name"],
        originalCompanySettings["slug"],
        originalCompanySettings["brandColor"],
        originalCompanySettings["brandEnabled"],
        originalCompanySettings["timeZone"],
      ]
    );
  }
};
