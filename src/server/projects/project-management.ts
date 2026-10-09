import { randomUUID } from "node:crypto";

import type { ResultType } from "@prisma/orm-postgres/components/runtime";
import { Context, Effect, Layer, Schema } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { CalendarDateSchema, ProjectKeySchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";

export const DuplicateProjectInputSchema = Schema.Struct({
  key: ProjectKeySchema,
  name: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
});
export type DuplicateProjectInput = typeof DuplicateProjectInputSchema.Type;

export const CreateProjectInputSchema = Schema.Struct({
  color: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  icon: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  key: ProjectKeySchema,
  name: Schema.String,
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  status: Schema.Literals(["planning", "active", "risk", "hold", "complete"]),
  teamId: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isUUID()))),
  templateId: Schema.optional(
    Schema.Literals([
      "blank",
      "product",
      "web",
      "mkt",
      "design",
      "software",
      "personal",
    ])
  ),
});
export type CreateProjectInput = typeof CreateProjectInputSchema.Type;
export const UpdateProjectInputSchema = Schema.Struct({
  color: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  icon: Schema.optional(Schema.String.check(Schema.isMaxLength(40))),
  name: Schema.String,
  position: Schema.optional(
    Schema.Number.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0))
  ),
  startDate: Schema.optional(Schema.NullOr(CalendarDateSchema)),
  status: Schema.Literals(["planning", "active", "risk", "hold", "complete"]),
  teamId: Schema.optional(Schema.NullOr(Schema.String.check(Schema.isUUID()))),
});
export type UpdateProjectInput = typeof UpdateProjectInputSchema.Type;

const ProjectStatusSchema = Schema.Literals([
  "planning",
  "active",
  "risk",
  "hold",
  "complete",
]);

export const ProjectSummarySchema = Schema.Struct({
  archivedAt: Schema.NullOr(Schema.String),
  color: Schema.String,
  description: Schema.NullOr(Schema.String),
  dueDate: Schema.NullOr(Schema.String),
  icon: Schema.String,
  id: Schema.String,
  key: Schema.String,
  name: Schema.String,
  position: Schema.Number,
  startDate: Schema.NullOr(Schema.String),
  status: ProjectStatusSchema,
  teamId: Schema.NullOr(Schema.String),
  version: Schema.Number,
});

export const ProjectWithPeopleSchema = Schema.Struct({
  ...ProjectSummarySchema.fields,
  leadId: Schema.NullOr(Schema.String),
  memberIds: Schema.Array(Schema.String),
});

export const ProjectListItemSchema = Schema.Struct({
  ...ProjectWithPeopleSchema.fields,
  completedTaskCount: Schema.Number,
  progress: Schema.Number,
  taskCount: Schema.Number,
});

export const ProjectMilestonesResultSchema = Schema.Struct({
  milestones: Schema.Array(
    Schema.Struct({
      completed: Schema.Boolean,
      dueDate: Schema.NullOr(Schema.String),
      id: Schema.String,
      name: Schema.String,
      position: Schema.Number,
    })
  ),
  projectId: Schema.String,
  version: Schema.Number,
});

export interface ProjectSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: CreateProjectInput["status"];
  readonly version: number;
  readonly archivedAt: string | null;
  readonly color: string;
  readonly dueDate: string | null;
  readonly icon: string;
  readonly position: number;
  readonly startDate: string | null;
  readonly teamId: string | null;
}
export interface ProjectWithPeople extends ProjectSummary {
  readonly leadId: string | null;
  readonly memberIds: readonly string[];
}
export interface ProjectListItem extends ProjectWithPeople {
  readonly taskCount: number;
  readonly completedTaskCount: number;
  readonly progress: number;
}
export interface SetProjectPeopleInput {
  readonly leadId: string | null;
  readonly memberIds: readonly string[];
}
export const SaveProjectMilestonesInputSchema = Schema.Struct({
  expectedVersion: Schema.Number,
  milestones: Schema.Array(
    Schema.Struct({
      completed: Schema.Boolean,
      dueDate: Schema.NullOr(CalendarDateSchema),
      id: Schema.NullOr(Schema.String.check(Schema.isUUID())),
      name: Schema.String,
    })
  ),
  projectId: Schema.String.check(Schema.isUUID()),
});
export interface ProjectMilestoneInput {
  readonly id: string | null;
  readonly name: string;
  readonly dueDate: string | null;
  readonly completed: boolean;
}
export interface ProjectMilestone {
  readonly id: string;
  readonly name: string;
  readonly dueDate: string | null;
  readonly completed: boolean;
  readonly position: number;
}
export interface ProjectMilestonesResult {
  readonly projectId: string;
  readonly version: number;
  readonly milestones: readonly ProjectMilestone[];
}

