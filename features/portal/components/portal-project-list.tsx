/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { FolderOpen } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  SKELETON_KEYS,
  SkeletonBone,
} from "@/components/workspace/skeleton-shapes";
import { SkelterSurface } from "@/components/workspace/skelter-surface";
import { PortalTime } from "@/features/portal/components/portal-time";
import {
  progressPercent,
  progressText,
  projectStatusText,
  projectStatusTone,
} from "@/features/portal/portal-project-format";
import { listPortalSharedProjects } from "@/features/portal/portal-queries";
import { readOrThrow } from "@/lib/read-result";

const PortalProjectList = async () => {
  const projects = readOrThrow(await listPortalSharedProjects({}), "Projects");
  if (projects.length === 0) {
    return (
      <div className="panel empty-state">
        <span aria-hidden="true" className="glyph">
          <FolderOpen size={22} />
        </span>
        <h2 className="es-h">No projects shared yet</h2>
        <p>
          When the team shares a project with your company, its progress and
          milestones show up here.
        </p>
      </div>
    );
  }
  return (
    <ul aria-label="Shared projects" className="portal-bug-list">
      {projects.map((project) => (
        <li key={project.id}>
          <Link
            className="portal-bug-card"
            href={`/portal/projects/${project.id}`}
            transitionTypes={["nav-forward"]}
          >
            <span className="portal-bug-top">
              <span className="portal-bug-key">{project.key}</span>
              <span className={`badge ${projectStatusTone[project.status]}`}>
                <span aria-hidden="true" className="dot" />
                {projectStatusText[project.status]}
              </span>
            </span>
            <strong className="portal-bug-title">{project.name}</strong>
            {project.description ? (
              <span className="portal-bug-meta">{project.description}</span>
            ) : null}
            <span className="row">
              <span
                aria-hidden="true"
                className="prog"
                style={
                  {
                    "--p": progressPercent(project.progress) / 100,
                  } as CSSProperties
                }
              >
                <i />
              </span>
              <span className="faint">{progressText(project.progress)}</span>
            </span>
            <span className="portal-bug-meta">
              {project.nextMilestone ? (
                <span>
                  Next milestone: {project.nextMilestone.name}
                  {project.nextMilestone.dueDate ? (
                    <>
                      {" "}
                      <PortalTime
                        iso={project.nextMilestone.dueDate}
                        variant="date"
                      />
                    </>
                  ) : null}
                </span>
              ) : null}
              {project.dueDate ? (
                <span>
                  Due <PortalTime iso={project.dueDate} variant="date" />
                </span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};

const PortalProjectListSkeleton = () => (
  <SkelterSurface label="Loading projects">
    <ul className="portal-bug-list">
      {SKELETON_KEYS.slice(0, 3).map((key) => (
        <li key={key}>
          <div className="portal-bug-card">
            <div className="portal-bug-top">
              <SkeletonBone shape="short" />
              <SkeletonBone shape="short" />
            </div>
            <SkeletonBone shape="title" />
            <div className="portal-bug-meta">
              <SkeletonBone />
              <SkeletonBone shape="short" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  </SkelterSurface>
);

export { PortalProjectList, PortalProjectListSkeleton };
