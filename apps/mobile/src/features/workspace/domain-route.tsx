import { Effect } from "effect";

import { DomainListScreen } from "@/features/workspace/domain-list-screen";
import type { ListRow } from "@/features/workspace/domain-list-screen";
import { useApi } from "@/runtime/api-hooks";
import type { AppFailure } from "@/errors";
export interface DomainRouteProps {
  readonly emptyMessage: string;
  readonly emptyTitle: string;
  readonly makeProgram: (
    api: NonNullable<ReturnType<typeof useApi>>,
  ) => Effect.Effect<{ rows: readonly ListRow[] }, AppFailure>;
  readonly queryKey: readonly unknown[];
  readonly screenTitle: string;
}

/** One workspace list route over its domain program. */
export const DomainRoute = ({
  emptyMessage,
  emptyTitle,
  makeProgram,
  queryKey,
  screenTitle,
}: DomainRouteProps) => {
  const api = useApi();
  const program = api === null ? Effect.succeed({ rows: [] }) : makeProgram(api);

  return (
    <DomainListScreen
      emptyMessage={emptyMessage}
      emptyTitle={emptyTitle}
      program={() => program}
      queryKey={queryKey}
      screenTitle={screenTitle}
    />
  );
};
