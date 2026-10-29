/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found | Taskora" };

// Rendered inside the portal shell when a bug page calls notFound().
const PortalNotFound = () => (
  <div className="page fullstate">
    <div className="box">
      <span className="code">404</span>
      <h1>We couldn&apos;t find that page</h1>
      <p>
        The bug may not belong to your company, or the link may be wrong. Head
        back to your company&apos;s bugs.
      </p>
      <Link className="btn btn-primary" href="/portal">
        Company bugs
      </Link>
    </div>
  </div>
);

export default PortalNotFound;
