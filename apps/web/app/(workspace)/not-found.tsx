/* eslint-disable shadcn/no-unknown-classes -- Workspace page classes are authored in app/workspace-styles. */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found | Taskora" };

// Rendered inside the workspace shell when a detail page calls notFound().
const WorkspaceNotFound = () => (
  <div className="page fullstate">
    <div className="box">
      <span className="code">404</span>
      <h1>This page doesn&apos;t exist</h1>
      <p>
        It may have been deleted, or the link may be wrong. Check the address or
        head back to your workspace.
      </p>
      <Link className="btn btn-primary" href="/">
        Go to Home
      </Link>
    </div>
  </div>
);

export default WorkspaceNotFound;
