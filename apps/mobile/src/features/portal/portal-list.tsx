import { Effect } from "effect";
import { useState } from "react";
import { withSkeleton } from "react-zero-skeleton";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceListRow } from "@/components/workspace/workspace-list-row";
import type { ListRow } from "@/features/workspace/domain-list-screen";
import { useApi, useApiQuery } from "@/runtime/api-hooks";
import type { AppFailure } from "@/errors";
import { useTheme } from "@/theme/theme-provider";
import { theme } from "@/theme/tokens.generated";

/** A query-backed list body for the portal screens. */
export const PortalListBody = ({
  emptyTitle,
  program,
  queryKey,
}: {
  readonly emptyTitle: string;
  readonly program: (api: NonNullable<ReturnType<typeof useApi>>) => Effect.Effect<{ rows: readonly ListRow[] }, AppFailure>;
  readonly queryKey: readonly unknown[];
}) => {
  const api = useApi();
  const list = useApiQuery({
    enabled: api !== null,
    program: api === null ? Effect.succeed({ rows: [] }) : program(api),
    queryKey,
  });
  const rows = list.data?.rows ?? [];

  if (list.error !== null && list.error !== undefined) {
    return <WorkspaceErrorState failure={list.error} onRetry={() => void list.refetch()} />;
  }
  const displayRows = list.isPending ? SKELETON_ROWS : rows;
  if (!list.isPending && displayRows.length === 0) {
    return <WorkspaceEmptyState message="Nothing here yet." title={emptyTitle} />;
  }
  return <SkelterPortalRows hasSkeleton isLoading={list.isPending} rows={displayRows} />;
};

const SKELETON_ROWS: readonly ListRow[] = [
  { id: "skeleton-portal-1", subtitle: "Project details", title: "Project name" },
  { id: "skeleton-portal-2", subtitle: "Project details", title: "Project name" },
  { id: "skeleton-portal-3", subtitle: "Project details", title: "Project name" },
];

const PortalRows = ({ rows }: { readonly rows: readonly ListRow[] }) => (
  <View style={styles.list}>
    {rows.map((row) => (
      <WorkspaceListRow
        key={row.id}
        {...(row.subtitle === null ? {} : { subtitle: row.subtitle })}
        title={row.title}
      />
    ))}
  </View>
);

export const SkelterPortalRows = withSkeleton(PortalRows);

/** The portal account screen: identity card and sign-out. */
export const PortalAccountBody = ({
  email,
  name,
  onOpenNotifications,
  onSignOut,
}: {
  readonly email: string;
  readonly name: string;
  readonly onOpenNotifications?: () => void;
  readonly onSignOut: () => void;
}) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [pressed, setPressed] = useState(false);

  return (
    <View style={styles.card}>
      <Text style={[{ color: palette.text, fontSize: 16, fontWeight: "600" }, styles.name]}>
        {name}
      </Text>
      <Text style={{ color: palette.text3 }}>{email}</Text>
      {onOpenNotifications === undefined ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenNotifications}
          style={styles.signOut}
        >
          <Text style={{ color: palette.text }}>Notifications</Text>
        </Pressable>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={onSignOut}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={[styles.signOut, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Text style={{ color: palette.red }}>Sign out</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: 4,
    paddingVertical: 12,
  },
  list: {
    gap: 4,
  },
  name: {
    paddingBottom: 2,
  },
  signOut: {
    alignItems: "center",
    minHeight: 44,
    justifyContent: "center",
    marginTop: 12,
  },
});
