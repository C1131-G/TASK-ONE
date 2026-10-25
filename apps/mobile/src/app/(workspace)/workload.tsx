import { DomainRoute } from "@/features/workspace/domain-route";
import { workloadProgram } from "@/features/workspace/domain-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Workload"
      makeProgram={(api) => workloadProgram(api)}
      queryKey={["workload"]}
      screenTitle="Workload"
    />
  );
}
