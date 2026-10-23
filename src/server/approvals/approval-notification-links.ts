import type { Transaction } from "../work/work-internal";
import { loadVisibleRequests } from "./approval-access";
import { requestNotificationText } from "./approval-notify";

interface NotificationRow {
  readonly actorId: string | null;
  readonly createdAt: Date;
  readonly id: string;
  readonly projectId: string | null;
  readonly taskId: string | null;
  readonly text: string;
  readonly type: string;
}

// A notification keeps no link of its own, so a request notification is tied
// back to its request by what it was written from: the same instant, project
// and requester, and the exact text. Only requests this company can open now
// are returned, so a cancelled, unshared or foreign request never becomes a
// link, and a notification that matches nothing simply has none.
export const approvalLinksFor = async (
  transaction: Transaction,
  companyId: string,
  notifications: readonly NotificationRow[]
): Promise<ReadonlyMap<string, string>> => {
  const candidates = notifications.filter(
    ({ projectId, taskId, type }) =>
      taskId === null && projectId !== null && type === "status"
  );
  if (candidates.length === 0) {
    return new Map();
  }
  const { requests } = await loadVisibleRequests(transaction, companyId);
  const byKey = new Map(
    requests.map((request) => [
      [
        request.projectId,
        request.requestedAt.getTime(),
        request.requestedById,
        requestNotificationText(request.subjectTitle, request.version),
      ].join("|"),
      request.id,
    ])
  );
  const links = new Map<string, string>();
  for (const { actorId, createdAt, id, projectId, text } of candidates) {
    const approvalId = byKey.get(
      [projectId, createdAt.getTime(), actorId, text].join("|")
    );
    if (approvalId) {
      links.set(id, approvalId);
    }
  }
  return links;
};
