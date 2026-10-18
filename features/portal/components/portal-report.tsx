/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { FolderSimple } from "@phosphor-icons/react/dist/ssr";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { PortalBugForm } from "@/features/portal/components/portal-bug-form";
import { getPortalCompany } from "@/features/portal/portal-company";
import {
  getPortalBug,
  getPortalResponseTimes,
  listPortalProjects,
} from "@/features/portal/portal-queries";
import type {
  PortalBugDetail,
  PortalProject,
  PortalResponseTimes,
} from "@/src/server/portal/portal-contracts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// The closed bug being reported again, or null for a missing, invalid or
// not-closed `from` value.
const loadRecurrence = async (
  from: string | undefined,
  projects: readonly PortalProject[]
): Promise<PortalBugDetail | null> => {
  if (!from || !UUID_PATTERN.test(from)) {
    return null;
  }
  const result = await getPortalBug({ bugId: from });
  if (
    !result.ok ||
    !result.data.lifecycle.canReportAgain ||
    !projects.some(({ id }) => id === result.data.projectId)
  ) {
    return null;
  }
  return result.data;
};

const PortalReportBody = ({
  projects,
  recurrenceOf,
  responseTimes,
}: {
  readonly projects: readonly PortalProject[];
  readonly recurrenceOf: PortalBugDetail | null;
  readonly responseTimes: PortalResponseTimes | null;
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
    <>
      {recurrenceOf ? (
        <output className="portal-notice">
          Reporting again: <strong>{recurrenceOf.key}</strong>{" "}
          {recurrenceOf.title}
        </output>
      ) : null}
      <section aria-label="Bug report" className="panel portal-panel">
        <PortalBugForm
          mode={{
            kind: "create",
            projects,
            responseTimes,
            ...(recurrenceOf ? { recurrenceOf } : {}),
          }}
        />
      </section>
    </>
  );
};

const PortalReport = async ({
  from,
}: {
  readonly from: string | undefined;
}) => {
  const company = await getPortalCompany();
  if (company?.preview) {
    return (
      <>
        <div className="ph">
          <div>
            <h1>Report a bug</h1>
          </div>
        </div>
        <p className="portal-banner" role="note">
          Reporting is disabled in preview.
        </p>
      </>
    );
  }
  const [result, times] = await Promise.all([
    listPortalProjects({}),
    getPortalResponseTimes({}),
  ]);
  const recurrenceOf = result.ok
    ? await loadRecurrence(from, result.data)
    : null;
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
        <PortalReportBody
          projects={result.data}
          recurrenceOf={recurrenceOf}
          responseTimes={times.ok ? times.data : null}
        />
      ) : (
        <div className="panel portal-alert" role="alert">
          Projects could not be loaded. Refresh to try again.
        </div>
      )}
    </>
  );
};

const PortalFormSkeleton = ({
  label = "Loading bug form",
}: {
  readonly label?: string;
}) => (
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
    <SkelterSurface label={label}>
      <div className="panel portal-panel">
        <div className="portal-form">
          {SKELETON_KEYS.slice(0, 7).map((key) => (
            <div className="field skeleton-copy" key={key}>
              <SkeletonBone shape="short" />
              <SkeletonBone
                shape={
                  key === "bone-2" || key === "bone-4" ? "block" : "control"
                }
              />
            </div>
          ))}
          <SkeletonBone shape="control" />
        </div>
      </div>
    </SkelterSurface>
  </>
);

export { PortalReport, PortalFormSkeleton };
