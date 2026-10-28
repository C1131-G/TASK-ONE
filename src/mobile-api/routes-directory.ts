import { Schema } from "effect";

import type { RouteDefinition } from "./route-definition";
import { NextCursorSchema, PageQuerySchema } from "./routes-paging";

// The workspace's people: employees, teams and client companies.
// Owned by one branch, so adding routes here never conflicts with the others.
// This file imports nothing from the server, so every shape is spelled out here
// and a test decodes real responses against it.

const MemberRow = Schema.Struct({
  activeProjectCount: Schema.Number,
  email: Schema.String,
  employeeId: Schema.String,
  id: Schema.String,
  jobTitle: Schema.NullOr(Schema.String),
  name: Schema.String,
  openAssignedTaskCount: Schema.Number,
  role: Schema.Literals(["admin", "employee"]),
  teamId: Schema.NullOr(Schema.String),
  teamName: Schema.NullOr(Schema.String),
});

export const MemberPage = Schema.Struct({
  items: Schema.Array(MemberRow),
  nextCursor: NextCursorSchema,
});

export const memberListRoute = {
  data: MemberPage,
  method: "get",
  operationId: "listMembers",
  path: "/api/v1/workspace/members",
  query: Schema.Struct({
    ...PageQuerySchema.fields,
    q: Schema.optional(Schema.String.check(Schema.isMaxLength(200))),
  }),
  summary:
    "The employee directory, optionally narrowed by a search text, one page at a time.",
} as const satisfies RouteDefinition;

const TeamRow = Schema.Struct({
  color: Schema.String,
  description: Schema.NullOr(Schema.String),
  id: Schema.String,
  memberCount: Schema.Number,
  name: Schema.String,
});

export const TeamPage = Schema.Struct({
  items: Schema.Array(TeamRow),
  nextCursor: NextCursorSchema,
});

export const teamListRoute = {
  data: TeamPage,
  method: "get",
  operationId: "listTeams",
  path: "/api/v1/workspace/teams",
  query: PageQuerySchema,
  summary: "The teams with their member counts, one page at a time.",
} as const satisfies RouteDefinition;

const ClientCompanyRow = Schema.Struct({
  active: Schema.Boolean,
  handlerCount: Schema.Number,
  id: Schema.String,
  name: Schema.String,
  openBugCount: Schema.Number,
  projectCount: Schema.Number,
  userCount: Schema.Number,
  version: Schema.Number,
});

export const ClientCompanyPage = Schema.Struct({
  items: Schema.Array(ClientCompanyRow),
  nextCursor: NextCursorSchema,
});

export const clientCompanyListRoute = {
  data: ClientCompanyPage,
  method: "get",
  operationId: "listClientCompanies",
  path: "/api/v1/workspace/clients",
  query: PageQuerySchema,
  summary:
    "The client companies with their project, user and open bug counts, one page at a time.",
} as const satisfies RouteDefinition;

export const directoryRoutes = [
  memberListRoute,
  teamListRoute,
  clientCompanyListRoute,
] as const satisfies readonly RouteDefinition[];
