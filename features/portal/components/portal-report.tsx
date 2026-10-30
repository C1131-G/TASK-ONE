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
  getPortalBugById,
  getPortalResponseTimes,
  listPortalProjects,
} from "@/features/portal/portal-queries";
import type {
  PortalBugDetail,
  PortalProject,
  PortalResponseTimes,
} from "@/src/server/portal/portal-contracts";

// The closed bug being reported again, or null for a missing or not-closed
// `from` value (already UUID-checked by parsePortalReportFrom).
const loadRecurrence = async (
  from: string | undefined,
  projectsPromise: Promise<readonly PortalProject[] | null>
): Promise<PortalBugDetail | null> => {
  if (!from) {
    return null;
  }
  const [result, projects] = await Promise.all([
    getPortalBugById(from),
    projectsPromise,
  ]);
  if (
    !projects ||
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
          Your company has no active projects to report bugs on. Ask your
          Taskora contact to set one up.
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
      <section
        aria-label="Bug report"
        className="panel portal-panel portal-report-panel"
      >
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
      <p className="portal-banner" role="note">
        Reporting is disabled in preview.
      </p>
    );
  }
  // The recurrence lookup only needs `from`, so it runs alongside the rest.
  const projectsPromise = listPortalProjects({});
  const [result, times, recurrenceOf] = await Promise.all([
    projectsPromise,
    getPortalResponseTimes({}),
    loadRecurrence(
      from,
      // oxlint-disable-next-line promise/prefer-await-to-then -- Shares the in-flight projects request instead of awaiting it first.
      projectsPromise.then((projects) => (projects.ok ? projects.data : null))
    ),
  ]);
  if (!result.ok) {
    throw new Error("Projects could not be loaded.");
  }
  return (
    <PortalReportBody
      projects={result.data}
      recurrenceOf={recurrenceOf}
      responseTimes={times.ok ? times.data : null}
    />
  );
};

const PortalFormSkeleton = ({
  label = "Loading bug form",
}: {
  readonly label?: string;
}) => (
  <SkelterSurface label={label}>
    <div className="panel portal-panel portal-report-panel">
      <div className="portal-form portal-wizard">
        <div aria-hidden="true" className="portal-wizard-progress">
          {SKELETON_KEYS.slice(0, 4).map((key) => (
            <SkeletonBone key={key} shape="short" />
          ))}
        </div>
        <div className="portal-wizard-summary skeleton-copy">
          {SKELETON_KEYS.slice(0, 3).map((key, index) => (
            <div className="field" key={key}>
              <SkeletonBone shape="short" />
              <SkeletonBone shape={index === 2 ? "block" : "control"} />
            </div>
          ))}
        </div>
        <SkeletonBone shape="control" />
      </div>
    </div>
  </SkelterSurface>
);

export { PortalReport, PortalFormSkeleton };
