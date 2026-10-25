import { DomainRoute } from "@/features/workspace/domain-route";
import { clientsProgram } from "@/features/workspace/domain-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Clients"
      makeProgram={(api) => clientsProgram(api)}
      queryKey={["clients"]}
      screenTitle="Clients"
    />
  );
}
