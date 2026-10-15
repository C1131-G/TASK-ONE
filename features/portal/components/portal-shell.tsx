/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { PortalNav } from "@/features/portal/components/portal-nav";
import { getPortalCompany } from "@/features/portal/portal-company";
import { listPortalNotifications } from "@/features/portal/portal-queries";

const PortalCompanyName = async () => {
  const company = await getPortalCompany();
  if (!company) {
    return null;
  }
  return (
    <p className="portal-company">
      {company.logoUrl ? (
        <Image
          alt={`${company.companyName} logo`}
          className="portal-company-logo"
          height={24}
          src={company.logoUrl}
          unoptimized
          width={96}
        />
      ) : null}
      <span className="portal-company-name">
        <span className="sr-only">Signed in for </span>
        {company.companyName}
      </span>
    </p>
  );
};

const PortalPreviewBanner = async () => {
  const company = await getPortalCompany();
  if (!company?.preview) {
    return null;
  }
  return (
    <output className="portal-preview-banner">
      <p>
        <strong>
          Previewing as {company.userName} ({company.companyName}) — read only.
        </strong>{" "}
        Changes are disabled and your visit is recorded.
      </p>
      {/* A plain anchor: the exit route redirects out of the portal and must not be prefetched. */}
      {/* oxlint-disable-next-line next/no-html-link-for-pages, react-doctor/nextjs-no-a-element -- The exit route is a handler that must be a full navigation. */}
      <a className="btn btn-secondary btn-sm" href="/portal/preview?exit=1">
        Exit preview
      </a>
    </output>
  );
};

const PortalNavWithCount = async () => {
  const result = await listPortalNotifications({});
  return <PortalNav unreadCount={result.ok ? result.data.unreadCount : 0} />;
};

// The portal has its own frame: no workspace sidebar, only the client's
// company, a few links and the page. `workspace-app` supplies the design
// tokens the shared classes rely on.
const PortalShell = ({ children }: { readonly children: ReactNode }) => (
  <div className="workspace-app portal-app">
    <a className="portal-skip" href="#portal-main">
      Skip to main content
    </a>
    <header className="portal-header">
      <div className="portal-header-in">
        <Link className="portal-brand" href="/portal">
          <span aria-hidden="true" className="portal-mark">
            M
          </span>
          <span>Metsys</span>
        </Link>
        <Suspense fallback={<p className="portal-company" />}>
          <PortalCompanyName />
        </Suspense>
        <Suspense fallback={<PortalNav unreadCount={0} />}>
          <PortalNavWithCount />
        </Suspense>
      </div>
    </header>
    <Suspense fallback={null}>
      <PortalPreviewBanner />
    </Suspense>
    <main className="portal-main" id="portal-main" tabIndex={-1}>
      {children}
    </main>
  </div>
);

export { PortalShell };
