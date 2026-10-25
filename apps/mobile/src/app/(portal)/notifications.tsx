import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { PortalListBody } from "@/features/portal/portal-list";
import { portalNotificationsProgram } from "@/features/portal/portal-queries";

export default function Route() {
  return (
    <WorkspaceScreen title="Notifications">
      <PortalListBody
        emptyTitle="Notifications"
        program={(api) => portalNotificationsProgram(api)}
        queryKey={["portal-notifications"]}
      />
    </WorkspaceScreen>
  );
}
