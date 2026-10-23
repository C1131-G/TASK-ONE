import { and } from "@prisma/orm-postgres/orm-client";
import { Effect } from "effect";

import { db } from "@/src/prisma/db";

import { AppError } from "../core/action-result";
import type { ProjectApprovals } from "./approval-contracts";
import {
  assertStaffReader,
  describeRequests,
  isUuid,
} from "./approval-staff-shared";

// A project's file list is capped so one huge project cannot bloat the form.
const MAX_FORM_FILES = 200;

const notFound = () =>
  new AppError({ code: "NOT_FOUND", message: "The project was not found." });

// Every team member who can open the project sees its approval requests. Only
// administrators, who alone may ask for a milestone, also get the form's
// choices: saved milestones, companies the project is shared with, and the
// project's finished files.
const forProjectInternal = async (
  actorId: string,
  projectId: string
): Promise<ProjectApprovals> => {
  const actor = await assertStaffReader(actorId);
  if (!isUuid(projectId)) {
    throw notFound();
  }
  const project = await db.orm.public.Project.where({ id: projectId })
    .select("archivedAt", "clientVisible")
    .first();
  if (!project) {
    throw notFound();
  }
  const rows = await db.orm.public.ApprovalRequest.where({ projectId }).all();
  const canRequest =
    actor.role === "admin" && project.clientVisible && !project.archivedAt;
  const links = canRequest
    ? await db.orm.public.ClientCompanyProject.where({
        projectId,
        removedAt: null,
      })
        .select("companyId")
        .all()
    : [];
  const { companies, requests } = await describeRequests(
    rows,
    links.map(({ companyId }) => companyId)
  );
  const [milestones, files] = canRequest
    ? await Promise.all([
        db.orm.public.ProjectMilestone.where({ projectId })
          .orderBy((milestone) => milestone.position.asc())
          .select("id", "name")
          .all(),
        db.orm.public.FileAsset.where((file) =>
          and(
            file.projectId.eq(projectId),
            file.deletedAt.isNull(),
            file.copyState.eq("ready")
          )
        )
          .orderBy((file) => file.originalName.asc())
          .limit(MAX_FORM_FILES)
          .select("id", "originalName")
          .all(),
      ])
    : [[], []];
  const subjects = new Map(
    rows.map(({ id, subjectTitle, taskId }) => [
      id,
      {
        subjectKind: taskId ? ("task" as const) : ("milestone" as const),
        subjectTitle,
      },
    ])
  );
  const active = new Set(links.map(({ companyId }) => companyId));
  return {
    canRequest,
    companies: companies
      .flatMap(({ deactivatedAt, id, name }) =>
        !deactivatedAt && active.has(id) ? [{ id, name }] : []
      )
      .toSorted((first, second) => first.name.localeCompare(second.name)),
    files,
    milestones,
    requests: requests.flatMap((request) => {
      const subject = subjects.get(request.id);
      return subject ? [{ ...request, ...subject }] : [];
    }),
  };
};

export const forProject = (
  actorId: string,
  projectId: string
): Effect.Effect<ProjectApprovals, AppError> =>
  Effect.tryPromise({
    catch: (error) =>
      error instanceof AppError
        ? error
        : new AppError({
            code: "UNAVAILABLE",
            message: "Approvals could not be loaded.",
          }),
    try: () => forProjectInternal(actorId, projectId),
  });
