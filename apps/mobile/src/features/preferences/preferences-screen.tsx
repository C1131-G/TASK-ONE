import { Effect, Exit } from "effect";
import { useState } from "react";
import { withSkeleton } from "react-zero-skeleton";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import {
  CHANNEL_LABELS,
  EVENT_LABELS,
  groupByEvent,
  setPreference,
  type Preference,
  type PreferenceAudience,
} from "@/features/preferences/queries";
import type { ApiContextValue, KeysContextValue } from "@/runtime/api-hooks";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";

export interface PreferencesScreenProps {
  readonly api: ApiContextValue;
  readonly audience: PreferenceAudience;
  readonly keys: KeysContextValue;
  readonly preferences: readonly Preference[];
}

const cellOf = (preference: Preference): string => `${preference.eventType}:${preference.channel}`;

/**
 * Which notifications reach the person, per kind and channel. A switch shows
 * its new state at once and goes back if the server refuses the change.
 */
export const PreferencesScreen = ({ api, audience, keys, preferences }: PreferencesScreenProps) => {
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [shown, setShown] = useState<Readonly<Record<string, boolean>>>({});

  const toggle = (preference: Preference): void => {
    const cell = cellOf(preference);
    const next = !(shown[cell] ?? preference.enabled);
    setShown((current) => ({ ...current, [cell]: next }));
    void Effect.runPromise(
      Effect.gen(function* settle() {
        const exit = yield* Effect.exit(
          keys.run(`preference-${cell}-${String(next)}`, (key) =>
            setPreference(api, key, audience, { ...preference, enabled: next }),
          ),
        );
        if (Exit.isSuccess(exit)) {
          yield* Effect.promise(() =>
            queryClient.invalidateQueries({ queryKey: ["notification-preferences", audience] }),
          );
        }
        yield* Effect.sync(() =>
          setShown((current) => {
            const { [cell]: _settled, ...rest } = current;
            return rest;
          }),
        );
      }),
    );
  };

  const groups = groupByEvent(preferences);

  return (
    <WorkspaceScreen title="Notifications">
      {groups.length === 0 ? (
        <WorkspaceEmptyState message="There is nothing to switch on or off." title="No settings" />
      ) : (
        <View style={styles.list}>
          {groups.map((group) => (
            <View key={group.eventType} style={styles.group}>
              <Text style={[typeStyle("md", { weight: 600 }), { color: palette.text }]}>
                {EVENT_LABELS[group.eventType]}
              </Text>
              {group.rows.map((preference) => {
                const enabled = shown[cellOf(preference)] ?? preference.enabled;
                return (
                  <Pressable
                    accessibilityLabel={`${EVENT_LABELS[preference.eventType]}: ${CHANNEL_LABELS[preference.channel]}`}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: enabled }}
                    key={cellOf(preference)}
                    onPress={() => toggle(preference)}
                    style={[styles.row, { backgroundColor: palette.surface }]}
                  >
                    <Text style={[typeStyle("md"), { color: palette.text }]}>
                      {CHANNEL_LABELS[preference.channel]}
                    </Text>
                    <Text
                      style={[
                        typeStyle("sm", { weight: 600 }),
                        { color: enabled ? palette.accent : palette.text3 },
                      ]}
                    >
                      {enabled ? "On" : "Off"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </WorkspaceScreen>
  );
};

export const SkelterPreferencesScreen = withSkeleton(PreferencesScreen);

const styles = StyleSheet.create({
  group: {
    gap: spacing.s1,
    paddingVertical: spacing.s2,
  },
  list: {
    gap: spacing.s2,
  },
  row: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
});
