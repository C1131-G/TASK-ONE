import { DomainRoute } from "@/features/workspace/domain-route";
import { calendarProgram } from "@/features/workspace/more-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Calendar"
      makeProgram={(api) => calendarProgram(api)}
      queryKey={["calendar"]}
      screenTitle="Calendar"
    />
  );
}
