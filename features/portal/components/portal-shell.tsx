/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

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
      <span className="sr-only">Signed in for </span>
      {company.companyName}
    </p>
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
    <main className="portal-main" id="portal-main" tabIndex={-1}>
      {children}
    </main>
  </div>
);

export { PortalShell };
