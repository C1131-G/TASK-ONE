import { DomainRoute } from "@/features/workspace/domain-route";
import { myTimeProgram } from "@/features/workspace/domain-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="My Time"
      makeProgram={(api) => myTimeProgram(api)}
      queryKey={["my-time"]}
      screenTitle="My Time"
    />
  );
}
