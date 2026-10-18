import { and, or } from "@prisma/orm-postgres/orm-client";
import type { Effect } from "effect";

import {
  clientStatusLabel,
  internalStatusesFor,
} from "@/features/portal/client-status";

import { loadSlaSettings } from "../company/sla-settings";
import type { AppError } from "../core/action-result";
import { decodeBugWorkflowStatus } from "../work/bug-workflow-internal";
import {
  PROJECT_REMOVED_MESSAGE,
  loadCompanyBug,
  ARCHIVED_OR_CLOSED,
  run,
} from "./portal-bug-access";
import {
  buildLifecycle,
  clientTimeline,
  clientVisibleAttachments,
  timelineActions,
} from "./portal-bug-view";
import type {
  PortalActor,
  PortalBugDetail,
  PortalBugSummary,
} from "./portal-contracts";
import type { ListCompanyBugsInput } from "./portal-input-contracts";

export const listBugs = (
  actor: PortalActor,
  input: ListCompanyBugsInput
): Effect.Effect<readonly PortalBugSummary[], AppError> =>
  run(async (transaction) => {
    const label = input.status;
    // "Not a bug" is a closed bug with that resolution, so both labels also
    // look at the resolution.
    const statuses = label ? [...internalStatusesFor(label)] : [];
    const bugs = await transaction.orm.public.BugReport.where((bug) =>
      and(
        bug.clientCompanyId.eq(actor.clientCompanyId),
        ...(input.projectId ? [bug.projectId.eq(input.projectId)] : []),
        ...(input.mine ? [bug.reporterId.eq(actor.id)] : []),
        ...(label ? [bug.status.in(statuses)] : []),
        ...(label === "not_a_bug" ? [bug.resolution.eq("not_a_bug")] : []),
        ...(label === "closed"
          ? [or(bug.resolution.isNull(), bug.resolution.neq("not_a_bug"))]
          : [])
      )
    )
      .orderBy((bug) => bug.discoveredAt.desc())
      .limit(200)
      .all();
    if (bugs.length === 0) {
      return [];
    }
    const [tasks, projects, reporters] = await Promise.all([
      transaction.orm.public.Task.where((task) =>
        task.id.in(bugs.map(({ taskId }) => taskId))
      ).all(),
      transaction.orm.public.Project.where((project) =>
        project.id.in([...new Set(bugs.map(({ projectId }) => projectId))])
      ).all(),
      transaction.orm.public.User.where((user) =>
        user.id.in([...new Set(bugs.map(({ reporterId }) => reporterId))])
      )
        .select("id", "name")
        .all(),
    ]);
    const taskById = new Map(tasks.map((task) => [task.id, task]));
    const projectById = new Map(
      projects.map((project) => [project.id, project])
    );
    const reporterById = new Map(reporters.map((user) => [user.id, user.name]));
    return bugs.flatMap((bug) => {
      const task = taskById.get(bug.taskId);
      const project = projectById.get(bug.projectId);
      if (!task || !project || task.archivedAt) {
        return [];
      }
      return [
        {
          createdAt: bug.createdAt.toISOString(),
          id: bug.id,
          impact: bug.clientImpact,
          isMine: bug.reporterId === actor.id,
          key: `${project.key}-${task.projectTaskNumber}`,
          projectId: project.id,
          projectName: project.name,
          reporterName: reporterById.get(bug.reporterId) ?? "A colleague",
          status: clientStatusLabel(
            decodeBugWorkflowStatus(bug.status),
            bug.resolution
          ),
          title: task.title,
          updatedAt: bug.updatedAt.toISOString(),
        },
      ];
    });
  });

export const getBug = (
  actor: PortalActor,
  bugId: string
): Effect.Effect<PortalBugDetail, AppError> =>
  run(async (transaction) => {
    const { bug, project, projectLinked, task } = await loadCompanyBug(
      transaction,
      actor,
      bugId
    );
    const [comments, evidence, activities, reporter, sla, slaSettings] =
      await Promise.all([
        transaction.orm.public.Comment.include("author")
          .where({ deletedAt: null, taskId: task.id, visibility: "public" })
          .orderBy((comment) => comment.createdAt.asc())
          .limit(200)
          .all(),
        transaction.orm.public.BugEvidence.where((row) =>
          and(row.bugReportId.eq(bug.id), row.fileAssetId.isNotNull())
        )
          .orderBy((row) => row.createdAt.asc())
          .all(),
        transaction.orm.public.Activity.where((activity) =>
          and(activity.taskId.eq(task.id), activity.action.in(timelineActions))
        )
          .orderBy((activity) => activity.createdAt.asc())
          .limit(200)
          .all(),
        transaction.orm.public.User.where({ id: bug.reporterId })
          .select("name")
          .first(),
        transaction.orm.public.BugSla.where({ bugId: bug.id }).first(),
        loadSlaSettings(transaction),
      ]);
    const fileIds = evidence.flatMap(({ fileAssetId }) =>
      fileAssetId ? [fileAssetId] : []
    );
    const files =
      fileIds.length === 0
        ? []
        : await transaction.orm.public.FileAsset.include("uploadedBy")
            .where((file) => and(file.id.in(fileIds), file.deletedAt.isNull()))
            .all();
    // Only what client-company users attached is shown; staff evidence stays
    // internal.
    const attachments = clientVisibleAttachments(files, actor.clientCompanyId);
    const status = decodeBugWorkflowStatus(bug.status);
    const label = clientStatusLabel(status, bug.resolution);
    const timeline = clientTimeline(activities);
    const open = !ARCHIVED_OR_CLOSED.has(status) && projectLinked;
    const isReporter = bug.reporterId === actor.id;
    const built = await buildLifecycle(
      transaction,
      actor,
      bug,
      comments.map((comment) => ({
        body: comment.body,
        isTeam: comment.author.role !== "client",
      }))
    );
    // A removed project leaves the report readable but takes every action away.
    const lifecycle = projectLinked
      ? built
      : {
          ...built,
          canRate: false,
          canReportAgain: false,
          verification: built.verification
            ? { ...built.verification, canReopen: false, canRespond: false }
            : null,
        };
    return {
      actualBehavior: bug.actualBehavior,
      attachments,
      browser: bug.browser,
      canAttach: open,
      canComment: open,
      canEdit: projectLinked && isReporter && status === "reported",
      canWithdraw: projectLinked && isReporter && status === "reported",
      comments: comments.map((comment) => ({
        authorName: comment.author.name,
        body: comment.body,
        createdAt: comment.createdAt.toISOString(),
        id: comment.id,
        isMine: comment.authorId === actor.id,
        isTeam: comment.author.role !== "client",
      })),
      createdAt: bug.createdAt.toISOString(),
      description: bug.description,
      device: bug.device,
      expectedBehavior: bug.expectedBehavior,
      firstResponse: {
        respondedAt: sla?.firstRespondedAt?.toISOString() ?? null,
        targetMinutes: bug.clientImpact
          ? slaSettings.targets[bug.clientImpact].firstResponseMinutes
          : null,
      },
      id: bug.id,
      impact: bug.clientImpact,
      isMine: isReporter,
      key: `${project.key}-${task.projectTaskNumber}`,
      lifecycle,
      os: bug.os,
      pageUrl: bug.route,
      projectId: project.id,
      projectName: project.name,
      readOnlyReason: projectLinked ? null : PROJECT_REMOVED_MESSAGE,
      reporterName: reporter?.name ?? "A colleague",
      reproductionSteps: bug.reproductionSteps,
      status: label,
      timeline,
      title: task.title,
      updatedAt: bug.updatedAt.toISOString(),
      version: bug.version,
    };
  });
