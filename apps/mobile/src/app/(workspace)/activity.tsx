import { DomainRoute } from "@/features/workspace/domain-route";
import { activityProgram } from "@/features/workspace/domain-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Activity"
      makeProgram={(api) => activityProgram(api)}
      queryKey={["activity"]}
      screenTitle="Activity"
    />
  );
}
