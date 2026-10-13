/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";

export interface TaskEmployeeOption {
  readonly id: string;
  readonly name: string;
}

export const TaskAssigneesFieldset = ({
  employees,
  editable,
  search,
  selectedIds,
  onSearchChange,
  onToggle,
  taskId,
}: {
  readonly employees: readonly TaskEmployeeOption[];
  readonly editable: boolean;
  readonly search: string;
  readonly selectedIds: readonly string[];
  readonly onSearchChange: (value: string) => void;
  readonly onToggle: (employeeId: string, checked: boolean) => void;
  readonly taskId: string;
}) => {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleEmployees = employees.filter((employee) =>
    employee.name.toLocaleLowerCase().includes(normalizedSearch)
  );
  const assigneeSet = new Set(selectedIds);
  const fieldId = (name: string) => `task-${taskId}-${name}`;

  return (
    <fieldset className="field">
      <legend>Assignees</legend>
      <label className="field" htmlFor={fieldId("assignee-search")}>
        <span className="sr-only">Search employees</span>
        <WorkspaceInput
          autoComplete="off"
          className="input"
          id={fieldId("assignee-search")}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
          placeholder="Search employees"
          type="search"
          value={search}
        />
      </label>
      {visibleEmployees.map((employee) => (
        <label
          className="row"
          htmlFor={fieldId(`employee-${employee.id}`)}
          key={employee.id}
        >
          <Checkbox
            checked={assigneeSet.has(employee.id)}
            disabled={!editable}
            id={fieldId(`employee-${employee.id}`)}
            onCheckedChange={(checked) =>
              onToggle(employee.id, checked === true)
            }
          />
          <span>{employee.name}</span>
        </label>
      ))}
    </fieldset>
  );
};
