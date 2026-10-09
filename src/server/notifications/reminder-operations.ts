import { randomUUID } from "node:crypto";

import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import {
  getLocalDateAndHour,
  mapError,
  stableNotificationId,
  timezoneForUser,
} from "./service-internal";

export const sendDailyDueSummaries = (
  scheduledAt: Date
): Effect.Effect<{ readonly usersNotified: number }, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      if (!Number.isFinite(scheduledAt.getTime())) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A valid reminder schedule time is required.",
        });
      }
      return db.transaction(async (transaction) => {
        const [users, preferences, projects, companySettings] =
          await Promise.all([
            transaction.orm.public.User.where({
              deactivatedAt: null,
              mustChangePassword: false,
            })
              .select("id", "name")
              .all(),
            transaction.orm.public.UserPreference.where({ key: "display" })
              .select("userId", "value")
              .all(),
            transaction.orm.public.Project.where({ archivedAt: null })
              .select("id")
              .all(),
            transaction.orm.public.CompanySettings.where({ id: "company" })
              .select("timeZone")
              .first(),
          ]);
        const preferencesByUser = new Map(
          preferences.map(({ userId, value }) => [userId, value])
        );
        const activeProjectIds = new Set(projects.map(({ id }) => id));
        let usersNotified = 0;
        await Promise.all(
          users.map(async (user) => {
            const local = getLocalDateAndHour(
              scheduledAt,
              timezoneForUser(
                preferencesByUser.get(user.id),
                companySettings?.timeZone ?? "Asia/Kolkata"
              )
            );
            if (local.hour !== 9) {
              return;
            }
            const assignments =
              await transaction.orm.public.TaskAssignee.include("task")
                .where({ userId: user.id })
                .all();
            const dueTasks = assignments.flatMap(({ task }) =>
              activeProjectIds.has(task.projectId) &&
              !task.archivedAt &&
              task.status !== "done" &&
              task.dueDate !== null &&
              task.dueDate <= local.date
                ? [task]
                : []
            );
            if (dueTasks.length === 0) {
              return;
            }
            const notificationId = stableNotificationId(user.id, local.date);
            const alreadySent = await transaction.orm.public.Notification.where(
              {
                id: notificationId,
              }
            ).first();
            if (alreadySent) {
              return;
            }
            const now = new Date();
            const title = `You have ${dueTasks.length} due or overdue task${dueTasks.length === 1 ? "" : "s"}`;
            const snippet = dueTasks
              .slice(0, 5)
              .map(({ title: taskTitle }) => taskTitle)
              .join(" · ")
              .slice(0, 240);
            const channelPreferences =
              await transaction.orm.public.NotificationPreference.where(
                (preference) =>
                  and(
                    preference.userId.eq(user.id),
                    preference.eventType.eq("due"),
                    preference.enabled.eq(false)
                  )
              )
                .select("channel")
                .all();
            const disabled = new Set(
              channelPreferences.map(({ channel }) => channel)
            );
            if (!disabled.has("in-app")) {
              await transaction.orm.public.Notification.create({
                actorId: null,
                createdAt: now,
                id: notificationId,
                projectId: null,
                readAt: null,
                snippet,
                taskId: null,
                text: title,
                type: "due",
                userId: user.id,
              });
            }
            if (!disabled.has("web-push")) {
              await transaction.orm.public.Job.upsert({
                conflictOn: { dedupeKey: `push:${notificationId}` },
                create: {
                  availableAt: now,
                  createdAt: now,
                  dedupeKey: `push:${notificationId}`,
                  id: randomUUID(),
                  kind: "notifications.deliver-push",
                  payload: {
                    actorId: "system",
                    body: snippet,
                    eventType: "due",
                    notificationId,
                    title,
                    url: "/tasks",
                    userId: user.id,
                  },
                  updatedAt: now,
                },
                update: { updatedAt: now },
              });
            }
            usersNotified += 1;
          })
        );
        return { usersNotified };
      });
    },
  });
