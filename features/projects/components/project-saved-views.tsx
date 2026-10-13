/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { Plus, X } from "@phosphor-icons/react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceDisclosure } from "@/components/workspace/workspace-disclosure";
import {
  WorkspaceSelect,
  WorkspaceSelectItem,
} from "@/components/workspace/workspace-select";
import {
  createSavedViewAction,
  deleteSavedViewAction,
  updateSavedViewAction,
} from "@/features/projects/projects-actions";
import type { SavedViewSummary } from "@/src/server/preferences/saved-view-contracts";

import { useProjectViewSearch } from "../hooks/use-project-view-search";
import {
  isSameNormalizedProjectViewSearch,
  projectViewHref,
  projectViewSearchToSettings,
  projectViewSettingsToSearch,
} from "../project-view-search";

const selectedViewType = (
  value: FormDataEntryValue | null
): "board" | "list" | "table" | "calendar" | "timeline" => {
  if (
    value === "list" ||
    value === "table" ||
    value === "calendar" ||
    value === "timeline"
  ) {
    return value;
  }
  return "board";
};

export const ProjectSavedViews = ({
  projectId,
  views,
  selectedId,
  userId,
  isAdmin,
}: {
  readonly projectId: string;
  readonly views: readonly SavedViewSummary[];
  readonly selectedId: string | null;
  readonly userId: string | null;
  readonly isAdmin: boolean;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { search } = useProjectViewSearch();
  const currentSettings = projectViewSearchToSettings(search);
  const selectedView = views.find((view) => view.id === selectedId) ?? null;
  const canEditSelected =
    selectedView !== null && (isAdmin || selectedView.userId === userId);
  const hasUnsavedChanges =
    selectedView !== null &&
    !isSameNormalizedProjectViewSearch(
      search,
      projectViewSettingsToSearch(selectedView)
    );

  const create = (formData: FormData) =>
    startTransition(async () => {
      const result = await createSavedViewAction({
        idempotencyKey: crypto.randomUUID(),
        view: {
          filters: currentSettings.filters,
          groupBy: currentSettings.groupBy,
          hiddenColumns: [...currentSettings.hiddenColumns],
          isShared: isAdmin && formData.get("isShared") === "on",
          name: String(formData.get("name") ?? "").trim(),
          projectId,
          sort: currentSettings.sort,
          type: selectedViewType(formData.get("type")),
        },
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.push(projectViewHref(projectId, result.data.id, search) as Route);
      router.refresh();
    });

  const saveChanges = (view: SavedViewSummary) =>
    startTransition(async () => {
      const result = await updateSavedViewAction({
        idempotencyKey: crypto.randomUUID(),
        view: {
          filters: currentSettings.filters,
          groupBy: currentSettings.groupBy,
          hiddenColumns: [...currentSettings.hiddenColumns],
          isShared: view.isShared,
          name: view.name,
          projectId: view.projectId,
          sort: currentSettings.sort,
          type: view.type,
        },
        viewId: view.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.refresh();
    });

  const remove = (viewId: string) =>
    startTransition(async () => {
      const result = await deleteSavedViewAction({
        idempotencyKey: crypto.randomUUID(),
        viewId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      if (selectedId === viewId) {
        router.push(`/projects/${projectId}?view=board` as Route);
      }
      router.refresh();
    });

  return (
    <>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <nav aria-label="Saved project views" className="tabs saved-view-tabs">
        {canEditSelected && hasUnsavedChanges && selectedView ? (
          <WorkspaceButton
            className="tab"
            disabled={pending}
            onClick={() => saveChanges(selectedView)}
            type="button"
          >
            {pending ? "Saving…" : "Update view"}
          </WorkspaceButton>
        ) : null}
        {views.map((view) => (
          <span className="tab-wrap" key={view.id}>
            <Link
              aria-current={selectedId === view.id ? "page" : undefined}
              className={`tab${selectedId === view.id ? " on" : ""}`}
              href={
                projectViewHref(
                  projectId,
                  view.id,
                  projectViewSettingsToSearch(view)
                ) as Route
              }
            >
              {view.name}
            </Link>
            {isAdmin || view.userId === userId ? (
              <WorkspaceConfirmDialog
                confirmLabel="Delete view"
                description={`Delete the saved view “${view.name}”?`}
                onConfirm={() => remove(view.id)}
                title="Delete saved view"
              >
                <WorkspaceButton
                  aria-label={`Delete saved view ${view.name}`}
                  className="ibtn ibtn-xs"
                  disabled={pending}
                  type="button"
                >
                  <X aria-hidden="true" size={14} />
                </WorkspaceButton>
              </WorkspaceConfirmDialog>
            ) : null}
          </span>
        ))}
        <WorkspaceDisclosure
          description="Save this project layout as a reusable view."
          title="Save project view"
          trigger={
            <WorkspaceButton
              aria-label="Save view of this project"
              className="tab"
              type="button"
            >
              <Plus aria-hidden="true" size={14} />
              Save view
            </WorkspaceButton>
          }
        >
          <form action={create} className="panel-b stack">
            <label
              className="field"
              htmlFor="metsys-project-saved-views-field-143"
            >
              <span>Name</span>
              <WorkspaceInput
                className="input"
                maxLength={80}
                name="name"
                required
                id="metsys-project-saved-views-field-143"
              />
            </label>
            <label
              className="field"
              htmlFor="metsys-project-saved-views-field-152"
            >
              <span>Layout</span>
              <WorkspaceSelect
                className="input"
                defaultValue="board"
                name="type"
                id="metsys-project-saved-views-field-152"
              >
                <WorkspaceSelectItem value="board">Board</WorkspaceSelectItem>
                <WorkspaceSelectItem value="list">List</WorkspaceSelectItem>
                <WorkspaceSelectItem value="table">Table</WorkspaceSelectItem>
                <WorkspaceSelectItem value="calendar">
                  Calendar
                </WorkspaceSelectItem>
                <WorkspaceSelectItem value="timeline">
                  Timeline
                </WorkspaceSelectItem>
              </WorkspaceSelect>
            </label>
            {isAdmin ? (
              <label
                className="row"
                htmlFor="metsys-project-saved-views-field-171"
              >
                <Checkbox
                  name="isShared"
                  id="metsys-project-saved-views-field-171"
                />
                <span>Share with workspace</span>
              </label>
            ) : null}
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <WorkspaceButton
              className="btn btn-primary btn-sm"
              disabled={pending}
              type="submit"
            >
              {pending ? "Saving…" : "Save view"}
            </WorkspaceButton>
          </form>
        </WorkspaceDisclosure>
      </nav>
    </>
  );
};
