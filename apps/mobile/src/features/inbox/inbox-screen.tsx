import { Effect } from "effect";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { WorkspaceChip } from "@/components/workspace/workspace-chip";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import {
  markAllInboxRead,
  markInboxItemRead,
  splitInbox,
  type InboxItem,
} from "@/features/inbox/queries";
import type { ApiContextValue, KeysContextValue } from "@/runtime/api-hooks";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";

export interface InboxScreenProps {
  readonly api: ApiContextValue;
  readonly items: readonly InboxItem[];
  readonly keys: KeysContextValue;
  readonly onOpenTask: (taskId: string) => void;
}

/** The inbox: All/Unread tabs, per-item read marks and a mark-all action. */
export const InboxScreen = ({ api, items, keys, onOpenTask }: InboxScreenProps) => {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const groups = splitInbox(items);
  const visible = tab === "all" ? groups.all : groups.unread;

  const markRead = (id: string): void => {
    void Effect.runPromise(
      Effect.andThen(
        keys.run(`read-${id}`, (key) => markInboxItemRead(api, key, id)),
        Effect.sync(() => queryClient.invalidateQueries({ queryKey: ["inbox"] })),
      ),
    );
  };

  const markAll = (): void => {
    void Effect.runPromise(
      Effect.andThen(
        keys.run("read-all", (key) => markAllInboxRead(api, key)),
        Effect.sync(() => queryClient.invalidateQueries({ queryKey: ["inbox"] })),
      ),
    );
  };

  return (
    <WorkspaceScreen title="Inbox">
      <View style={styles.tabs}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "all" }}
          onPress={() => setTab("all")}
        >
          <WorkspaceChip color="gray" label={`All ${groups.all.length}`} selected={tab === "all"} />
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === "unread" }}
          onPress={() => setTab("unread")}
        >
          <WorkspaceChip
            color="green"
            label={`Unread ${groups.unread.length}`}
            selected={tab === "unread"}
          />
        </Pressable>
        {groups.unread.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={markAll} style={styles.markAll}>
            <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.accent }]}>
              Mark all read
            </Text>
          </Pressable>
        ) : null}
      </View>
      {visible.length === 0 ? (
        <WorkspaceEmptyState message="You are all caught up." title="Inbox zero" />
      ) : (
        <View style={styles.list}>
          {visible.map((item) => (
            <Pressable
              accessibilityLabel={`${item.readAt === null ? "Unread" : "Read"}: ${item.title}`}
              accessibilityRole="button"
              key={item.id}
              onPress={() => {
                if (item.readAt === null) {
                  markRead(item.id);
                }
                if (item.taskId !== null) {
                  onOpenTask(item.taskId);
                }
              }}
              style={({ pressed }) => [
                styles.item,
                { backgroundColor: pressed ? palette.surface2 : palette.surface },
              ]}
            >
              <Text
                style={[
                  typeStyle("md", { weight: item.readAt === null ? 600 : 400 }),
                  { color: palette.text },
                ]}
              >
                {item.title}
              </Text>
              <Text style={[typeStyle("xs"), { color: palette.text3 }]}>
                {item.kind}
                {item.taskTitle === null ? "" : ` · ${item.taskTitle}`}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </WorkspaceScreen>
  );
};

const styles = StyleSheet.create({
  item: {
    borderRadius: 8,
    gap: 2,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
  },
  list: {
    gap: spacing.s1,
  },
  markAll: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.s2,
  },
  tabs: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.s2,
    paddingVertical: spacing.s2,
  },
});
