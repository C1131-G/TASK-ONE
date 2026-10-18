import type { BugRelationInput } from "./bug-contracts";
import type { Transaction } from "./work-internal";

export const hasRelationPath = async (
  transaction: Transaction,
  startBugId: string,
  targetBugId: string,
  type: BugRelationInput["type"]
): Promise<boolean> => {
  const relations = await transaction.orm.public.BugRelation.where({ type })
    .select("fromBugReportId", "toBugReportId")
    .all();
  const outgoing = new Map<string, string[]>();
  for (const relation of relations) {
    const neighbors = outgoing.get(relation.fromBugReportId) ?? [];
    neighbors.push(relation.toBugReportId);
    outgoing.set(relation.fromBugReportId, neighbors);
  }
  const visited = new Set<string>();
  let frontier = [startBugId];
  while (frontier.length > 0) {
    const current = frontier.filter((id) => !visited.has(id));
    if (current.length === 0) {
      return false;
    }
    if (current.includes(targetBugId)) {
      return true;
    }
    for (const id of current) {
      visited.add(id);
    }
    frontier = current.flatMap((id) => outgoing.get(id) ?? []);
  }
  return false;
};
