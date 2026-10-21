/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { DownloadSimple } from "@phosphor-icons/react";
import { useState, useTransition } from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { getProjectTimeCsvAction } from "@/features/time/time-actions";
import { saveCsv } from "@/lib/save-csv";

export const ProjectTimeExport = ({
  from,
  projectId,
  projectKey,
  to,
}: {
  readonly from: string;
  readonly projectId: string;
  readonly projectKey: string;
  readonly to: string;
}) => {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);

  const download = () =>
    startTransition(async () => {
      setFailure(null);
      const result = await getProjectTimeCsvAction({ from, projectId, to });
      if (!result.ok) {
        setFailure(result.error.message);
        return;
      }
      saveCsv(
        result.data,
        `${projectKey.toLowerCase()}-time-${from}-to-${to}.csv`
      );
    });

  return (
    <>
      <WorkspaceButton
        aria-busy={pending || undefined}
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={download}
        type="button"
      >
        <DownloadSimple aria-hidden="true" size={14} />
        {pending ? "Exporting…" : "Export CSV"}
      </WorkspaceButton>
      {failure ? (
        <p className="error" role="alert">
          {failure}
        </p>
      ) : null}
    </>
  );
};
