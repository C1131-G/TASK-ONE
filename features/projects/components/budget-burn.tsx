/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles -- The bar width and threshold marker are data. */

import {
  barWidth,
  formatMoney,
  levelLabel,
  periodLabel,
} from "@/features/projects/budget-format";
import { formatMinutes } from "@/features/time/time-format";
import type { ProjectBudgetView } from "@/src/server/budgets/project-budgets";

// Spent against the budget as a bar and plain numbers. The level is written
// out as well as coloured.
const BudgetBurn = ({ budget }: { readonly budget: ProjectBudgetView }) => (
  <div className="budget-burn" data-level={budget.level}>
    <div className="budget-burn-head">
      <strong>
        {formatMinutes(budget.spentMinutes)} of{" "}
        {formatMinutes(budget.budgetMinutes)}
      </strong>
      <span className="budget-level">{levelLabel(budget.level)}</span>
    </div>
    <div className="budget-track">
      <progress
        aria-label="Budget used"
        aria-valuetext={`${budget.percent}% used`}
        className="budget-progress"
        max={100}
        value={barWidth(budget.percent)}
      />
      <span
        aria-hidden="true"
        className="budget-threshold"
        style={{ left: `${budget.warningPercent}%` }}
      />
    </div>
    <dl className="budget-numbers">
      <div>
        <dt>Used</dt>
        <dd>{budget.percent}%</dd>
      </div>
      <div>
        <dt>{budget.remainingMinutes < 0 ? "Over by" : "Remaining"}</dt>
        <dd>{formatMinutes(Math.abs(budget.remainingMinutes))}</dd>
      </div>
      <div>
        <dt>Period</dt>
        <dd>
          {budget.kind === "retainer"
            ? periodLabel(budget.period.key)
            : "All time"}
        </dd>
      </div>
      {budget.spentAmountCents !== null && budget.budgetAmountCents !== null ? (
        <div>
          <dt>Value</dt>
          <dd>
            {formatMoney(budget.spentAmountCents, budget.currency)} of{" "}
            {formatMoney(budget.budgetAmountCents, budget.currency)}
          </dd>
        </div>
      ) : null}
    </dl>
    {budget.billableOnly ? (
      <p className="muted budget-note">Counts billable time only.</p>
    ) : null}
  </div>
);

export { BudgetBurn };
