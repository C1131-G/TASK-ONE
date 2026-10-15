/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import { Suspense } from "react";

import {
  ClientCompanyList,
  ClientCompanyListSkeleton,
} from "@/features/clients/components/client-company-list";

export const metadata: Metadata = { title: "Clients | Metsys" };

const ClientsPage = () => (
  <div className="page">
    <Suspense fallback={<ClientCompanyListSkeleton />}>
      <ClientCompanyList />
    </Suspense>
  </div>
);

export default ClientsPage;
