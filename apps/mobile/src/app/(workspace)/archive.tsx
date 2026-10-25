import { DomainRoute } from "@/features/workspace/domain-route";
import { archiveProgram } from "@/features/workspace/domain-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Archive"
      makeProgram={(api) => archiveProgram(api)}
      queryKey={["archive"]}
      screenTitle="Archive"
    />
  );
}
