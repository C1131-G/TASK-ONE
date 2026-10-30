/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import Link from "next/link";

// Another company's bug reads as missing, so the copy never confirms it exists.
const PortalBugNotFound = () => (
  <div className="page fullstate">
    <div className="box">
      <span className="code">404</span>
      <h1>Bug report not found</h1>
      <p>
        It may have been withdrawn, or it belongs to another company. Head back
        to your company&apos;s bugs.
      </p>
      <Link className="btn btn-primary" href="/portal">
        Company bugs
      </Link>
    </div>
  </div>
);

export default PortalBugNotFound;
