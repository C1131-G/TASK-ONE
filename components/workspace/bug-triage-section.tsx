/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { triageBugAction } from "@/app/actions/bugs";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { BugHistory, BugSubmit } from "./bug-workflow-ui-shared";

export const BugTriageSection = ({
  employees,
  history,
  isAdmin,
  pending,
  submit,
}: {
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly history: BugHistory;
  readonly isAdmin: boolean;
  readonly pending: boolean;
  readonly submit: BugSubmit;
}) => {
  if (
    !isAdmin ||
    history.archived ||
    !["reported", "triaged"].includes(history.bug.status)
  ) {
    return null;
  }
  const assignedUserIds = new Set(history.assignees.map(({ id }) => id));
  return (
    <section className="panel panel-b bug-detail-section">
      <h2>Triage and assignment</h2>
      <form
        className="bug-inline-form"
        onSubmit={(event) =>
          submit(event, (data) =>
            triageBugAction({
              assigneeIds: data.getAll("assigneeIds").map(String),
              bugId: history.bug.id,
              expectedVersion: history.bug.version,
              priority: String(data.get("priority") ?? "none"),
              severity: String(data.get("severity") ?? "major"),
            })
          )
        }
      >
        <div className="bug-detail-facts">
          <div className="bug-form-field">
            <Label htmlFor="triage-severity">Severity</Label>
            <Select defaultValue={history.bug.severity} name="severity">
              <SelectTrigger id="triage-severity">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="blocker">Blocker</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="major">Major</SelectItem>
                <SelectItem value="minor">Minor</SelectItem>
                <SelectItem value="trivial">Trivial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="bug-form-field">
            <Label htmlFor="triage-priority">Priority</Label>
            <Select defaultValue={history.priority} name="priority">
              <SelectTrigger id="triage-priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <fieldset className="bug-employee-picker">
          <legend>Assign employees</legend>
          {employees.map((employee) => (
            <label className="bug-employee-option" key={employee.id}>
              <Checkbox
                defaultChecked={assignedUserIds.has(employee.id)}
                name="assigneeIds"
                value={employee.id}
              />
              <span>{employee.name}</span>
            </label>
          ))}
        </fieldset>
        <Button disabled={pending} type="submit">
          Save triage
        </Button>
      </form>
    </section>
  );
};
