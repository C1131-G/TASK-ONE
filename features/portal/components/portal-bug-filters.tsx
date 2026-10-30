"use client";

/* eslint-disable shadcn/no-restyle -- Preserve established portal classes on shared controls. */

/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { useRouter } from "next/navigation";

import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import type { ClientStatusLabel } from "@/features/portal/client-status";
import {
  clientStatusLabels,
  clientStatusText,
} from "@/features/portal/client-status";

// A GET form keeps each applied filter shareable and bookmarkable.
const PortalBugFilters = ({
  mine,
  projectId,
  projects,
  status,
}: {
  readonly mine: boolean;
  readonly projectId: string | undefined;
  readonly projects: readonly { readonly id: string; readonly name: string }[];
  readonly status: ClientStatusLabel | undefined;
}) => {
  const router = useRouter();
  const updateFilter = (key: "mine" | "project" | "status", value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `/portal?${query}` : "/portal", {
      scroll: false,
    });
  };

  return (
    <fieldset className="panel portal-filters">
      <legend className="sr-only">Filter company bugs</legend>
      <div className="field">
        <label className="label" htmlFor="portal-filter-status">
          Status
        </label>
        <WorkspaceSelect
          className="select"
          id="portal-filter-status"
          onValueChange={(value) => updateFilter("status", value)}
          value={status ?? ""}
        >
          <WorkspaceSelectItem value="">All statuses</WorkspaceSelectItem>
          {clientStatusLabels.map((label) => (
            <WorkspaceSelectItem key={label} value={label}>
              {clientStatusText[label]}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      </div>
      <div className="field">
        <label className="label" htmlFor="portal-filter-project">
          Project
        </label>
        <WorkspaceSelect
          className="select"
          id="portal-filter-project"
          onValueChange={(value) => updateFilter("project", value)}
          value={projectId ?? ""}
        >
          <WorkspaceSelectItem value="">All projects</WorkspaceSelectItem>
          {projects.map((project) => (
            <WorkspaceSelectItem key={project.id} value={project.id}>
              {project.name}
            </WorkspaceSelectItem>
          ))}
        </WorkspaceSelect>
      </div>
      <label className="portal-check" htmlFor="portal-filter-mine">
        <input
          checked={mine}
          id="portal-filter-mine"
          onChange={(event) =>
            updateFilter("mine", event.currentTarget.checked ? "1" : "")
          }
          type="checkbox"
          value="1"
        />
        <span>Only my reports</span>
      </label>
    </fieldset>
  );
};

export { PortalBugFilters };
