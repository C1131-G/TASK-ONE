import { Effect } from "effect";

import type { AppFailure } from "@/errors";
import type { ListRow } from "@/features/workspace/domain-list-screen";
import type { MobileApi } from "@/services/mobile-api";

type Api = MobileApi["Service"];

export interface TimeEntry {
  readonly date: string;
  readonly hours: number;
  readonly id: string;
  readonly projectName: string;
  readonly taskId: string | null;
  readonly taskTitle: string | null;
}

export interface PersonLoad {
  readonly id: string;
  readonly loadHours: number;
  readonly name: string;
  readonly openTasks: number;
  readonly overHours: number;
}

export interface BudgetSummary {
  readonly billedHours: number;
  readonly id: string;
  readonly plannedHours: number;
  readonly projectName: string;
}

export interface FileSummary {
  readonly copyStatus: "failed" | "none" | "pending" | "ready";
  readonly id: string;
  readonly name: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly sizeLabel: string;
  readonly uploadedBy: string;
}

export interface MemberSummary {
  readonly employeeNumber: string;
  readonly id: string;
  readonly name: string;
  readonly role: "admin" | "employee";
  readonly teamName: string | null;
  readonly title: string | null;
}

export interface TeamSummary {
  readonly id: string;
  readonly memberCount: number;
  readonly name: string;
}

export interface ClientCompanySummary {
  readonly active: boolean;
  readonly contactEmail: string | null;
  readonly id: string;
  readonly name: string;
}

export interface ActivityItem {
  readonly actorName: string;
  readonly at: string;
  readonly detail: string;
  readonly id: string;
  readonly kind: string;
  readonly taskTitle: string | null;
}

export interface KindItem {
  readonly id: string;
  readonly kind: string;
  readonly subtitle?: string;
  readonly title: string;
}

export interface ArchivedItem {
  readonly archivedAt: string;
  readonly id: string;
  readonly kind: string;
  readonly title: string;
}

interface DomainClient {
  readonly listActivity: () => Promise<{ items: readonly ActivityItem[] }>;
  readonly listArchive: () => Promise<{ items: readonly ArchivedItem[] }>;
  readonly listBudgets: () => Promise<{
    items: readonly {
      budgetMinutes: number;
      projectId: string;
      projectName: string;
      spentMinutes: number;
    }[];
  }>;
  readonly listClientCompanies: () => Promise<{
    items: readonly {
      active: boolean;
      id: string;
      name: string;
      openBugCount: number;
      projectCount: number;
    }[];
  }>;
  readonly listFavorites: () => Promise<{ items: readonly KindItem[] }>;
  readonly listFiles: () => Promise<{ files: readonly FileSummary[] }>;
  readonly listMembers: () => Promise<{
    items: readonly {
      employeeId: string;
      id: string;
      jobTitle: string | null;
      name: string;
      role: "admin" | "employee";
      teamName: string | null;
    }[];
  }>;
  readonly listMyTime: () => Promise<{ entries: readonly TimeEntry[] }>;
  readonly listTeams: () => Promise<{ items: readonly TeamSummary[] }>;
  readonly listWorkload: () => Promise<{ people: readonly PersonLoad[] }>;
  readonly searchWorkspace: (input: {
    readonly query: { readonly q: string };
  }) => Promise<{ hits: readonly KindItem[] }>;
}

const call = <A>(
  api: Api,
  run: (client: DomainClient) => Promise<A>,
): Effect.Effect<A, AppFailure> =>
  api.call((client) => run(client as unknown as DomainClient));

const rows = <T>(
  items: readonly T[],
  project: (item: T) => ListRow,
): { rows: readonly ListRow[] } => ({
  rows: items.map(project),
});

/** My Time: the signed-in user's entries. */
export const myTimeProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listMyTime()), (page) =>
    rows(page.entries, (entry) => ({
      id: entry.id,
      subtitle: `${entry.date} · ${entry.projectName} · ${entry.hours}h`,
      title: entry.taskTitle ?? "General project time",
    })),
  );

/** Workload: each person's open load. */
export const workloadProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listWorkload()), (page) =>
    rows(page.people, (person) => ({
      id: person.id,
      subtitle: `${person.openTasks} open tasks · ${person.loadHours}h`,
      title: person.name,
    })),
  );

const MINUTES_PER_HOUR = 60;
const hoursOf = (minutes: number): number =>
  Math.round((minutes / MINUTES_PER_HOUR) * 10) / 10;

/** Budgets: planned versus billed hours. */
export const budgetsProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listBudgets()), (page) =>
    rows(page.items, (budget) => ({
      id: budget.projectId,
      subtitle: `${hoursOf(budget.spentMinutes)} of ${hoursOf(budget.budgetMinutes)} hours billed`,
      title: budget.projectName,
    })),
  );

/** Files: standalone workspace files. */
export const filesProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listFiles()), (page) =>
    rows(page.files, (file) => ({
      id: file.id,
      subtitle: `${file.projectName} · ${file.sizeLabel} · ${file.uploadedBy}`,
      title: file.name,
    })),
  );

/** Members: the employee directory. */
export const membersProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listMembers()), (page) =>
    rows(page.items, (member) => ({
      id: member.id,
      subtitle: `${member.employeeId} · ${member.role}${member.teamName === null ? "" : ` · ${member.teamName}`}`,
      title: member.name,
    })),
  );

/** Teams: names and member counts. */
export const teamsProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listTeams()), (page) =>
    rows(page.items, (team) => ({
      id: team.id,
      subtitle: `${team.memberCount} members`,
      title: team.name,
    })),
  );

/** Clients: the client companies. */
export const clientsProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listClientCompanies()), (page) =>
    rows(page.items, (company) => ({
      id: company.id,
      subtitle: `${company.projectCount} projects · ${company.openBugCount} open bugs${company.active ? "" : " · inactive"}`,
      title: company.name,
    })),
  );

/** Activity: the workspace feed. */
export const activityProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listActivity()), (page) =>
    rows(page.items, (item) => ({
      id: item.id,
      subtitle: `${item.actorName} · ${item.at.slice(0, 10)}`,
      title: item.detail,
    })),
  );

/** Favorites: starred projects and tasks. */
export const favoritesProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listFavorites()), (page) =>
    rows(page.items, (item) => ({
      id: item.id,
      kind: item.kind,
      subtitle: item.subtitle ?? item.kind,
      title: item.title,
    })),
  );

/** Archive: archived projects and tasks. */
export const archiveProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listArchive()), (page) =>
    rows(page.items, (item) => ({
      id: item.id,
      subtitle: `${item.kind} · archived ${item.archivedAt.slice(0, 10)}`,
      title: item.title,
    })),
  );

/** Search: projects and tasks by text. */
export const searchProgram = (api: Api, query: string) =>
  Effect.map(
    call(api, (client) => client.searchWorkspace({ query: { q: query } })),
    (page) =>
      rows(page.hits, (hit) => ({
        id: hit.id,
        kind: hit.kind,
        subtitle: hit.subtitle ?? hit.kind,
        title: hit.title,
      })),
  );
