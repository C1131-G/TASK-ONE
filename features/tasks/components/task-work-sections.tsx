/* eslint-disable shadcn/no-unknown-classes */

"use client";

import type { ComponentProps } from "react";

import {
  TaskDetailsForm,
  TaskDetailsFormSkeleton,
} from "@/features/tasks/components/task-details-form";
import { TaskSubtasksSection } from "@/features/tasks/components/task-details-subtasks";
import type { TaskSubtaskView } from "@/features/tasks/components/task-details-subtasks";
import { TaskRecurrenceEditor } from "@/features/tasks/components/task-recurrence-editor";
import { TaskRelationsEditor } from "@/features/tasks/components/task-relations-editor";
import type { useTaskSubtaskActions } from "@/features/tasks/hooks/use-task-subtask-actions";
import type { EditableTask } from "@/features/tasks/task-details-draft";
import type { EmployeeOption } from "@/features/tasks/task-details-panel-data";

type DetailsFormProps = ComponentProps<typeof TaskDetailsForm>;

// The editable sections of an ordinary task: details, subtasks, relations and recurrence.
export const TaskWorkSections = ({
  editable,
  employees,
  onDirtyChange,
  onReload,
  onSaved,
  onVersionChange,
  projectId,
  subtaskActions,
  subtasks,
  task,
  taskId,
  version,
  versionIsCurrent,
}: {
  readonly editable: boolean;
  readonly employees: readonly EmployeeOption[];
  readonly onDirtyChange: DetailsFormProps["onDirtyChange"];
  readonly onReload: () => Promise<void>;
  readonly onSaved: DetailsFormProps["onSaved"];
  readonly onVersionChange: (version: number) => void;
  readonly projectId: string;
  readonly subtaskActions: ReturnType<typeof useTaskSubtaskActions>;
  readonly subtasks: readonly TaskSubtaskView[];
  readonly task: EditableTask | null;
  readonly taskId: string;
  readonly version: number;
  readonly versionIsCurrent: boolean;
}) => {
  const {
    add: handleAdd,
    edit: handleEdit,
    promote: handlePromote,
    remove: handleRemove,
    reorder: handleReorder,
    toggle: handleToggle,
  } = subtaskActions;
  return (
    <>
      <section className="stack">
        <h3>Details</h3>
        {task ? (
          <TaskDetailsForm
            editable={editable}
            employees={employees}
            key={task.version}
            onDirtyChange={onDirtyChange}
            onReload={() => onReload()}
            onSaved={onSaved}
            task={task}
            version={version}
            versionIsCurrent={versionIsCurrent}
          />
        ) : (
          <TaskDetailsFormSkeleton />
        )}
      </section>
      <TaskSubtasksSection
        editable={editable}
        employees={employees}
        onAdd={handleAdd}
        onPromote={handlePromote}
        onRemove={handleRemove}
        onReorder={handleReorder}
        onToggle={handleToggle}
        onUpdate={handleEdit}
        pending={subtaskActions.pending}
        subtasks={subtasks}
      />
      {task ? (
        <>
          <TaskRelationsEditor
            dependencyIds={task.dependencyIds}
            editable={editable}
            labelIds={task.labelIds}
            onVersionChange={onVersionChange}
            onReload={onReload}
            projectId={projectId}
            taskId={taskId}
            version={version}
          />
          <TaskRecurrenceEditor
            dueDate={task.dueDate}
            editable={editable}
            onVersionChange={onVersionChange}
            onReload={onReload}
            recurrence={task.recurrence}
            taskId={taskId}
            version={version}
          />
        </>
      ) : null}
    </>
  );
};
