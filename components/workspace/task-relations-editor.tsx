/* eslint-disable shadcn/no-unknown-classes, shadcn/no-inline-styles */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { listLabelsAction } from "@/app/actions/labels";
import {
  listProjectTasksAction,
  setTaskRelationsAction,
} from "@/app/actions/tasks";
import { TaskRelationsSection } from "@/components/workspace/task-details-sections";
import type {
  TaskLabelOption,
  TaskRelationOption,
} from "@/components/workspace/task-details-sections";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

export const TaskRelationsEditor = ({
  taskId,
  projectId,
  version,
  labelIds,
  dependencyIds,
  editable,
  onVersionChange,
}: {
  readonly taskId: string;
  readonly projectId: string;
  readonly version: number;
  readonly labelIds: readonly string[];
  readonly dependencyIds: readonly string[];
  readonly editable: boolean;
  readonly onVersionChange: (version: number) => void;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [labels, setLabels] = useState<readonly TaskLabelOption[]>([]);
  const [dependencies, setDependencies] = useState<
    readonly TaskRelationOption[]
  >([]);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    startTransition(async () => {
      const [labelResult, taskResult] = await Promise.all([
        listLabelsAction({}),
        listProjectTasksAction({ limit: 200, offset: 0, projectId }),
      ]);
      if (labelResult.ok && taskResult.ok) {
        setLabels(labelResult.data);
        const options: TaskRelationOption[] = [];
        for (const task of taskResult.data) {
          if (task.id !== taskId) {
            options.push({
              id: task.id,
              name: `${task.title} · ${task.status}`,
            });
          }
        }
        setDependencies(options);
        setLoaded(true);
        setError(null);
        return;
      }
      setError(
        labelResult.ok
          ? "Task dependencies could not be loaded."
          : labelResult.error.message
      );
    });

  const save = (formData: FormData) =>
    startTransition(async () => {
      const result = await setTaskRelationsAction({
        dependencyTaskIds: formData.getAll("dependencyTaskIds").map(String),
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
        labelIds: formData.getAll("labelIds").map(String),
        taskId,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onVersionChange(result.data.version);
      setError(null);
      router.refresh();
    });

  return (
    <section className="stack">
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {loaded ? (
        <TaskRelationsSection
          dependencies={dependencies}
          editable={editable}
          labels={labels}
          onSave={save}
          pending={pending}
          selectedDependencyIds={dependencyIds}
          selectedLabelIds={labelIds}
        />
      ) : (
        <WorkspaceButton
          className="btn btn-sm btn-ghost"
          disabled={pending}
          onClick={load}
          type="button"
        >
          {pending
            ? "Loading labels and dependencies…"
            : "Load labels and dependencies"}
        </WorkspaceButton>
      )}
    </section>
  );
};