export class ProjectManagement extends Context.Service<
  ProjectManagement,
  {
    readonly createProject: (
      actorId: string,
      input: CreateProjectInput
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly duplicateProject: (
      actorId: string,
      sourceProjectId: string,
      input: DuplicateProjectInput
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly updateProject: (
      actorId: string,
      projectId: string,
      expectedVersion: number,
      input: UpdateProjectInput
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly archiveProject: (
      actorId: string,
      projectId: string,
      expectedVersion: number
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly restoreProject: (
      actorId: string,
      projectId: string,
      expectedVersion: number
    ) => Effect.Effect<ProjectSummary, AppError>;
    readonly setProjectPeople: (
      actorId: string,
      projectId: string,
      expectedVersion: number,
      input: SetProjectPeopleInput
    ) => Effect.Effect<ProjectWithPeople, AppError>;
    readonly listProjects: (
      requesterId: string,
      options?: { readonly includeArchived?: boolean }
    ) => Effect.Effect<readonly ProjectListItem[], AppError>;
    readonly saveProjectMilestones: (
      actorId: string,
      projectId: string,
      expectedVersion: number,
      milestones: readonly ProjectMilestoneInput[]
    ) => Effect.Effect<ProjectMilestonesResult, AppError>;
  }
>()("metsys/server/ProjectManagement") {}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type ProjectRecord = ResultType<typeof db.orm.public.Project>;

const PROJECT_STARTER_TASKS = {
  blank: [],
  design: [
    "Discovery workshop",
    "Moodboard",
    "Concept directions",
    "Refinement",
    "Developer handoff",
  ],
  mkt: [
    "Campaign brief",
    "Audience research",
    "Creative assets",
    "Channel plan",
    "Launch campaign",
    "Performance report",
  ],
  personal: [
    "Brain dump ideas",
    "Pick top 3 priorities",
    "Schedule focus time",
    "Weekly review",
  ],
  product: [
    "Define problem statement",
    "User research plan",
    "Write PRD",
    "Design exploration",
    "Build MVP",
    "Beta launch",
  ],
  software: [
    "Technical spec",
    "Set up repo & CI",
    "Implement core API",
    "Write tests",
    "Code review",
    "Deploy to staging",
  ],
  web: [
    "Sitemap & information architecture",
    "Wireframes",
    "Visual design",
    "Build page templates",
    "Content migration",
    "QA & launch",
  ],
} as const;

const toSummary = (
  project: Pick<
    ProjectRecord,
    | "id"
    | "key"
    | "name"
    | "description"
    | "status"
    | "version"
    | "archivedAt"
    | "color"
    | "dueDate"
    | "icon"
    | "position"
    | "startDate"
    | "teamId"
  >
): ProjectSummary => ({
  archivedAt: project.archivedAt?.toISOString() ?? null,
  color: project.color,
  description: project.description,
  dueDate: project.dueDate,
  icon: project.icon,
  id: project.id,
  key: project.key,
  name: project.name,
  position: project.position,
  startDate: project.startDate,
  status: Schema.decodeUnknownSync(ProjectStatusSchema)(project.status),
  teamId: project.teamId,
  version: project.version,
});

const mapError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (isUniqueConstraintViolation(error)) {
    return new AppError({
      code: "CONFLICT",
      message: "A project with that key already exists.",
    });
  }
  return new AppError({
    code: "UNAVAILABLE",
    message: "The project request could not be completed.",
  });
};

const validateVersion = (version: number): void => {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "A valid project version is required.",
    });
  }
};

