import { Effect } from "effect";
import type { AppFailure } from "@/errors";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceListRow } from "@/components/workspace/workspace-list-row";
import { SkelterWorkspaceScreen } from "@/components/workspace/skelter-workspace-screen";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { WorkspaceTabShell } from "@/features/navigation/workspace-tabs";
import { useApi, useApiQuery } from "@/runtime/api-hooks";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";

export interface ListRow {
  readonly id: string;
  readonly kind?: string;
  readonly subtitle: string | null;
  readonly title: string;
}

const SKELETON_ROWS: readonly ListRow[] = [
  { id: "skeleton-row-1", subtitle: "Project details", title: "Project name" },
  { id: "skeleton-row-2", subtitle: "Project details", title: "Project name" },
  { id: "skeleton-row-3", subtitle: "Project details", title: "Project name" },
];

/** One generic, query-backed list screen; domains pass their fetch program. */
export const DomainListScreen = ({
  emptyMessage,
  emptyTitle,
  program,
  queryKey,
  screenTitle,
  trailing,
}: {
  readonly emptyMessage: string;
  readonly emptyTitle: string;
  readonly program: (rows: readonly ListRow[]) => Effect.Effect<{ rows: readonly ListRow[] }, AppFailure>;
  readonly queryKey: readonly unknown[];
  readonly screenTitle: string;
  readonly trailing?: (row: ListRow) => string | null;
}) => {
  const api = useApi();
  const list = useApiQuery({
    enabled: api !== null,
    program: api === null ? Effect.succeed({ rows: [] }) : program([]),
    queryKey,
  });
  const rows = list.data?.rows ?? [];
  const displayRows = list.isPending ? SKELETON_ROWS : rows;

  return (
    <WorkspaceTabShell>
      <SkelterWorkspaceScreen
        hasSkeleton
        isLoading={list.isPending}
        title={screenTitle}
      >
        {list.error !== null && list.error !== undefined ? (
          <WorkspaceErrorState failure={list.error} onRetry={() => void list.refetch()} />
        ) : displayRows.length === 0 ? (
          <WorkspaceEmptyState message={emptyMessage} title={emptyTitle} />
        ) : (
          <View style={styles.list}>
            {displayRows.map((row) => (
              <WorkspaceListRow
                key={row.id}
                {...(row.subtitle === null ? {} : { subtitle: row.subtitle })}
                title={row.title}
                {...(trailing === undefined || trailing(row) === null
                  ? {}
                  : {
                      trailing: (
                        <Text style={{ color: theme.light.text3 }}>{trailing(row) ?? ""}</Text>
                      ),
                    })}
              />
            ))}
          </View>
        )}
      </SkelterWorkspaceScreen>
    </WorkspaceTabShell>
  );
};

/** The search screen: text in, workspace hits out. */
export const SearchScreen = ({
  onHit,
  search,
}: {
  readonly onHit: (hit: ListRow) => void;
  readonly search: (
    query: string,
  ) => Effect.Effect<{ rows: readonly ListRow[] }, AppFailure>;
}) => {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<readonly ListRow[]>([]);
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  const submit = (): void => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setHits([]);
      return;
    }
    void Effect.runPromiseExit(
      Effect.map(search(trimmed), (page) => {
        setHits(page.rows);
      }),
    );
  };

  return (
    <WorkspaceTabShell>
      <WorkspaceScreen title="Search">
        <SearchBox onChange={setQuery} onSubmit={submit} value={query} />
        {hits.length === 0 ? (
          <WorkspaceEmptyState message="Search projects and tasks by name." title="Find work" />
        ) : (
          <View style={styles.list}>
            {hits.map((hit) => (
              <Pressable
                accessibilityLabel={`Open ${hit.title}`}
                accessibilityRole="button"
                key={hit.id}
                onPress={() => onHit(hit)}
                style={({ pressed }) => [
                  styles.hit,
                  { backgroundColor: pressed ? palette.surface2 : palette.surface },
                ]}
              >
                <Text style={[typeStyle("md"), { color: palette.text }]}>{hit.title}</Text>
                <Text style={[typeStyle("xs"), { color: palette.text3 }]}>{hit.subtitle}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </WorkspaceScreen>
    </WorkspaceTabShell>
  );
};

import { TextInput } from "react-native";

const SearchBox = (props: {
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly value: string;
}) => (
  <View style={styles.searchRow}>
    <TextInput
      accessibilityLabel="Search query"
      maxFontSizeMultiplier={2}
      onChangeText={props.onChange}
      onSubmitEditing={props.onSubmit}
      placeholder="Search projects and tasks"
      returnKeyType="search"
      style={styles.input}
      value={props.value}
    />
    <Pressable accessibilityRole="button" onPress={props.onSubmit} style={styles.searchButton}>
      <Text style={{ color: theme.light.accent }}>Search</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  hit: {
    borderRadius: 8,
    gap: 2,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  input: {
    borderColor: theme.light.border,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
  list: {
    gap: spacing.s1,
  },
  searchButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
  searchRow: {
    flexDirection: "row",
    gap: spacing.s2,
    paddingBottom: spacing.s2,
  },
});
