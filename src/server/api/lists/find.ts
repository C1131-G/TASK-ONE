import { Effect, Layer } from "effect";

import { getUtcToday } from "../../../lib/utc-today";
import {
  archiveListRoute,
  favoriteListRoute,
  fileListRoute,
  myTimeRoute,
  searchRoute,
} from "../../../mobile-api/routes-find";
import { AuthSession } from "../../auth/session";
import { DiscoveryManagement } from "../../preferences/discovery-contracts";
import { DiscoveryManagementLive } from "../../preferences/discovery-management";
import { ProjectManagement } from "../../projects/project-contracts";
import { ProjectManagementLive } from "../../projects/project-management";
import { StorageLive } from "../../storage/storage";
import { UploadsLive } from "../../storage/uploads";
import { Uploads } from "../../storage/uploads-contracts";
import { TimeTracking, TimeTrackingLive } from "../../time/time-tracking";
import { listArchivedTasks } from "../../work/work-archive-list";
import { pageOf } from "../paging";
import { readRouteInput } from "../route-input";

export const readMyTime = (request: Request) =>
  Effect.gen(function* read() {
    const { query } = yield* readRouteInput(myTimeRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const week = yield* (yield* TimeTracking).weeklyTime(
      actor.id,
      query.date ?? getUtcToday()
    );
    return {
      billableMinutes: week.billableMinutes,
      days: week.days,
      entries: week.entries,
      totalMinutes: week.totalMinutes,
      weekStart: week.weekStart,
    };
  }).pipe(Effect.provide(TimeTrackingLive));

export const readSearch = (request: Request) =>
  Effect.gen(function* read() {
    const { query } = yield* readRouteInput(searchRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    return yield* (yield* DiscoveryManagement).searchWorkspace(
      actor.id,
      query.q
    );
  }).pipe(Effect.provide(DiscoveryManagementLive));

export const listFavoritePage = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(favoriteListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const personal = yield* (yield* DiscoveryManagement).listPersonalWorkspace(
      actor.id
    );
    const rows = [
      ...personal.projects.map(({ id, name }) => ({
        id,
        kind: "project" as const,
        subtitle: null,
        title: name,
      })),
      ...personal.tasks.map((task) => ({
        id: task.id,
        kind: "task" as const,
        subtitle: task.projectName,
        title: task.title,
      })),
    ];
    return yield* pageOf(rows, ({ id, kind }) => `${kind}:${id}`, query);
  }).pipe(Effect.provide(DiscoveryManagementLive));

export const listArchivePage = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(archiveListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const projects = yield* (yield* ProjectManagement).listProjects(actor.id, {
      includeArchived: true,
    });
    const archivedProjects = projects.flatMap((project) =>
      project.archivedAt
        ? [
            {
              archivedAt: project.archivedAt,
              id: project.id,
              kind: "project" as const,
              projectName: null,
              title: project.name,
              version: project.version,
            },
          ]
        : []
    );
    const tasks = yield* listArchivedTasks();
    const rows = [...archivedProjects, ...tasks].toSorted((left, right) =>
      left.archivedAt === right.archivedAt
        ? right.id.localeCompare(left.id)
        : right.archivedAt.localeCompare(left.archivedAt)
    );
    return yield* pageOf(rows, ({ id, kind }) => `${kind}:${id}`, query);
  }).pipe(Effect.provide(ProjectManagementLive));

const uploadsLayer = Layer.provide(UploadsLive, StorageLive);

export const listFilePage = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(fileListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const projects = yield* (yield* ProjectManagement).listProjects(actor.id);
    const wanted = query.projectId
      ? projects.filter(({ id }) => id === query.projectId)
      : projects;
    const uploads = yield* Uploads;
    // Asked for every project, the ones this person may not open are left out;
    // asked for one project by name, the refusal is the answer.
    const perProject: {
      readonly contentType: string;
      readonly copyState: "failed" | "pending" | "ready";
      readonly createdAt: string;
      readonly id: string;
      readonly originalName: string;
      readonly projectId: string;
      readonly projectName: string;
      readonly sizeBytes: number;
      readonly taskId: string | null;
      readonly uploadedById: string;
    }[] = [];
    for (const project of wanted) {
      const files = yield* uploads
        .listProjectFiles(actor.id, project.id)
        .pipe(
          Effect.catch((error) =>
            error.code === "FORBIDDEN" && !query.projectId
              ? Effect.succeed([])
              : Effect.fail(error)
          )
        );
      for (const file of files) {
        perProject.push({ ...file, projectName: project.name });
      }
    }
    const rows = perProject.toSorted((left, right) =>
      left.createdAt === right.createdAt
        ? right.id.localeCompare(left.id)
        : right.createdAt.localeCompare(left.createdAt)
    );
    return yield* pageOf(rows, ({ id }) => id, query);
  }).pipe(Effect.provide(Layer.merge(ProjectManagementLive, uploadsLayer)));