const validateAdmin = async (
  transaction: Transaction,
  actorId: string
): Promise<void> => {
  const actor = await transaction.orm.public.User.where({ id: actorId })
    .select("role", "mustChangePassword", "deactivatedAt")
    .first();
  if (!actor || actor.deactivatedAt) {
    throw new AppError({
      code: "UNAUTHENTICATED",
      message: "Sign in to continue.",
    });
  }
  if (actor.mustChangePassword || actor.role !== "admin") {
    throw new AppError({
      code: "FORBIDDEN",
      message: "An admin account with a changed password is required.",
    });
  }
};

const validateProjectTeam = async (
  transaction: Transaction,
  teamId: string | null | undefined
): Promise<void> => {
  if (!teamId) {
    return;
  }
  const team = await transaction.orm.public.Team.where({ id: teamId })
    .select("id")
    .first();
  if (!team) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Choose an existing team for the project.",
    });
  }
};

const validateProjectInput = (
  input: CreateProjectInput | UpdateProjectInput
) => {
  const name = input.name.trim();
  const description = input.description?.trim() || null;
  if (!name || name.length > 120) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Enter a project name between 1 and 120 characters.",
    });
  }
  if (description && description.length > 5000) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "Project descriptions can contain up to 5000 characters.",
    });
  }
  if ("key" in input) {
    const key = input.key.trim().toUpperCase();
    if (!Schema.is(ProjectKeySchema)(key)) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message:
          "Use a project key of 2 to 12 letters, numbers, underscores, or hyphens.",
      });
    }
    return { ...input, description, key, name };
  }
  return { ...input, description, name };
};

const writeActivity = async (
  transaction: Transaction,
  actorId: string,
  projectId: string,
  action: string,
  details: Record<string, string | number | boolean | null>
) => {
  await transaction.orm.public.Activity.create({
    action,
    actorId,
    createdAt: new Date(),
    details,
    id: randomUUID(),
    projectId,
    taskId: null,
  });
};

const createProject = (
  actorId: string,
  raw: CreateProjectInput
): Effect.Effect<ProjectSummary, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      const input = validateProjectInput(raw) as CreateProjectInput;
      return db.transaction(async (transaction) => {
        await validateAdmin(transaction, actorId);
        await validateProjectTeam(transaction, input.teamId);
        const now = new Date();
        const id = randomUUID();
        const project = await transaction.orm.public.Project.create({
          archivedAt: null,
          archivedById: null,
          color: input.color ?? "slate",
          createdAt: now,
          description: input.description,
          dueDate: input.dueDate ?? null,
          icon: input.icon ?? "folder",
          id,
          key: input.key,
          leadId: null,
          name: input.name,
          position: 0,
          startDate: input.startDate ?? null,
          status: input.status,
          teamId: input.teamId ?? null,
          updatedAt: now,
          version: 1,
        });
        const starterTasks = PROJECT_STARTER_TASKS[input.templateId ?? "blank"];
        if (starterTasks.length > 0) {
          await transaction.orm.public.ProjectTaskCounter.upsert({
            conflictOn: { projectId: project.id },
            create: {
              nextNumber: starterTasks.length + 1,
              projectId: project.id,
              updatedAt: now,
            },
            update: {
              nextNumber: starterTasks.length + 1,
              updatedAt: now,
            },
          });
          await Promise.all(
            starterTasks.map((title, position) =>
              transaction.orm.public.Task.create({
                archivedAt: null,
                archivedById: null,
                completedAt: null,
                createdAt: now,
                createdById: actorId,
                description: null,
                dueDate: null,
                estimate: null,
                id: randomUUID(),
                position,
                priority: "none",
                projectId: project.id,
                projectTaskNumber: position + 1,
                startDate: null,
                status: "todo",
                title,
                updatedAt: now,
                version: 1,
              })
            )
          );
        }
        await writeActivity(transaction, actorId, id, "project.created", {
          key: input.key,
          name: input.name,
        });
        return toSummary(project);
      });
    },
  });

