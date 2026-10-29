import { Effect } from "effect";

import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import type { AppFailure } from "@/errors";
import { PreferencesScreen } from "@/features/preferences/preferences-screen";
import {
  getPreferences,
  type Preference,
  type PreferenceAudience,
} from "@/features/preferences/queries";
import { useApi, useApiQuery, useKeys } from "@/runtime/api-hooks";

/** Loads the person's settings, then shows the switches. */
export const PreferencesRoute = ({ audience }: { readonly audience: PreferenceAudience }) => {
  const api = useApi();
  const keys = useKeys();

  const program: Effect.Effect<readonly Preference[], AppFailure> =
    api === null ? Effect.succeed([]) : getPreferences(api, audience);

  const loaded = useApiQuery({
    enabled: api !== null,
    program,
    queryKey: ["notification-preferences", audience],
  });

  if (api === null || keys === null || loaded.isPending) {
    return <WorkspaceSkeleton variant="panel" />;
  }
  if (loaded.error !== null) {
    return <WorkspaceErrorState failure={loaded.error} onRetry={() => void loaded.refetch()} />;
  }

  return (
    <PreferencesScreen
      api={api}
      audience={audience}
      keys={keys}
      preferences={loaded.data ?? []}
    />
  );
};
