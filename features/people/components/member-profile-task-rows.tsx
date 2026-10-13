/* eslint-disable shadcn/no-unknown-classes */

import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";

import { Badge } from "@/components/ui/badge";
import { MemberProfileTaskDetails } from "@/features/people/components/member-profile-task-details";
import type { ProjectTaskListItemSchema } from "@/src/server/work/work-contracts";

type ProjectTask = typeof ProjectTaskListItemSchema.Type;

export type MemberTask = ProjectTask & {
  readonly projectKey: string;
  readonly projectName: string;
};

const formatTaskStatus = (status: MemberTask["status"]): string => {
  switch (status) {
    case "backlog": {
      return "Backlog";
    }
    case "done": {
      return "Done";
    }
    case "progress": {
      return "In Progress";
    }
    case "review": {
      return "Review";
    }
    case "todo": {
      return "To Do";
    }
    default: {
      return status;
    }
  }
};

const MemberTaskRows = ({
  employees,
  isAdmin,
  viewerId,
  tasks,
}: {
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
  readonly viewerId: string | null;
  readonly tasks: readonly MemberTask[];
}) =>
  tasks.length ? (
    <ul className="member-profile-task-list">
      {tasks.map((task) => (
        <li className="member-profile-task" key={task.id}>
          <span
            aria-hidden="true"
            className={`project-status-dot ${task.status}`}
          />
          <div className="member-profile-task-copy">
            <MemberProfileTaskDetails
              employees={employees}
              isAdmin={isAdmin}
              task={task}
              viewerId={viewerId}
            />
            <span>
              {task.projectKey}-{task.projectTaskNumber} · {task.projectName}
            </span>
          </div>
          <span className="member-profile-task-meta">
            {task.dueDate ? (
              <time dateTime={task.dueDate}>
                <CalendarBlank aria-hidden="true" size={14} />
                {task.dueDate}
              </time>
            ) : null}
            <Badge variant="outline">{formatTaskStatus(task.status)}</Badge>
          </span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="panel-b faint member-profile-empty">No tasks here</p>
  );

export { MemberTaskRows };
