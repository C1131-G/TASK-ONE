/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Suspense } from "react";

import { PortalNavLinks } from "@/features/portal/components/portal-nav";
import { getPortalApprovalCount } from "@/features/portal/portal-approval-queries";
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

const PortalUnreadBadge = async () => {
  const result = await listPortalNotifications({});
  const unreadCount = result.ok ? result.data.unreadCount : 0;
  if (unreadCount === 0) {
    return null;
  }
  return (
    <span className="portal-nav-badge">
      <span aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>
      <span className="sr-only">{unreadCount} unread</span>
    </span>
  );
};

const PortalApprovalBadge = async () => {
  const result = await getPortalApprovalCount({});
  const waiting = result.ok ? result.data : 0;
  if (waiting === 0) {
    return null;
  }
  return (
    <span className="portal-nav-badge">
      <span aria-hidden="true">{waiting > 99 ? "99+" : waiting}</span>
      <span className="sr-only">{waiting} waiting for review</span>
    </span>
  );
};

const approvalBadge = (
  <Suspense fallback={null}>
    <PortalApprovalBadge />
  </Suspense>
);

// The fallback and the nav both carry the badge, so the count shows whether
// or not the URL has been read yet.
const unreadBadge = (
  <Suspense fallback={null}>
    <PortalUnreadBadge />
  </Suspense>
);

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
        <PortalNavLinks
          approvalBadge={approvalBadge}
          notificationBadge={unreadBadge}
        />
      </div>
    </header>
    <Suspense
      fallback={<div aria-hidden="true" className="portal-preview-slot" />}
    >
      <PortalPreviewBanner />
    </Suspense>
    <main className="portal-main" id="portal-main" tabIndex={-1}>
      {children}
    </main>
  </div>
);

export { PortalShell };
