/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import Link from "next/link";

// A request the company cannot see reads as missing, so the copy never
// confirms it exists.
const PortalApprovalNotFound = () => (
  <div className="page fullstate">
    <div className="box">
      <span className="code">404</span>
      <h1>Approval not found</h1>
      <p>
        It may have been withdrawn or is no longer shared with your company.
        Head back to your approvals.
      </p>
      <Link className="btn btn-primary" href="/portal/approvals">
        Approvals
      </Link>
    </div>
  </div>
);

export default PortalApprovalNotFound;
