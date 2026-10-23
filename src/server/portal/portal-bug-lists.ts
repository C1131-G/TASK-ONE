import { and } from "@prisma/orm-postgres/orm-client";
import type { Effect } from "effect";

import { approvalLinksFor } from "../approvals/approval-notification-links";
import { loadSlaSettings } from "../company/sla-settings";
import type { AppError } from "../core/action-result";
import { run } from "./portal-bug-access";
import type {
  PortalActor,
  PortalNotificationList,
  PortalProject,
  PortalResponseTimes,
} from "./portal-contracts";

export const listProjects = (
  actor: PortalActor
): Effect.Effect<readonly PortalProject[], AppError> =>
  run(async (transaction) => {
    const links = await transaction.orm.public.ClientCompanyProject.where({
      companyId: actor.clientCompanyId,
      removedAt: null,
    })
      .select("projectId")
      .all();
    if (links.length === 0) {
      return [];
    }
    const projects = await transaction.orm.public.Project.where((project) =>
      and(
        project.id.in(links.map(({ projectId }) => projectId)),
        project.archivedAt.isNull()
      )
    )
      .orderBy((project) => project.name.asc())
      .all();
    return projects.map(({ id, key, name }) => ({ id, key, name }));
  });

export const responseTimes = (
  _actor: PortalActor
): Effect.Effect<PortalResponseTimes, AppError> =>
  run(async (transaction) => {
    const settings = await loadSlaSettings(transaction);
    const { targets, calendar } = settings;
    return {
      businessDays: [...calendar.days],
      businessEndMinute: calendar.endMinute,
      businessStartMinute: calendar.startMinute,
      firstResponseMinutes: {
        high: targets.high.firstResponseMinutes,
        low: targets.low.firstResponseMinutes,
        medium: targets.medium.firstResponseMinutes,
        urgent: targets.urgent.firstResponseMinutes,
      },
      timeZone: calendar.timeZone,
    };
  });

export const listNotifications = (
  actor: PortalActor
): Effect.Effect<PortalNotificationList, AppError> =>
  run(async (transaction) => {
    const [notifications, unread] = await Promise.all([
      transaction.orm.public.Notification.where({ userId: actor.id })
        .orderBy((notification) => notification.createdAt.desc())
        .limit(50)
        .all(),
      transaction.orm.public.Notification.where({
        readAt: null,
        userId: actor.id,
      }).aggregate((aggregates) => ({ count: aggregates.count() })),
    ]);
    const taskIds = [
      ...new Set(
        notifications.flatMap(({ taskId }) => (taskId ? [taskId] : []))
      ),
    ];
    const bugs =
      taskIds.length === 0
        ? []
        : await transaction.orm.public.BugReport.where((bug) =>
            and(
              bug.taskId.in(taskIds),
              bug.clientCompanyId.eq(actor.clientCompanyId)
            )
          )
            .select("id", "taskId")
            .all();
    const bugByTask = new Map(bugs.map((bug) => [bug.taskId, bug.id]));
    const approvalLinks = await approvalLinksFor(
      transaction,
      actor.clientCompanyId,
      notifications
    );
    return {
      items: notifications.flatMap((notification) => {
        let bugId: string | null = null;
        if (notification.taskId) {
          bugId = bugByTask.get(notification.taskId) ?? null;
        }
        // A notification about anything but this company's bugs is not shown.
        if (notification.taskId && !bugId) {
          return [];
        }
        return [
          {
            approvalId: approvalLinks.get(notification.id) ?? null,
            bugId,
            createdAt: notification.createdAt.toISOString(),
            id: notification.id,
            readAt: notification.readAt?.toISOString() ?? null,
            snippet: notification.snippet,
            text: notification.text,
          },
        ];
      }),
      unreadCount: unread.count,
    };
  });
