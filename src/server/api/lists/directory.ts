import { Effect } from "effect";

import {
  clientCompanyListRoute,
  memberListRoute,
  teamListRoute,
} from "../../../mobile-api/routes-directory";
import { AuthSession } from "../../auth/session";
import { ClientCompanyManagement } from "../../clients/client-company-contracts";
import { ClientCompanyManagementLive } from "../../clients/client-company-management";
import {
  TeamManagement,
  TeamManagementLive,
} from "../../people/team-management";
import { listEmployees } from "../../people/user-directory";
import { pageOf } from "../paging";
import { readRouteInput } from "../route-input";

export const listMemberPage = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(memberListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const employees = yield* listEmployees(actor.id, query.q ?? "");
    const rows = employees.map((employee) => ({
      activeProjectCount: employee.activeProjectCount,
      email: employee.email,
      employeeId: employee.employeeId,
      id: employee.id,
      jobTitle: employee.jobTitle,
      name: employee.name,
      openAssignedTaskCount: employee.openAssignedTaskCount,
      role: employee.role,
      teamId: employee.teamId,
      teamName: employee.teamName,
    }));
    return yield* pageOf(rows, ({ id }) => id, query);
  });

export const listTeamPage = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(teamListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const teams = yield* (yield* TeamManagement).listTeams(actor.id);
    const rows = teams.map((team) => ({
      color: team.color,
      description: team.description,
      id: team.id,
      memberCount: team.memberCount,
      name: team.name,
    }));
    return yield* pageOf(rows, ({ id }) => id, query);
  }).pipe(Effect.provide(TeamManagementLive));

export const listClientCompanyPage = (request: Request) =>
  Effect.gen(function* list() {
    const { query } = yield* readRouteInput(clientCompanyListRoute, request);
    const session = yield* AuthSession;
    const actor = yield* session.requireWorkspaceAccess(request.headers);
    const companies = yield* (yield* ClientCompanyManagement).listCompanies(
      actor.id
    );
    return yield* pageOf(companies, ({ id }) => id, query);
  }).pipe(Effect.provide(ClientCompanyManagementLive));
