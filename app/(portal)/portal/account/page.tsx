/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  PortalAccount,
  PortalAccountSkeleton,
} from "@/features/portal/components/portal-account";

export const metadata: Metadata = { title: "Account | Metsys" };

const Page = () => (
  <div className="page portal-narrow">
    <SectionErrorBoundary title="account could not be loaded">
      <Suspense fallback={<PortalAccountSkeleton />}>
        <PortalAccount />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default Page;
