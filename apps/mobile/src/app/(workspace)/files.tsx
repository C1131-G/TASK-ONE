import { DomainRoute } from "@/features/workspace/domain-route";
import { filesProgram } from "@/features/workspace/domain-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Files"
      makeProgram={(api) => filesProgram(api)}
      queryKey={["files"]}
      screenTitle="Files"
    />
  );
}
