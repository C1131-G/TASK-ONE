/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import Link from "next/link";

// A project the company cannot see reads as missing, so the copy never
// confirms it exists.
const PortalProjectNotFound = () => (
  <div className="page fullstate">
    <div className="box">
      <span className="code">404</span>
      <h1>Project not found</h1>
      <p>
        It may no longer be shared with your company. Head back to your
        projects.
      </p>
      <Link className="btn btn-primary" href="/portal/projects">
        Projects
      </Link>
    </div>
  </div>
);

export default PortalProjectNotFound;
