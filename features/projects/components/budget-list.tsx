/* eslint-disable shadcn/no-unknown-classes */

import Link from "next/link";

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import {
  formatMoney,
  levelLabel,
  periodLabel,
} from "@/features/projects/budget-format";
import { listProjectBudgets } from "@/features/projects/projects-queries";
import { formatMinutes } from "@/features/time/time-format";
import { readOrThrow } from "@/lib/read-result";

// Every project with an hours budget: spent, remaining and percent. Admins only.
const BudgetList = async () => {
  const result = await listProjectBudgets({});
  if (!result.ok && result.error.code === "FORBIDDEN") {
    return (
      <section className="panel panel-b">
        <output className="muted">Only administrators can see budgets.</output>
      </section>
    );
  }
  const budgets = readOrThrow(result, "Budgets");
  if (budgets.length === 0) {
    return (
      <section className="panel panel-b">
        <p className="muted">
          No project has an hours budget yet. Set one from a project overview.
        </p>
      </section>
    );
  }
  return (
    <div className="tbl-wrap">
      <table className="tbl time-table">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col">Type</th>
            <th scope="col">Spent</th>
            <th scope="col">Remaining</th>
            <th scope="col">Used</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((budget) => (
            <tr key={budget.projectId}>
              <td>
                <Link href={`/projects/${budget.projectId}/time`}>
                  <strong>{budget.projectKey}</strong> {budget.projectName}
                </Link>
              </td>
              <td>
                {budget.kind === "retainer"
                  ? `Retainer, ${periodLabel(budget.period.key)}`
                  : "One-off"}
              </td>
              <td>
                {formatMinutes(budget.spentMinutes)} of{" "}
                {formatMinutes(budget.budgetMinutes)}
                {budget.spentAmountCents !== null &&
                budget.budgetAmountCents !== null ? (
                  <span className="muted">
                    {" "}
                    ({formatMoney(budget.spentAmountCents, budget.currency)})
                  </span>
                ) : null}
              </td>
              <td>
                {budget.remainingMinutes < 0
                  ? `Over by ${formatMinutes(-budget.remainingMinutes)}`
                  : formatMinutes(budget.remainingMinutes)}
              </td>
              <td>{budget.percent}%</td>
              <td>{levelLabel(budget.level)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const BudgetListSkeleton = () => (
  <PanelSkeleton label="Loading budgets…" rows={4} variant="list" />
);

export { BudgetList, BudgetListSkeleton };
