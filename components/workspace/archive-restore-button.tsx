/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { restoreProjectAction } from "@/app/actions/projects";
import { restoreTaskAction } from "@/app/actions/tasks";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

const ArchiveRestoreButton = ({
  kind,
  id,
  version,
}: {
  readonly kind: "project" | "task";
  readonly id: string;
  readonly version: number;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const restore = () =>
    startTransition(async () => {
      const input = {
        expectedVersion: version,
        idempotencyKey: crypto.randomUUID(),
      };
      const result =
        kind === "project"
          ? await restoreProjectAction({ ...input, projectId: id })
          : await restoreTaskAction({ ...input, taskId: id });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });

  return (
    <span className="col">
      <WorkspaceButton
        disabled={pending}
        onClick={restore}
        size="sm"
        type="button"
        variant="secondary"
        workspace
      >
        {pending ? "Restoring…" : "Restore"}
      </WorkspaceButton>
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
};

export { ArchiveRestoreButton };
