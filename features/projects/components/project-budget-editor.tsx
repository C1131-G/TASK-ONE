/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import { ProjectBudgetForm } from "@/features/projects/components/project-budget-form";
import type { ProjectBudgetView } from "@/src/server/budgets/project-budgets";

// The administrator's way in to set, change or remove a budget.
export const ProjectBudgetEditor = ({
  budget,
  projectId,
}: {
  readonly budget: ProjectBudgetView | null;
  readonly projectId: string;
}) => (
  <WorkspaceDisclosure
    description="Hours the project may use, how it renews, and when to warn."
    title={budget ? "Edit budget" : "Set a budget"}
    trigger={
      <WorkspaceButton className="btn btn-secondary btn-sm" type="button">
        {budget ? "Edit budget" : "Set a budget"}
      </WorkspaceButton>
    }
  >
    {(close) => (
      <ProjectBudgetForm
        budget={budget}
        idPrefix={`budget-${projectId}`}
        onDone={close}
        projectId={projectId}
      />
    )}
  </WorkspaceDisclosure>
);
