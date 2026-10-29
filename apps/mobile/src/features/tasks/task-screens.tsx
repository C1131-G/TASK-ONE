import { Effect } from "effect";
import { useState } from "react";
import type { AppFailure } from "@/errors";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

import { WorkspaceChip } from "@/components/workspace/workspace-chip";
import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceErrorState } from "@/components/workspace/workspace-error-state";
import { WorkspaceListRow } from "@/components/workspace/workspace-list-row";
import { WorkspaceScreen } from "@/components/workspace/workspace-screen";
import { TaskStatusTrigger } from "@/features/tasks/task-status-sheet";
import {
  changeTask,
  setSubtaskStatus,
  type TaskPriority,
  type TaskStatus,
} from "@/features/tasks/queries";
import type { ApiContextValue, KeysContextValue } from "@/runtime/api-hooks";
import { useTheme } from "@/theme/theme-provider";
import { typeStyle } from "@/theme/type-scale";
import { spacing, theme } from "@/theme/tokens.generated";

const STATUS_FILTERS: readonly (TaskStatus | "all")[] = [
  "all",
  "todo",
  "progress",
  "review",
  "done",
];

export interface TaskRowModel {
  readonly dueAt: string | null;
  readonly id: string;
  readonly priority: TaskPriority;
  readonly projectName: string;
  readonly status: TaskStatus;
  readonly title: string;
}

/** Filters the task list to one status (pure; pinned by tests). */
export const filterTasks = <T extends { readonly status: TaskStatus }>(
  tasks: readonly T[],
  status: TaskStatus | "all",
): readonly T[] => (status === "all" ? tasks : tasks.filter((task) => task.status === status));

/** The My Tasks screen: status chips and the open task rows. */
export const MyTasksScreen = ({
  onOpenTask,
  tasks,
}: {
  readonly onOpenTask: (id: string) => void;
  readonly tasks: readonly TaskRowModel[];
}) => {
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const visible = filterTasks(tasks, filter);

  return (
    <WorkspaceScreen title="My Tasks">
      <View style={styles.filters}>
        {STATUS_FILTERS.map((status) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === status }}
            key={status}
            onPress={() => setFilter(status)}
          >
            <WorkspaceChip
              color={status === "all" ? "gray" : "green"}
              label={status === "all" ? "All" : status}
              selected={filter === status}
            />
          </Pressable>
        ))}
      </View>
      {visible.length === 0 ? (
        <WorkspaceEmptyState message="No tasks in this view." title="Nothing here" />
      ) : (
        <View style={styles.list}>
          {visible.map((task) => (
            <WorkspaceListRow
              accessibilityLabel={`Open task ${task.title}`}
              key={task.id}
              onPress={() => onOpenTask(task.id)}
              subtitle={`${task.projectName} · ${task.priority}`}
              title={task.title}
            />
          ))}
        </View>
      )}
      <Text style={[typeStyle("xs"), { color: palette.text3 }]}>
        {visible.length} of {tasks.length} tasks
      </Text>
    </WorkspaceScreen>
  );
};

export interface TaskDetailModel {
  readonly projectName: string;
  readonly status: TaskStatus;
  readonly subtasks: readonly { readonly completed: boolean; readonly id: string; readonly title: string }[];
  readonly title: string;
  readonly version: number;
}

/** The task detail: status mover and subtasks, each write under its own key. */
export const TaskDetailScreen = ({
  api,
  keys,
  task,
  taskId,
}: {
  readonly api: ApiContextValue;
  readonly keys: KeysContextValue;
  readonly task: TaskDetailModel;
  readonly taskId: string;
}) => {
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;
  const [failure, setFailure] = useState<AppFailure | null>(null);

  // Every write reports a failure on screen and refreshes the task on success.
  const run = (write: Effect.Effect<unknown, AppFailure>): void => {
    setFailure(null);
    void Effect.runPromise(
      Effect.matchEffect(write, {
        onFailure: (error) => Effect.sync(() => setFailure(error)),
        onSuccess: () =>
          Effect.sync(() => {
            void queryClient.invalidateQueries({ queryKey: ["tasks"] });
          }),
      }),
    );
  };

  return (
    <WorkspaceScreen title={task.title}>
      <Text style={[typeStyle("sm"), styles.project, { color: palette.text3 }]}>
        {task.projectName}
      </Text>
      <TaskStatusTrigger
        current={task.status}
        onMove={(status) =>
          run(
            keys.run(`move-${taskId}`, (key) =>
              changeTask(api, key, taskId, { expectedVersion: task.version, status }),
            ),
          )
        }
      />
      {failure === null ? null : <WorkspaceErrorState failure={failure} />}
      <View style={styles.subtasks}>
        {task.subtasks.map((subtask) => (
          <WorkspaceListRow
            accessibilityLabel={`Toggle subtask ${subtask.title}`}
            key={subtask.id}
            onPress={() =>
              run(
                keys.run(`toggle-${subtask.id}`, (key) =>
                  setSubtaskStatus(api, key, taskId, subtask.id, task.version, !subtask.completed),
                ),
              )
            }
            title={subtask.title}
            trailing={
              <Text style={{ color: subtask.completed ? palette.green : palette.text3 }}>
                {subtask.completed ? "Done" : "Open"}
              </Text>
            }
          />
        ))}
      </View>
    </WorkspaceScreen>
  );
};
const styles = StyleSheet.create({
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
    paddingVertical: spacing.s2,
  },
  list: {
    gap: spacing.s1,
  },
  project: {
    paddingBottom: spacing.s2,
  },
  subtasks: {
    gap: spacing.s1,
    paddingTop: spacing.s2,
  },
});
