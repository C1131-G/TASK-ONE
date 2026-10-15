/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import { Suspense } from "react";

import { PortalAccount } from "@/features/portal/components/portal-account";
import { PortalListSkeleton } from "@/features/portal/components/portal-skeletons";

export const metadata: Metadata = { title: "Account | Metsys" };

const Page = () => (
  <div className="page portal-narrow">
    <Suspense fallback={<PortalListSkeleton label="Loading account" />}>
      <PortalAccount />
    </Suspense>
  </div>
);

export default Page;
