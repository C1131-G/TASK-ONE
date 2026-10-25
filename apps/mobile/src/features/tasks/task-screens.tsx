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
import { WorkspaceSkeleton } from "@/components/workspace/workspace-skeleton";
import { TaskStatusTrigger } from "@/features/tasks/task-status-sheet";
import {
  listSubtasks,
  setSubtaskStatus,
  setTaskStatus,
  type TaskStatus,
} from "@/features/tasks/queries";
import {
  failureOf,
  useApiQuery,
  type ApiContextValue,
  type KeysContextValue,
} from "@/runtime/api-hooks";
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
  readonly priority: "high" | "low" | "medium" | "urgent";
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

/** The task detail: status mover and subtasks with optimistic toggles. */
export const TaskDetailScreen = ({
  api,
  keys,
  task,
  taskId,
}: {
  readonly api: ApiContextValue;
  readonly keys: KeysContextValue;
  readonly task: {
    readonly projectName: string;
    readonly status: TaskStatus;
    readonly title: string;
    readonly version: number;
  };
  readonly taskId: string;
}) => {
  const queryClient = useQueryClient();
  const { isDark } = useTheme();
  const palette = isDark ? theme.dark : theme.light;

  const subtasks = useApiQuery({
    program: listSubtasks(api, taskId),
    queryKey: ["tasks", taskId, "subtasks"],
  });
  const failure: AppFailure | undefined = subtasks.error ?? undefined;

  const toggle = (subtaskId: string, done: boolean): void => {
    void Effect.runPromise(
      Effect.andThen(
        keys.run(`toggle-${subtaskId}`, (key) =>
          setSubtaskStatus(api, key, taskId, subtaskId, task.version, done),
        ),
        Effect.andThen(
          Effect.sync(() => queryClient.invalidateQueries({ queryKey: ["tasks", taskId] })),
          Effect.void,
        ),
      ),
    );
  };

  return (
    <WorkspaceScreen title={task.title}>
      <Text style={[typeStyle("sm"), styles.project, { color: palette.text3 }]}>
        {task.projectName}
      </Text>
      <TaskStatusTrigger
        current={task.status}
        onMove={(status) => {
          void Effect.runPromise(
            keys.run(`move-${taskId}`, (key) =>
              setTaskStatus(api, key, taskId, task.version, status),
            ),
          );
          void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }}
      />
      {subtasks.isPending ? (
        <WorkspaceSkeleton variant="panel" />
      ) : failure !== undefined ? (
        <WorkspaceErrorState failure={failure} onRetry={() => void subtasks.refetch()} />
      ) : (
        <View style={styles.subtasks}>
          {(subtasks.data?.subtasks ?? []).map((subtask) => (
            <WorkspaceListRow
              accessibilityLabel={`Toggle subtask ${subtask.title}`}
              key={subtask.id}
              onPress={() => toggle(subtask.id, !subtask.done)}
              title={subtask.title}
              trailing={
                <Text style={{ color: subtask.done ? palette.green : palette.text3 }}>
                  {subtask.done ? "Done" : "Open"}
                </Text>
              }
            />
          ))}
        </View>
      )}
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
