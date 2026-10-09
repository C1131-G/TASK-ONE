import { randomUUID } from "node:crypto";

import { Effect, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { DuplicateProjectInputSchema } from "./project-contracts";
import type {
  DuplicateProjectInput,
  ProjectSummary,
} from "./project-contracts";
import {
  mapError,
  toSummary,
  validateAdmin,
  writeActivity,
} from "./project-internal";

export const duplicateProject = (
  actorId: string,
  sourceProjectId: string,
  raw: DuplicateProjectInput
): Effect.Effect<ProjectSummary, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      let input: DuplicateProjectInput;
      try {
        input = Schema.decodeUnknownSync(DuplicateProjectInputSchema)(raw);
      } catch {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "Enter a valid project name and key.",
        });
      }
      const key = input.key.toUpperCase();
      return db.transaction(async (transaction) => {
        await validateAdmin(transaction, actorId);
        const source = await transaction.orm.public.Project.where({
          id: sourceProjectId,
        }).first();
        if (!source) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The source project was not found.",
          });
        }
        const [sourceTasks, sourceMembers, sourceMilestones] =
          await Promise.all([
            transaction.orm.public.Task.where({ projectId: sourceProjectId })
              .orderBy((task) => task.position.asc())
              .all(),
            transaction.orm.public.ProjectMember.where({
              projectId: sourceProjectId,
            }).all(),
            transaction.orm.public.ProjectMilestone.where({
              projectId: sourceProjectId,
            })
              .orderBy((milestone) => milestone.position.asc())
              .all(),
          ]);
        const activeTasks = sourceTasks.filter(({ archivedAt }) => !archivedAt);
        const sourceTaskIds = activeTasks.map(({ id }) => id);
        const [assignments, labels, subtasks, dependencies] = await Promise.all(
          [
            sourceTaskIds.length === 0
              ? Promise.resolve([])
              : transaction.orm.public.TaskAssignee.include("user")
                  .where((assignment) => assignment.taskId.in(sourceTaskIds))
                  .all(),
            sourceTaskIds.length === 0
              ? Promise.resolve([])
              : transaction.orm.public.TaskLabel.where((label) =>
                  label.taskId.in(sourceTaskIds)
                ).all(),
            sourceTaskIds.length === 0
              ? Promise.resolve([])
              : transaction.orm.public.TaskSubtask.where((subtask) =>
                  subtask.taskId.in(sourceTaskIds)
                )
                  .orderBy((subtask) => subtask.position.asc())
                  .all(),
            sourceTaskIds.length === 0
              ? Promise.resolve([])
              : transaction.orm.public.TaskDependency.where((dependency) =>
                  dependency.taskId.in(sourceTaskIds)
                ).all(),
          ]
        );
        const now = new Date();
        const projectId = randomUUID();
        const project = await transaction.orm.public.Project.create({
          archivedAt: null,
          archivedById: null,
          color: source.color,
          createdAt: now,
          description: source.description,
          dueDate: source.dueDate,
          icon: source.icon,
          id: projectId,
          key,
          leadId: source.leadId,
          name: input.name,
          position: source.position,
          startDate: source.startDate,
          status: source.status,
          teamId: source.teamId,
          updatedAt: now,
          version: 1,
        });
        const taskIdMap = new Map<string, string>();
        for (const task of activeTasks) {
          taskIdMap.set(task.id, randomUUID());
        }
        await Promise.all([
          ...sourceMembers.map((member) =>
            transaction.orm.public.ProjectMember.create({
              joinedAt: now,
              projectId,
              userId: member.userId,
            })
          ),
          ...sourceMilestones.map((milestone, position) =>
            transaction.orm.public.ProjectMilestone.create({
              completedAt: null,
              createdAt: now,
              dueDate: milestone.dueDate,
              id: randomUUID(),
              name: milestone.name,
              position,
              projectId,
            })
          ),
          transaction.orm.public.ProjectTaskCounter.create({
            nextNumber: activeTasks.length + 1,
            projectId,
            updatedAt: now,
          }),
        ]);
        const taskIds = new Set(sourceTaskIds);
        await Promise.all(
          activeTasks.map((task, position) =>
            transaction.orm.public.Task.create({
              archivedAt: null,
              archivedById: null,
              completedAt: null,
              createdAt: now,
              createdById: actorId,
              description: task.description,
              dueDate: task.dueDate,
              estimate: task.estimate,
              id: taskIdMap.get(task.id) ?? randomUUID(),
              position,
              priority: task.priority,
              projectId,
              projectTaskNumber: position + 1,
              startDate: task.startDate,
              status: "todo",
              title: task.title,
              updatedAt: now,
              version: 1,
            })
          )
        );
        await Promise.all([
          ...assignments.flatMap((assignment) => {
            const copiedTaskId = taskIdMap.get(assignment.taskId);
            return copiedTaskId && !assignment.user.deactivatedAt
              ? [
                  transaction.orm.public.TaskAssignee.create({
                    assignedAt: now,
                    assignedById: actorId,
                    taskId: copiedTaskId,
                    userId: assignment.userId,
                  }),
                ]
              : [];
          }),
          ...labels.flatMap((label) => {
            const copiedTaskId = taskIdMap.get(label.taskId);
            return copiedTaskId
              ? [
                  transaction.orm.public.TaskLabel.create({
                    labelId: label.labelId,
                    taskId: copiedTaskId,
                  }),
                ]
              : [];
          }),
          ...subtasks.flatMap((subtask) => {
            const copiedTaskId = taskIdMap.get(subtask.taskId);
            return copiedTaskId
              ? [
                  transaction.orm.public.TaskSubtask.create({
                    assigneeId: subtask.assigneeId,
                    completedAt: null,
                    createdAt: now,
                    description: subtask.description,
                    dueDate: subtask.dueDate,
                    id: randomUUID(),
                    isCompleted: false,
                    position: subtask.position,
                    taskId: copiedTaskId,
                    title: subtask.title,
                  }),
                ]
              : [];
          }),
          ...dependencies.flatMap((dependency) => {
            const copiedTaskId = taskIdMap.get(dependency.taskId);
            const copiedDependencyId = taskIdMap.get(
              dependency.dependsOnTaskId
            );
            return copiedTaskId &&
              copiedDependencyId &&
              taskIds.has(dependency.dependsOnTaskId)
              ? [
                  transaction.orm.public.TaskDependency.create({
                    createdAt: now,
                    dependsOnTaskId: copiedDependencyId,
                    taskId: copiedTaskId,
                  }),
                ]
              : [];
          }),
        ]);
        await writeActivity(
          transaction,
          actorId,
          projectId,
          "project.duplicated",
          {
            sourceProjectId,
            taskCount: activeTasks.length,
          }
        );
        return toSummary(project);
      });
    },
  });
