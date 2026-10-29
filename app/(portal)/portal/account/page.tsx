/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import {
  PortalAccount,
  PortalAccountSkeleton,
} from "@/features/portal/components/portal-account";

export const metadata: Metadata = { title: "Account | Taskora" };

const Page = () => (
  <PageTransition>
    <div className="page portal-narrow">
      <div className="ph">
        <div>
          <h1>Account</h1>
          <p>Your details, password and notification settings.</p>
        </div>
      </div>
      <SectionErrorBoundary title="Account couldn't load">
        <SuspenseReveal fallback={<PortalAccountSkeleton />}>
          <PortalAccount />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default Page;
