/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { PortalNotifications } from "@/features/portal/components/portal-notifications";
import { PortalNotificationsSkeleton } from "@/features/portal/components/portal-skeletons";

export const metadata: Metadata = { title: "Notifications | Metsys" };

const Page = () => (
  <div className="page portal-narrow">
    <SectionErrorBoundary title="notifications could not be loaded">
      <Suspense fallback={<PortalNotificationsSkeleton />}>
        <PortalNotifications />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default Page;
