import { DomainRoute } from "@/features/workspace/domain-route";
import { favoritesProgram } from "@/features/workspace/domain-queries";

export default function Route() {
  return (
    <DomainRoute
      emptyMessage="Nothing here yet."
      emptyTitle="Favorites"
      makeProgram={(api) => favoritesProgram(api)}
      queryKey={["favorites"]}
      screenTitle="Favorites"
    />
  );
}
