/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { useSelector } from "@tanstack/react-store";
import { useMemo } from "react";

import { ProjectTaskFilters } from "@/features/projects/components/project-task-filters";
import { ProjectTaskList } from "@/features/projects/components/project-task-list";
import { ProjectTaskTable } from "@/features/projects/components/project-task-table";
import {
  filterProjectTasks,
  groupProjectTasks,
} from "@/features/projects/project-task-filtering";
import type { ProjectTaskViewItem } from "@/features/projects/types/project-task-view-types";
import { GlobalTaskBulkDialog } from "@/features/tasks/components/global-task-bulk-dialog";
import { TaskCreateForm } from "@/features/tasks/components/task-create-form";
import { TaskTableColumnMenu } from "@/features/tasks/components/task-table-column-menu";
import { serializeHiddenColumns } from "@/features/tasks/task-table-columns";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";
import type { LabelSummary } from "@/src/server/tasks/label-management";

import { useProjectViewSearch } from "../hooks/use-project-view-search";
import { useProjectViewStore } from "../providers/project-view-store-provider";

export const ProjectTaskListViewContent = ({
  currentUserId,
  editableTaskIds,
  employees,
  isAdmin,
  labels,
  project,
  tasks,
  view,
}: {
  readonly currentUserId: string | null;
  readonly editableTaskIds: ReadonlySet<string>;
  readonly employees: readonly EmployeeDirectoryEntry[];
  readonly isAdmin: boolean;
  readonly labels: readonly LabelSummary[];
  readonly project: ProjectListItem;
  readonly tasks: readonly ProjectTaskViewItem[];
  readonly view: "list" | "table";
}) => {
  const { search, update: updateSearch } = useProjectViewSearch();
  const { group: groupBy, priority, q: query, sort, status } = search;
  const setQuery = (value: string) => updateSearch({ q: value });
  const setStatus = (value: string) => updateSearch({ status: value });
  const setPriority = (value: string) => updateSearch({ priority: value });
  const setSort = (value: string) => updateSearch({ sort: value });
  const setGroupBy = (value: string) => updateSearch({ group: value });
  const projectViewStore = useProjectViewStore();
  const selectedTaskIdList = useSelector(
    projectViewStore,
    (state) => state.selectedTaskIds
  );
  const columnWidths = useSelector(
    projectViewStore,
    (state) => state.columnWidths
  );
  const selectedTaskIds: ReadonlySet<string> = useMemo(
    () => new Set(selectedTaskIdList),
    [selectedTaskIdList]
  );

  const visibleTasks = filterProjectTasks(tasks, {
    priority,
    projectKey: project.key,
    query,
    sort,
    status,
  });
  const selectedTasks = visibleTasks.filter((task) =>
    selectedTaskIds.has(task.id)
  );
  const editableVisibleTasks = visibleTasks.filter((task) =>
    editableTaskIds.has(task.id)
  );
  const tableGroups = groupProjectTasks(visibleTasks, groupBy);

  const clearSelection = () => projectViewStore.actions.clearSelection();
  const updateFilter = (update: () => void) => {
    clearSelection();
    update();
  };
  const toggleTaskSelection = (taskId: string, selected: boolean) =>
    projectViewStore.actions.toggleTaskSelected(taskId, selected);
  const selectVisibleTasks = (selected: boolean) =>
    projectViewStore.actions.setSelectedTaskIds(
      selected ? editableVisibleTasks.map((task) => task.id) : []
    );
  const sortByColumn = (field: string) =>
    updateSearch({ sort: sort === field ? "manual" : field });

  return (
    <section className="panel">
      <div className="panel-h">
        <h2>{view === "list" ? "List" : "Table"}</h2>
        <TaskCreateForm projectId={project.id} />
      </div>
      <ProjectTaskFilters
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        onPriorityChange={(value) => updateFilter(() => setPriority(value))}
        onQueryChange={(value) => updateFilter(() => setQuery(value))}
        onSortChange={setSort}
        onStatusChange={(value) => updateFilter(() => setStatus(value))}
        priority={priority}
        projectId={project.id}
        query={query}
        showGrouping={view === "table"}
        sort={sort}
        status={status}
        taskCount={visibleTasks.length}
        taskTotal={tasks.length}
      />
      {view === "table" && selectedTasks.length ? (
        <div className="project-task-bulk-bar">
          <span className="muted">
            {selectedTasks.length} selected · Up to 100 per update
          </span>
          <GlobalTaskBulkDialog
            employees={employees}
            onSuccess={clearSelection}
            tasks={selectedTasks}
          />
        </div>
      ) : null}
      {view === "table" ? (
        <div className="project-task-table-tools">
          <TaskTableColumnMenu
            hidden={search.hidden}
            onHiddenChange={(next) =>
              updateSearch({ hidden: serializeHiddenColumns(next) })
            }
          />
        </div>
      ) : null}
      {view === "table" ? (
        <ProjectTaskTable
          activeSort={sort}
          columnWidths={columnWidths}
          currentUserId={currentUserId}
          editableTaskIds={editableTaskIds}
          employees={employees}
          groups={tableGroups}
          hiddenColumns={search.hidden}
          isAdmin={isAdmin}
          labels={labels}
          onResizeColumn={(columnId, width) =>
            projectViewStore.actions.setColumnWidth(columnId, width)
          }
          onSelectAll={selectVisibleTasks}
          onSelectTask={toggleTaskSelection}
          onSort={sortByColumn}
          projectKey={project.key}
          selectableTaskIds={
            new Set(editableVisibleTasks.map((task) => task.id))
          }
          selectedTaskIds={selectedTaskIds}
          tasks={visibleTasks}
        />
      ) : (
        <ProjectTaskList
          currentUserId={currentUserId}
          editableTaskIds={editableTaskIds}
          employees={employees}
          isAdmin={isAdmin}
          labels={labels}
          projectKey={project.key}
          tasks={visibleTasks}
        />
      )}
      {visibleTasks.length ? null : (
        <div className="panel-b muted">
          {tasks.length
            ? "No tasks match these filters."
            : "No tasks in this project yet."}
        </div>
      )}
    </section>
  );
};
