import { TaskDrawerProvider } from "@/features/tasks/components/task-drawer";
import type { TaskDrawerProviderProps } from "@/features/tasks/components/task-drawer";
import { readTaskBundle } from "@/features/tasks/task-details-panel-data";

// Server half of the drawer. When ?task= names a task on the page, its details
// are read during the request and streamed to the drawer as an unawaited
// promise, so the page is not held back and the drawer skips a client round trip.
export const TaskDrawerHost = (
  props: Omit<TaskDrawerProviderProps, "initialTaskBundlePromise">
) => {
  const initialTask = props.initialTaskId
    ? props.tasks.find((task) => task.id === props.initialTaskId)
    : undefined;
  const initialTaskBundle = initialTask
    ? readTaskBundle(initialTask.projectId, initialTask.id)
    : null;
  return (
    <TaskDrawerProvider
      {...props}
      initialTaskBundlePromise={initialTaskBundle}
    />
  );
};