const duplicateProject = (
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

const validateProjectMutationState = (
  operation: "update" | "archive" | "restore",
  project: { readonly archivedAt: Date | null }
): void => {
  if (operation === "archive" && project.archivedAt) {
    throw new AppError({
      code: "CONFLICT",
      message: "The project is already archived.",
    });
  }
  if (operation === "restore" && !project.archivedAt) {
    throw new AppError({
      code: "CONFLICT",
      message: "The project is already active.",
    });
  }
  if (operation !== "restore" && project.archivedAt) {
    throw new AppError({
      code: "FORBIDDEN",
      message: "Archived projects are read only.",
    });
  }
};

const projectMutationAction = (
  operation: "update" | "archive" | "restore"
): string => {
  switch (operation) {
    case "update": {
      return "project.updated";
    }
    case "archive": {
      return "project.archived";
    }
    case "restore": {
      return "project.restored";
    }
    default: {
      throw new Error("Unsupported project operation.");
    }
  }
};

const projectMutationValues = (
  operation: "update" | "archive" | "restore",
  input: UpdateProjectInput | null,
  actorId: string,
  nextVersion: number
) => {
  if (operation === "update" && input) {
    return {
      description: input.description,
      ...(input.color === undefined ? {} : { color: input.color }),
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
      ...(input.icon === undefined ? {} : { icon: input.icon }),
      name: input.name,
      ...(input.position === undefined ? {} : { position: input.position }),
      ...(input.startDate === undefined ? {} : { startDate: input.startDate }),
      status: input.status,
      ...(input.teamId === undefined ? {} : { teamId: input.teamId }),
      updatedAt: new Date(),
      version: nextVersion,
    };
  }
  return {
    archivedAt: operation === "archive" ? new Date() : null,
    archivedById: operation === "archive" ? actorId : null,
    updatedAt: new Date(),
    version: nextVersion,
  };
};

const mutateProject = (
  actorId: string,
  projectId: string,
  expectedVersion: number,
  operation: "update" | "archive" | "restore",
  raw?: UpdateProjectInput
): Effect.Effect<ProjectSummary, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      validateVersion(expectedVersion);
      const input =
        operation === "update"
          ? (validateProjectInput(
              raw ?? { description: null, name: "", status: "planning" }
            ) as UpdateProjectInput)
          : null;
      return db.transaction(async (transaction) => {
        await validateAdmin(transaction, actorId);
        if (input) {
          await validateProjectTeam(transaction, input.teamId);
        }
        const project = await transaction.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!project) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        if (project.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        validateProjectMutationState(operation, project);
        const nextVersion = expectedVersion + 1;
        const updatedCount = await transaction.orm.public.Project.where({
          id: projectId,
          version: expectedVersion,
        }).updateAndCount(
          projectMutationValues(operation, input, actorId, nextVersion)
        );
        if (!updatedCount) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        const updated = await transaction.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!updated) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        await writeActivity(
          transaction,
          actorId,
          projectId,
          projectMutationAction(operation),
          {
            version: nextVersion,
          }
        );
        return toSummary(updated);
      });
    },
  });

const updateProject = (
  actorId: string,
  id: string,
  version: number,
  input: UpdateProjectInput
) => mutateProject(actorId, id, version, "update", input);
const archiveProject = (actorId: string, id: string, version: number) =>
  mutateProject(actorId, id, version, "archive");
const restoreProject = (actorId: string, id: string, version: number) =>
  mutateProject(actorId, id, version, "restore");

