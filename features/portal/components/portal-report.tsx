/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { FolderSimple } from "@phosphor-icons/react/dist/ssr";

import { PortalBugForm } from "@/features/portal/components/portal-bug-form";
import { listPortalProjects } from "@/features/portal/portal-queries";
import type { PortalProject } from "@/src/server/portal/portal-contracts";

const PortalReportBody = ({
  projects,
}: {
  readonly projects: readonly PortalProject[];
}) => {
  if (projects.length === 0) {
    return (
      <div className="panel empty-state">
        <span aria-hidden="true" className="glyph">
          <FolderSimple size={22} />
        </span>
        <h2 className="es-h">No active projects yet</h2>
        <p>
          Your company has no active projects to report bugs on. Ask your Metsys
          contact to set one up.
        </p>
      </div>
    );
  }
  return (
    <section aria-label="Bug report" className="panel portal-panel">
      <PortalBugForm mode={{ kind: "create", projects }} />
    </section>
  );
};

const PortalReport = async () => {
  const result = await listPortalProjects({});
  return (
    <>
      <div className="ph">
        <div>
          <h1>Report a bug</h1>
          <p>
            Tell us what went wrong. The more detail you give, the faster we can
            fix it.
          </p>
        </div>
      </div>
      {result.ok ? (
        <PortalReportBody projects={result.data} />
      ) : (
        <div className="panel portal-alert" role="alert">
          Projects could not be loaded. Refresh to try again.
        </div>
      )}
    </>
  );
};

export { PortalReport };
