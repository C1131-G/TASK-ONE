/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  BudgetList,
  BudgetListSkeleton,
} from "@/features/projects/components/budget-list";

export const metadata: Metadata = { title: "Budgets | Metsys" };

const BudgetsPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Budgets</h1>
          <p>Hours spent and remaining on every budgeted project.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Budgets couldn't load">
        <SuspenseReveal fallback={<BudgetListSkeleton />}>
          <BudgetList />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default BudgetsPage;
