/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

/* eslint-disable shadcn/require-static-classes */

"use client";

import { Star } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  toggleProjectFavoriteAction,
  toggleTaskFavoriteAction,
} from "@/app/actions/discovery";
import { WorkspaceButton } from "@/components/workspace/workspace-button";

const FavoriteToggle = ({
  kind,
  id,
  initialFavorite,
}: {
  readonly kind: "project" | "task";
  readonly id: string;
  readonly initialFavorite: boolean;
}) => {
  const router = useRouter();
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () =>
    startTransition(async () => {
      const result =
        kind === "project"
          ? await toggleProjectFavoriteAction({
              idempotencyKey: crypto.randomUUID(),
              projectId: id,
            })
          : await toggleTaskFavoriteAction({
              idempotencyKey: crypto.randomUUID(),
              taskId: id,
            });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setError(null);
      setFavorite(result.data);
      router.refresh();
    });

  return (
    <span className="col">
      <WorkspaceButton
        aria-pressed={favorite}
        aria-label={`${favorite ? "Remove from" : "Add to"} favorites`}
        className={`ibtn ibtn-sm${favorite ? " on" : ""}`}
        disabled={pending}
        onClick={toggle}
        type="button"
      >
        <Star
          aria-hidden="true"
          size={14}
          weight={favorite ? "fill" : "regular"}
        />
      </WorkspaceButton>
      {error ? (
        <span className="error" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
};

export { FavoriteToggle };
