import { randomUUID } from "node:crypto";

import type { ResultType } from "@prisma/orm-postgres/components/runtime";
import { Schema } from "effect";

import type { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import { ProjectKeySchema } from "../core/input-schemas";
import { isUniqueConstraintViolation } from "../core/prisma-errors";
import type {
  CreateProjectInput,
  ProjectSummary,
  UpdateProjectInput,
} from "./project-contracts";
import { ProjectStatusSchema } from "./project-contracts";

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type ProjectRecord = ResultType<typeof db.orm.public.Project>;

export const PROJECT_STARTER_TASKS = {
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

export const toSummary = (
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

export const mapError = (error: unknown): AppError => {
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

export const validateVersion = (version: number): void => {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message: "A valid project version is required.",
    });
  }
};

export const validateAdmin = async (
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

export const validateProjectTeam = async (
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

export const validateProjectDetails = (
  input: Pick<CreateProjectInput, "description" | "name">
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
  return { description, name };
};

export const validateCreateProjectInput = (
  input: CreateProjectInput
): CreateProjectInput => {
  const key = input.key.trim().toUpperCase();
  if (!Schema.is(ProjectKeySchema)(key)) {
    throw new AppError({
      code: "VALIDATION_FAILED",
      message:
        "Use a project key of 2 to 12 letters, numbers, underscores, or hyphens.",
    });
  }
  return { ...input, ...validateProjectDetails(input), key };
};

export const validateUpdateProjectInput = (
  input: UpdateProjectInput
): UpdateProjectInput => ({
  ...input,
  ...validateProjectDetails(input),
});

export const writeActivity = async (
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
