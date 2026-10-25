import { DomainRoute } from "@/features/workspace/domain-route";
import { timelineProgram } from "@/features/workspace/more-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Timeline"
      makeProgram={(api) => timelineProgram(api)}
      queryKey={["timeline"]}
      screenTitle="Timeline"
    />
  );
}
