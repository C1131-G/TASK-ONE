import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";
import { NextCursorSchema, PageQuerySchema } from "./routes-paging";

// Finding things: the signed-in person's time, search, favorites, the archive
// and project files. Owned by one branch, so adding routes here never
// conflicts with the others. This file imports nothing from the server, so
// every shape is spelled out here and a test decodes real responses against it.

const Day = Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/u));
const Uuid = Schema.String.check(Schema.isUUID());

const TimeEntry = Schema.Struct({
  billable: Schema.Boolean,
  id: Schema.String,
  minutes: Schema.Number,
  note: Schema.NullOr(Schema.String),
  taskId: Schema.String,
  taskReference: Schema.String,
  taskTitle: Schema.String,
  userId: Schema.String,
  userName: Schema.String,
  workDate: Schema.String,
});

export const MyTimeWeek = Schema.Struct({
  billableMinutes: Schema.Number,
  days: Schema.Array(
    Schema.Struct({ date: Schema.String, minutes: Schema.Number })
  ),
  entries: Schema.Array(TimeEntry),
  totalMinutes: Schema.Number,
  weekStart: Schema.String,
});

export const myTimeRoute = {
  data: MyTimeWeek,
  method: "get",
  operationId: "listMyTime",
  path: "/api/v1/workspace/my-time",
  query: Schema.Struct({ date: Schema.optional(Day) }),
  summary:
    "The caller's own time entries for the week that holds `date` (today when left out), with totals per day.",
} as const satisfies RouteDefinition;

export const SearchResults = Schema.Struct({
  projects: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String })
  ),
  tasks: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      projectId: Schema.String,
      projectName: Schema.String,
      title: Schema.String,
    })
  ),
});

export const searchRoute = {
  data: SearchResults,
  method: "get",
  operationId: "searchWorkspace",
  path: "/api/v1/workspace/search",
  query: Schema.Struct({
    q: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(200)),
  }),
  summary:
    "Projects and tasks whose name matches the text. The answer is short by design: the best matches only.",
} as const satisfies RouteDefinition;

const KindRow = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["project", "task"]),
  subtitle: Schema.NullOr(Schema.String),
  title: Schema.String,
});

export const FavoritePage = Schema.Struct({
  items: Schema.Array(KindRow),
  nextCursor: NextCursorSchema,
});

export const favoriteListRoute = {
  data: FavoritePage,
  method: "get",
  operationId: "listFavorites",
  path: "/api/v1/workspace/favorites",
  query: PageQuerySchema,
  summary:
    "The projects and tasks the caller starred, projects first, one page at a time.",
} as const satisfies RouteDefinition;

const ArchivedRow = Schema.Struct({
  archivedAt: Schema.String,
  id: Schema.String,
  kind: Schema.Literals(["project", "task"]),
  projectName: Schema.NullOr(Schema.String),
  title: Schema.String,
  version: Schema.Number,
});

export const ArchivePage = Schema.Struct({
  items: Schema.Array(ArchivedRow),
  nextCursor: NextCursorSchema,
});

export const archiveListRoute = {
  data: ArchivePage,
  method: "get",
  operationId: "listArchive",
  path: "/api/v1/workspace/archive",
  query: PageQuerySchema,
  summary:
    "Archived projects and tasks, most recently archived first, one page at a time. The list reaches back over the latest 500 archived tasks.",
} as const satisfies RouteDefinition;

const FileRow = Schema.Struct({
  contentType: Schema.String,
  copyState: Schema.Literals(["pending", "ready", "failed"]),
  createdAt: Schema.String,
  id: Schema.String,
  originalName: Schema.String,
  projectId: Schema.String,
  projectName: Schema.String,
  sizeBytes: Schema.Number,
  taskId: Schema.NullOr(Schema.String),
  uploadedById: Schema.String,
});

export const FilePage = Schema.Struct({
  items: Schema.Array(FileRow),
  nextCursor: NextCursorSchema,
});

export const fileListRoute = {
  data: FilePage,
  method: "get",
  operationId: "listFiles",
  path: "/api/v1/workspace/files",
  query: Schema.Struct({
    ...PageQuerySchema.fields,
    projectId: Schema.optional(Uuid),
  }),
  summary:
    "The standalone files (not attached to a task) of one project, or of every active project when `projectId` is left out, newest first, one page at a time. Admins only, as on the web: for anyone else a named project answers 403 and the unnamed list is empty.",
} as const satisfies RouteDefinition;

export const findRoutes = [
  myTimeRoute,
  searchRoute,
  favoriteListRoute,
  archiveListRoute,
  fileListRoute,
] as const satisfies readonly RouteDefinition[];