const setProjectPeople = (
  actorId: string,
  projectId: string,
  expectedVersion: number,
  input: SetProjectPeopleInput
): Effect.Effect<ProjectWithPeople, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      validateVersion(expectedVersion);
      const memberIds = [
        ...new Set([
          ...input.memberIds,
          ...(input.leadId ? [input.leadId] : []),
        ]),
      ];
      if (memberIds.length > 100) {
        throw new AppError({
          code: "VALIDATION_FAILED",
          message: "A project can have at most 100 members.",
        });
      }
      return db.transaction(async (transaction) => {
        await validateAdmin(transaction, actorId);
        const project = await transaction.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!project) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        if (project.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived projects are read only.",
          });
        }
        if (project.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        const users = await transaction.orm.public.User.where((user) =>
          user.id.in(memberIds)
        )
          .select("id", "deactivatedAt")
          .all();
        if (
          users.length !== memberIds.length ||
          users.some((user) => user.deactivatedAt)
        ) {
          throw new AppError({
            code: "VALIDATION_FAILED",
            message: "Choose active accounts for every project member.",
          });
        }
        await transaction.orm.public.ProjectMember.where({
          projectId,
        }).deleteAll();
        await Promise.all(
          memberIds.map((userId) =>
            transaction.orm.public.ProjectMember.create({
              joinedAt: new Date(),
              projectId,
              userId,
            })
          )
        );
        const version = expectedVersion + 1;
        const updatedCount = await transaction.orm.public.Project.where({
          id: projectId,
          version: expectedVersion,
        }).updateAndCount({
          leadId: input.leadId,
          updatedAt: new Date(),
          version,
        });
        if (!updatedCount) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        const updated = await transaction.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!updated) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        await writeActivity(
          transaction,
          actorId,
          projectId,
          "project.people_updated",
          { leadId: input.leadId, memberIds: memberIds.length }
        );
        return { ...toSummary(updated), leadId: input.leadId, memberIds };
      });
    },
  });

const listProjects = (
  requesterId: string,
  options: { readonly includeArchived?: boolean } = {}
): Effect.Effect<readonly ProjectListItem[], AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: async () => {
      const requester = await db.orm.public.User.where({ id: requesterId })
        .select("deactivatedAt", "mustChangePassword")
        .first();
      if (!requester || requester.deactivatedAt) {
        throw new AppError({
          code: "UNAUTHENTICATED",
          message: "Sign in to continue.",
        });
      }
      if (requester.mustChangePassword) {
        throw new AppError({
          code: "FORBIDDEN",
          message: "Change your password before continuing.",
        });
      }
      const projects = await db.orm.public.Project.where(
        options.includeArchived ? {} : { archivedAt: null }
      )
        .orderBy((project) => project.position.asc())
        .all();
      const projectIds = projects.map(({ id }) => id);
      const [members, tasks] = await Promise.all([
        db.orm.public.ProjectMember.where((member) =>
          member.projectId.in(projectIds)
        )
          .select("projectId", "userId")
          .all(),
        db.orm.public.Task.where((task) => task.projectId.in(projectIds))
          .select("projectId", "status", "archivedAt")
          .all(),
      ]);
      return projects.map((project) => {
        const projectTasks = tasks.flatMap((task) =>
          task.projectId === project.id && !task.archivedAt ? [task] : []
        );
        const taskCount = projectTasks.length;
        let completedTaskCount = 0;
        for (const task of projectTasks) {
          if (task.status === "done") {
            completedTaskCount += 1;
          }
        }
        return {
          ...toSummary(project),
          completedTaskCount,
          leadId: project.leadId,
          memberIds: members.flatMap((member) =>
            member.projectId === project.id ? [member.userId] : []
          ),
          progress:
            taskCount === 0
              ? 0
              : Math.round((completedTaskCount / taskCount) * 100),
          taskCount,
        };
      });
    },
  });

