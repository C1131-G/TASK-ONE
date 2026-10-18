/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import {
  ClientCompanyList,
  ClientCompanyListSkeleton,
} from "@/features/clients/components/client-company-list";

export const metadata: Metadata = { title: "Clients | Metsys" };

const ClientsPage = () => (
  <div className="page">
    <SectionErrorBoundary title="clients could not be loaded">
      <Suspense fallback={<ClientCompanyListSkeleton />}>
        <ClientCompanyList />
      </Suspense>
    </SectionErrorBoundary>
  </div>
);

export default ClientsPage;
