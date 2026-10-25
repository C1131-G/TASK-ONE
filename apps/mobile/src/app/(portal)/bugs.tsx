import { Effect } from "effect";

import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { PortalListBody } from "@/features/portal/portal-list";
import { listPortalBugs } from "@/features/portal/queries";

export default function Route() {
  return (
    <WorkspaceScreen title="Bugs">
      <PortalListBody
        emptyTitle="Bugs"
        program={(api) => Effect.map(listPortalBugs(api), (page) => ({
          rows: page.bugs.map((bug) => ({
            id: bug.id,
            subtitle: `${bug.projectName} · ${bug.priority} · ${bug.status}`,
            title: bug.title,
          })),
        }))}
        queryKey={["portal", "bugs"]}
      />
    </WorkspaceScreen>
  );
}
