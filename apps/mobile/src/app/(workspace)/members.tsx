import { DomainRoute } from "@/features/workspace/domain-route";
import { membersProgram } from "@/features/workspace/domain-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Members"
      makeProgram={(api) => membersProgram(api)}
      queryKey={["members"]}
      screenTitle="Members"
    />
  );
}
