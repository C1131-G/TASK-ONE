/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable jsx-a11y/label-has-associated-control */

"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createSavedViewAction,
  deleteSavedViewAction,
} from "@/app/actions/saved-views";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import type { SavedViewSummary } from "@/src/server/preferences/saved-view-contracts";

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

  const create = (formData: FormData) =>
    startTransition(async () => {
      const result = await createSavedViewAction({
        idempotencyKey: crypto.randomUUID(),
        view: {
          filters: {},
          groupBy: null,
          hiddenColumns: [],
          isShared: isAdmin && formData.get("isShared") === "on",
          name: String(formData.get("name") ?? "").trim(),
          projectId,
          sort: {},
          type: selectedViewType(formData.get("type")),
        },
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      router.push(
        `/projects/${projectId}?view=saved-${result.data.id}` as Route
      );
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
        {views.map((view) => (
          <span className="tab-wrap" key={view.id}>
            <Link
              aria-current={selectedId === view.id ? "page" : undefined}
              className={`tab${selectedId === view.id ? " on" : ""}`}
              href={`/projects/${projectId}?view=saved-${view.id}` as Route}
            >
              {view.name}
            </Link>
            {isAdmin || view.userId === userId ? (
              <WorkspaceButton
                aria-label={`Delete saved view ${view.name}`}
                className="ibtn ibtn-xs"
                disabled={pending}
                onClick={() => remove(view.id)}
                type="button"
              >
                ×
              </WorkspaceButton>
            ) : null}
          </span>
        ))}
        <details className="saved-view-create">
          <summary aria-label="Save project view" className="tab">
            + Save view
          </summary>
          <form action={create} className="panel-b stack">
            <label className="field">
              <span>Name</span>
              <WorkspaceInput
                className="input"
                maxLength={80}
                name="name"
                required
              />
            </label>
            <label className="field">
              <span>Layout</span>
              <select className="input" defaultValue="board" name="type">
                <option value="board">Board</option>
                <option value="list">List</option>
                <option value="table">Table</option>
                <option value="calendar">Calendar</option>
                <option value="timeline">Timeline</option>
              </select>
            </label>
            {isAdmin ? (
              <label className="row">
                <input name="isShared" type="checkbox" />
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
        </details>
      </nav>
    </>
  );
};
