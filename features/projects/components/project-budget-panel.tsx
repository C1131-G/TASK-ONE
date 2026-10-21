/* eslint-disable shadcn/no-unknown-classes */

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { BudgetBurn } from "@/features/projects/components/budget-burn";
import { ProjectBudgetEditor } from "@/features/projects/components/project-budget-editor";
import { getProjectBudget } from "@/features/projects/projects-queries";
import { readOrThrow } from "@/lib/read-result";

// The hours budget and its burn for one project. People who may not see it
// (clients, employees outside the project) get nothing, not an error.
const ProjectBudgetPanel = async ({
  editable,
  projectId,
}: {
  readonly editable: boolean;
  readonly projectId: string;
}) => {
  const result = await getProjectBudget({ projectId });
  if (!result.ok && result.error.code === "FORBIDDEN") {
    return null;
  }
  const budget = readOrThrow(result, "The budget");
  if (!budget && !editable) {
    return null;
  }
  return (
    <section aria-labelledby={`budget-${projectId}-heading`} className="panel">
      <div className="panel-h">
        <h2 id={`budget-${projectId}-heading`}>Budget</h2>
        {editable ? (
          <ProjectBudgetEditor budget={budget} projectId={projectId} />
        ) : null}
      </div>
      {budget ? (
        <BudgetBurn budget={budget} />
      ) : (
        <p className="muted">No hours budget has been set for this project.</p>
      )}
    </section>
  );
};

const ProjectBudgetPanelSkeleton = () => (
  <PanelSkeleton label="Loading the budget…" rows={2} variant="list" />
);

export { ProjectBudgetPanel, ProjectBudgetPanelSkeleton };
