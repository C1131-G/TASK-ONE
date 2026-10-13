/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useSelector } from "@tanstack/react-store";
import { useMemo } from "react";
import type { ReactNode } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { MAX_BULK_SELECTION } from "@/features/projects/providers/project-view-store";
import { GlobalTaskBoard } from "@/features/tasks/components/global-task-board";
import { GlobalTaskBulkDialog } from "@/features/tasks/components/global-task-bulk-dialog";
import {
  GlobalTaskList,
  GlobalTaskTable,
} from "@/features/tasks/components/global-task-row-views";
import { TaskTableColumnMenu } from "@/features/tasks/components/task-table-column-menu";
import {
  GLOBAL_TASK_VIEWS,
  serializeGlobalTaskHidden,
} from "@/features/tasks/global-task-view-state";
import { useGlobalTaskView } from "@/features/tasks/hooks/use-global-task-view";
import { useGlobalTaskViewStore } from "@/features/tasks/providers/global-task-view-store-provider";
import { GLOBAL_HIDEABLE_COLUMNS } from "@/features/tasks/task-table-columns";
import type {
  GlobalTaskRowsProps,
  GlobalTaskViewProps,
} from "@/features/tasks/types/global-task-row-contracts";

export const GlobalTaskRows = (props: GlobalTaskRowsProps) => {
  const store = useGlobalTaskViewStore();
  const { search, update } = useGlobalTaskView(GLOBAL_TASK_VIEWS);
  const selectedTaskIdList = useSelector(
    store,
    (state) => state.selectedTaskIds
  );
  const columnWidths = useSelector(store, (state) => state.columnWidths);
  const selectedIds: ReadonlySet<string> = useMemo(
    () => new Set(selectedTaskIdList),
    [selectedTaskIdList]
  );
  const tasks = props.taskGroups.flatMap((group) => group.tasks);
  const selectedTasks = tasks.filter((task) => selectedIds.has(task.id));
  const selectionLimitReached = selectedTasks.length >= MAX_BULK_SELECTION;

  const onToggle = (taskId: string, checked: boolean) =>
    store.actions.toggleTaskSelected(taskId, checked);
  const selectAll = (checked: boolean) =>
    store.actions.setSelectedTaskIds(
      checked ? tasks.map((task) => task.id) : []
    );
  const sortByColumn = (field: string) =>
    update({ sort: search.sort === field ? "due" : field });

  const viewProps: GlobalTaskViewProps = { ...props, onToggle, selectedIds };
  let content: ReactNode;
  if (props.view === "board") {
    content = (
      <GlobalTaskBoard
        employees={props.employees}
        favoriteTaskIds={props.favoriteTaskIds}
        isAdmin={props.isAdmin}
        onToggle={onToggle}
        selectedIds={selectedIds}
        taskGroups={props.taskGroups}
        userId={props.userId}
      />
    );
  } else if (props.view === "table") {
    content = (
      <GlobalTaskTable
        activeSort={search.sort}
        columnWidths={columnWidths}
        hidden={search.hidden}
        onResize={(columnId, width) =>
          store.actions.setColumnWidth(columnId, width)
        }
        onSort={sortByColumn}
        props={viewProps}
      />
    );
  } else {
    content = <GlobalTaskList {...viewProps} />;
  }

  return (
    <>
      <div className="row global-task-selection-bar">
        <label className="row" htmlFor="global-task-select-all">
          <Checkbox
            checked={
              tasks.length > 0 &&
              tasks.every((task) => selectedIds.has(task.id))
            }
            id="global-task-select-all"
            onCheckedChange={(checked) => selectAll(checked === true)}
          />
          {tasks.length > MAX_BULK_SELECTION
            ? `Select first ${MAX_BULK_SELECTION} tasks`
            : "Select all tasks"}
        </label>
        <span aria-live="polite" className="muted">
          {selectedTasks.length} selected
          {selectionLimitReached ? " (maximum)" : ""}
        </span>
        {selectedTasks.length > 0 ? (
          <GlobalTaskBulkDialog
            employees={props.employees}
            onSuccess={() => store.actions.clearSelection()}
            tasks={selectedTasks}
          />
        ) : null}
        {props.view === "table" ? (
          <TaskTableColumnMenu
            columns={GLOBAL_HIDEABLE_COLUMNS}
            hidden={search.hidden}
            onHiddenChange={(next) =>
              update({ hidden: serializeGlobalTaskHidden(next) })
            }
          />
        ) : null}
      </div>
      {content}
    </>
  );
};
