import { DomainRoute } from "@/features/workspace/domain-route";
import { notificationsProgram } from "@/features/workspace/more-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Notifications"
      makeProgram={(api) => notificationsProgram(api)}
      queryKey={["notifications-ws"]}
      screenTitle="Notifications"
    />
  );
}
