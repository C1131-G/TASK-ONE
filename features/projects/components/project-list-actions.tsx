/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle */

"use client";

import { DotsThree } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { WorkspaceConfirmDialog } from "@/components/workspace/workspace-confirm-dialog";
import { WorkspaceInput } from "@/components/workspace/workspace-controls";
import { WorkspaceModal } from "@/components/workspace/workspace-modal";
import {
  archiveProjectAction,
  duplicateProjectAction,
} from "@/features/projects/projects-actions";
import type { ProjectListItem } from "@/src/server/projects/project-contracts";

const ProjectListActions = ({
  project,
}: {
  readonly project: Pick<ProjectListItem, "id" | "key" | "name" | "version">;
}) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicate = (formData: FormData) =>
    startTransition(async () => {
      const result = await duplicateProjectAction({
        idempotencyKey: crypto.randomUUID(),
        key: String(formData.get("key") ?? "")
          .trim()
          .toUpperCase(),
        name: String(formData.get("name") ?? "").trim(),
        sourceProjectId: project.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setDuplicateOpen(false);
      router.push(`/projects/${result.data.id}`, {
        transitionTypes: ["nav-forward"],
      });
    });

  const archive = () =>
    startTransition(async () => {
      const result = await archiveProjectAction({
        expectedVersion: project.version,
        idempotencyKey: crypto.randomUUID(),
        projectId: project.id,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
    });

  return (
    <div className="project-list-actions">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            aria-label={`Options for ${project.name}`}
            className="project-options-trigger"
            size="icon-sm"
            variant="ghost"
          >
            <DotsThree aria-hidden="true" size={18} weight="bold" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="workspace-menu"
          data-workspace-menu=""
        >
          <DropdownMenuItem onSelect={() => setDuplicateOpen(true)}>
            Duplicate project
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <WorkspaceConfirmDialog
            confirmLabel={pending ? "Archiving…" : "Archive project"}
            description={`Archive ${project.name}? Archived projects can be restored by an administrator.`}
            onConfirm={archive}
            title="Archive project"
          >
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Archive project
            </DropdownMenuItem>
          </WorkspaceConfirmDialog>
        </DropdownMenuContent>
      </DropdownMenu>
      <WorkspaceModal
        description={`Create a copy of ${project.name} with a new name and key.`}
        onOpenChange={setDuplicateOpen}
        open={duplicateOpen}
        title="Duplicate project"
        trigger={null}
      >
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            duplicate(new FormData(event.currentTarget));
          }}
        >
          <label className="field" htmlFor={`project-${project.id}-copy-name`}>
            <span>Project name</span>
            <WorkspaceInput
              autoComplete="off"
              className="input"
              defaultValue={`${project.name} copy`}
              id={`project-${project.id}-copy-name`}
              maxLength={120}
              name="name"
              required
            />
          </label>
          <label className="field" htmlFor={`project-${project.id}-copy-key`}>
            <span>Project key</span>
            <WorkspaceInput
              autoComplete="off"
              className="input mono"
              defaultValue={`${project.key}-COPY`}
              id={`project-${project.id}-copy-key`}
              maxLength={12}
              name="key"
              required
            />
          </label>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="acts">
            <WorkspaceButton
              className="btn btn-primary"
              disabled={pending}
              type="submit"
            >
              {pending ? "Duplicating…" : "Duplicate project"}
            </WorkspaceButton>
          </div>
        </form>
      </WorkspaceModal>
      {error && !duplicateOpen ? (
        <p className="error project-action-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
};

export { ProjectListActions };
