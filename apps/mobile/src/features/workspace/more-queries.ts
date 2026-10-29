import { Effect } from "effect";

import type { AppFailure } from "@/errors";
import { listInbox } from "@/features/inbox/queries";
import { listTasks, type TaskSummary } from "@/features/tasks/queries";
import type { ListRow } from "@/features/workspace/domain-list-screen";
import type { MobileApi } from "@/services/mobile-api";

type Api = MobileApi["Service"];

export interface ApprovalRequest {
  readonly bugTitle: string;
  readonly id: string;
  readonly projectName: string;
  readonly reportedBy: string;
  readonly status: "approved" | "pending" | "rejected";
}

interface MoreClient {
  readonly listBugApprovals: () => Promise<{ items: readonly ApprovalRequest[] }>;
}

const call = <A>(api: Api, run: (client: MoreClient) => Promise<A>): Effect.Effect<A, AppFailure> =>
  api.call((client) => run(client as unknown as MoreClient));

/** Bug approval requests with status. */
export const bugApprovalsProgram = (api: Api) =>
  Effect.map(call(api, (client) => client.listBugApprovals()), (page) => ({
    rows: page.items.map<ListRow>((item) => ({
      id: item.id,
      subtitle: `${item.projectName} · ${item.reportedBy} · ${item.status}`,
      title: item.bugTitle,
    })),
  }));

/** The notifications page list. */
export const notificationsProgram = (api: Api) =>
  Effect.map(listInbox(api), (page) => ({
    rows: page.items.map<ListRow>((item) => ({
      id: item.id,
      subtitle: `${item.type} · ${item.createdAt.slice(0, 10)}${item.readAt === null ? " · unread" : ""}`,
      title: item.text,
    })),
  }));

const dueRow = (task: TaskSummary): ListRow => ({
  id: task.id,
  kind: "task",
  subtitle: `${task.projectName} · ${task.status}${task.dueAt === null ? "" : ` · due ${task.dueAt.slice(0, 10)}`}`,
  title: task.title,
});

/** Calendar view: dated tasks grouped under their due date. */
export const calendarProgram = (api: Api) =>
  Effect.map(listTasks(api), (page) => {
    const dated = page.tasks
      .filter((task) => task.dueAt !== null)
      .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""));
    return {
      rows: dated.map<ListRow>((task, index) => {
        const due = task.dueAt?.slice(0, 10) ?? "";
        const previous = index > 0 ? dated[index - 1]?.dueAt?.slice(0, 10) : undefined;
        return {
          ...dueRow(task),
          // Repeat the date on the first row of each day group only.
          subtitle:
            previous === due
              ? `${task.projectName} · ${task.status}`
              : `${due} · ${task.projectName} · ${task.status}`,
        };
      }),
    };
  });

/** Timeline view: open work ordered by due date. */
export const timelineProgram = (api: Api) =>
  Effect.map(listTasks(api), (page) => ({
    rows: page.tasks
      .filter((task) => task.status !== "done")
      .sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"))
      .map<ListRow>(dueRow),
  }));
