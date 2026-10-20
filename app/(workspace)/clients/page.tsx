/* eslint-disable shadcn/no-unknown-classes */

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageTransition } from "@/components/ui/page-transition";
import { SectionErrorBoundary } from "@/components/ui/section-error-boundary";
import { SuspenseReveal } from "@/components/ui/suspense-reveal";
import { SkeletonBone } from "@/components/workspace/skeleton-shapes";
import { ClientCompanyCreateForm } from "@/features/clients/components/client-company-forms";
import {
  ClientCompanyCount,
  ClientCompanyList,
  ClientCompanyListSkeleton,
} from "@/features/clients/components/client-company-list";

export const metadata: Metadata = { title: "Clients | Metsys" };

const ClientsPage = () => (
  <PageTransition>
    <div className="page">
      <div className="ph">
        <div>
          <h1>Clients</h1>
          <p>
            <Suspense
              fallback={
                <span aria-hidden="true">
                  <SkeletonBone />
                </span>
              }
            >
              <ClientCompanyCount />
            </Suspense>
          </p>
        </div>
        <div className="acts">
          <Link className="btn btn-secondary btn-sm" href="/clients/audit">
            Audit log
          </Link>
          <ClientCompanyCreateForm />
        </div>
      </div>
      <SectionErrorBoundary title="Clients couldn't load">
        <SuspenseReveal fallback={<ClientCompanyListSkeleton />}>
          <ClientCompanyList />
        </SuspenseReveal>
      </SectionErrorBoundary>
    </div>
  </PageTransition>
);

export default ClientsPage;
