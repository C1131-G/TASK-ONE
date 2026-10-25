import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { WorkspaceSheet } from "@/components/workspace/workspace-sheet";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { radii, spacing, theme } from "@/theme/tokens.generated";
import type { TaskStatus } from "@/features/tasks/queries";

const STATUS_ORDER: readonly TaskStatus[] = ["todo", "progress", "review", "done"];

export interface TaskStatusSheetProps {
  readonly current: TaskStatus;
  readonly onMove: (status: TaskStatus) => void;
  readonly open: boolean;
  readonly onClose: () => void;
}

/** The status mover: lists every status, marks the current one. */
export const TaskStatusSheet = ({ current, onClose, onMove, open }: TaskStatusSheetProps) => {
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  return (
    <WorkspaceSheet onClose={onClose} title="Move to" visible={open}>
      {STATUS_ORDER.map((status) => (
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ checked: status === current }}
          key={status}
          onPress={() => {
            onMove(status);
            onClose();
          }}
          style={({ pressed }) => [
            styles.option,
            { backgroundColor: pressed ? palette.surface2 : "transparent" },
          ]}
        >
          <Text style={[typeStyle("md"), { color: palette.text, flex: 1 }]}>{status}</Text>
          {status === current ? <Text style={{ color: palette.accent }}>✓</Text> : null}
        </Pressable>
      ))}
    </WorkspaceSheet>
  );
};

/** A compact trigger row that opens the status sheet. */
export const TaskStatusTrigger = (props: Omit<TaskStatusSheetProps, "open" | "onClose">) => {
  const [open, setOpen] = useState(false);
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  useEffect(() => () => setOpen(false), []);

  return (
    <View>
      <Pressable
        accessibilityLabel="Change status"
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: palette.surface2 }]}
      >
        <Text style={[typeStyle("sm", { weight: 500 }), { color: palette.text }]}>
          Status: {props.current}
        </Text>
      </Pressable>
      <TaskStatusSheet {...props} onClose={() => setOpen(false)} open={open} />
    </View>
  );
};

const styles = StyleSheet.create({
  option: {
    alignItems: "center",
    borderRadius: radii.md,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: spacing.s3,
  },
  trigger: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s1,
  },
});
