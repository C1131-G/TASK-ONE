/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { PortalNotifications } from "@/features/portal/components/portal-notifications";
import { PortalListSkeleton } from "@/features/portal/components/portal-skeletons";

export const metadata: Metadata = { title: "Notifications | Metsys" };

const Page = () => (
  <div className="page portal-narrow">
    <Suspense fallback={<PortalListSkeleton label="Loading notifications" />}>
      <PortalNotifications />
    </Suspense>
  </div>
);

export default Page;
