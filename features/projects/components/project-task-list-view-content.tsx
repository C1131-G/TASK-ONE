/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { useSelector } from "@tanstack/react-store";
import { useMemo } from "react";

import { ProjectTaskFilters } from "@/features/projects/components/project-task-filters";
import { ProjectTaskTable } from "@/features/projects/components/project-task-table";
import type { ProjectTaskViewItem } from "@/features/projects/types/project-task-view-types";
import { GlobalTaskBulkDialog } from "@/features/tasks/components/global-task-bulk-dialog";
import { TaskCreateForm } from "@/features/tasks/components/task-create-form";
import { TaskManageControls } from "@/features/tasks/components/task-manage-controls";
import { TaskStatusSelect } from "@/features/tasks/components/task-status-select";
import { TaskTableColumnMenu } from "@/features/tasks/components/task-table-column-menu";
import { serializeHiddenColumns } from "@/features/tasks/task-table-columns";
import type { EmployeeDirectoryEntry } from "@/src/server/people/user-contracts";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";
import type { LabelSummary } from "@/src/server/tasks/label-management";
import type { ProjectTaskListItem } from "@/src/server/work/work-contracts";

import { useProjectViewSearch } from "../hooks/use-project-view-search";
import { useProjectViewStore } from "../providers/project-view-store-provider";

const priorityOrder = {
  high: 1,
  low: 3,
  medium: 2,
  none: 4,
  urgent: 0,
} as const;

const TASK_STATUS_GROUPS: readonly {
  readonly status: ProjectTaskListItem["status"];
  readonly label: string;
}[] = [
  { label: "Backlog", status: "backlog" },
  { label: "To Do", status: "todo" },
  { label: "In Progress", status: "progress" },
  { label: "Review", status: "review" },
  { label: "Done", status: "done" },
];

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

  const normalizedQuery = query.trim().toLowerCase();
  const visibleTasks = tasks
    .filter((task) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        task.title.toLowerCase().includes(normalizedQuery) ||
        `${project.key}-${task.projectTaskNumber}`
          .toLowerCase()
          .includes(normalizedQuery);
      return (
        matchesQuery &&
        (status === "all" || task.status === status) &&
        (priority === "all" || task.priority === priority)
      );
    })
    .toSorted((first, second) => {
      if (sort === "name") {
        return first.title.localeCompare(second.title);
      }
      if (sort === "due") {
        return (first.dueDate ?? "9999-12-31").localeCompare(
          second.dueDate ?? "9999-12-31"
        );
      }
      if (sort === "priority") {
        return priorityOrder[first.priority] - priorityOrder[second.priority];
      }
      return 0;
    });
  const selectedTasks = visibleTasks.filter((task) =>
    selectedTaskIds.has(task.id)
  );
  const editableVisibleTasks = visibleTasks.filter((task) =>
    editableTaskIds.has(task.id)
  );
  const labelsById = new Map(labels.map((label) => [label.id, label]));
  const tableGroups =
    groupBy === "status"
      ? TASK_STATUS_GROUPS.flatMap(({ label, status: taskStatus }) => {
          const groupedTasks = visibleTasks.filter(
            (task) => task.status === taskStatus
          );
          return groupedTasks.length
            ? [{ id: taskStatus, label, tasks: groupedTasks }]
            : [];
        })
      : [{ id: "all", label: "", tasks: visibleTasks }];

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
        <div className="list-wrap project-task-list-wrap">
          <div className="tlist project-task-list">
            <div className="thead">
              <div>Task</div>
              <div>Status</div>
              <div>Priority</div>
              <div>Assignees</div>
              <div>Due date</div>
              <div>Labels</div>
              <div>Actions</div>
            </div>
            {visibleTasks.map((task) => (
              <div className="trow" key={task.id}>
                <div className="ttl">
                  <span className="mono faint">
                    {project.key}-{task.projectTaskNumber}
                  </span>
                  <span className="trunc">{task.title}</span>
                  {task.subtaskCount ? (
                    <span className="meta-mini">
                      {task.completedSubtaskCount}/{task.subtaskCount} subtasks
                    </span>
                  ) : null}
                </div>
                <div className="c-meta">
                  {editableTaskIds.has(task.id) ? (
                    <TaskStatusSelect
                      status={task.status}
                      taskId={task.id}
                      version={task.version}
                    />
                  ) : (
                    <span className={`pstatus ${task.status}`}>
                      {task.status}
                    </span>
                  )}
                </div>
                <div className="c-meta">{task.priority}</div>
                <div className="c-meta project-task-list-assignees">
                  {task.assignees.length
                    ? task.assignees.map((assignee) => assignee.name).join(", ")
                    : "Unassigned"}
                </div>
                <div className="c-meta num">{task.dueDate ?? "—"}</div>
                <div className="c-meta c-lbl project-task-list-labels">
                  {task.labelIds.flatMap((id) => {
                    const label = labelsById.get(id);
                    return label
                      ? [
                          <span className="lbl" key={label.id}>
                            {label.name}
                          </span>,
                        ]
                      : [];
                  })}
                </div>
                <div className="c-meta">
                  <TaskManageControls
                    canEdit={editableTaskIds.has(task.id)}
                    currentUserId={currentUserId}
                    employees={employees}
                    isAdmin={isAdmin}
                    task={task}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
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