const validateMilestones = (milestones: readonly ProjectMilestoneInput[]) => {
  if (milestones.length > 100) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "A project can have at most 100 milestones.",
    });
  }
  const ids = new Set<string>();
  return milestones.map((milestone) => {
    const name = milestone.name.trim();
    if (!name || name.length > 120) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Milestone names must be between 1 and 120 characters.",
      });
    }
    if (milestone.id && ids.has(milestone.id)) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "A milestone cannot appear more than once.",
      });
    }
    if (milestone.id) {
      ids.add(milestone.id);
    }
    if (
      milestone.dueDate !== null &&
      !Schema.is(CalendarDateSchema)(milestone.dueDate)
    ) {
      throw new AppError({
        code: "VALIDATION_FAILED",
        message: "Enter a valid milestone date.",
      });
    }
    return { ...milestone, name };
  });
};

const saveProjectMilestones = (
  actorId: string,
  projectId: string,
  expectedVersion: number,
  raw: readonly ProjectMilestoneInput[]
): Effect.Effect<ProjectMilestonesResult, AppError> =>
  Effect.tryPromise({
    catch: mapError,
    try: () => {
      validateVersion(expectedVersion);
      const milestones = validateMilestones(raw);
      return db.transaction(async (transaction) => {
        await validateAdmin(transaction, actorId);
        const project = await transaction.orm.public.Project.where({
          id: projectId,
        }).first();
        if (!project) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "The project was not found.",
          });
        }
        if (project.archivedAt) {
          throw new AppError({
            code: "FORBIDDEN",
            message: "Archived projects are read only.",
          });
        }
        if (project.version !== expectedVersion) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        const existing = await transaction.orm.public.ProjectMilestone.where({
          projectId,
        }).all();
        const existingIds = new Set(existing.map(({ id }) => id));
        if (
          milestones.some(
            (milestone) => milestone.id && !existingIds.has(milestone.id)
          )
        ) {
          throw new AppError({
            code: "NOT_FOUND",
            message: "A milestone was not found in this project.",
          });
        }
        const keepIds = new Set(
          milestones.flatMap(({ id }) => (id ? [id] : []))
        );
        await Promise.all(
          existing.flatMap((milestone) =>
            keepIds.has(milestone.id)
              ? []
              : [
                  transaction.orm.public.ProjectMilestone.where({
                    id: milestone.id,
                  }).delete(),
                ]
          )
        );
        await Promise.all(
          milestones.map((milestone, position) => {
            const completedAt = milestone.completed
              ? (existing.find(({ id }) => id === milestone.id)?.completedAt ??
                new Date())
              : null;
            return milestone.id
              ? transaction.orm.public.ProjectMilestone.where({
                  id: milestone.id,
                  projectId,
                }).update({
                  completedAt,
                  dueDate: milestone.dueDate,
                  name: milestone.name,
                  position,
                })
              : transaction.orm.public.ProjectMilestone.create({
                  completedAt,
                  createdAt: new Date(),
                  dueDate: milestone.dueDate,
                  id: randomUUID(),
                  name: milestone.name,
                  position,
                  projectId,
                });
          })
        );
        const version = expectedVersion + 1;
        const updated = await transaction.orm.public.Project.where({
          id: projectId,
          version: expectedVersion,
        }).updateAndCount({ updatedAt: new Date(), version });
        if (!updated) {
          throw new AppError({
            code: "CONFLICT",
            message: "The project changed. Refresh and try again.",
          });
        }
        await writeActivity(
          transaction,
          actorId,
          projectId,
          "project.milestones_updated",
          { milestoneCount: milestones.length }
        );
        const saved = await transaction.orm.public.ProjectMilestone.where({
          projectId,
        })
          .orderBy((milestone) => milestone.position.asc())
          .all();
        return {
          milestones: saved.map(
            ({ completedAt, dueDate, id, name, position }) => ({
              completed: completedAt !== null,
              dueDate,
              id,
              name,
              position,
            })
          ),
          projectId,
          version,
        };
      });
    },
  });

export const ProjectManagementLive = Layer.succeed(
  ProjectManagement,
  ProjectManagement.of({
    archiveProject,
    createProject,
    duplicateProject,
    listProjects,
    restoreProject,
    saveProjectMilestones,
    setProjectPeople,
    updateProject,
  })
);
