/* eslint-disable shadcn/no-unknown-classes -- Error and muted styles come from app/workspace-styles. */

"use client";

import { useEffect, useState } from "react";

import { getBugHistoryAction } from "@/features/bugs/bugs-actions";
import { BugDetailWorkflow } from "@/features/bugs/components/bug-detail-workflow";
import type { BugHistorySchema } from "@/src/server/work/bug-history";

type BugHistory = typeof BugHistorySchema.Type;

export const BugTaskDetail = ({
  bugId,
  employees,
  isAdmin,
  onClientReportChange,
  userId,
}: {
  readonly bugId: string;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
  readonly onClientReportChange?: (isClientReport: boolean) => void;
  readonly userId: string;
}) => {
  const [history, setHistory] = useState<BugHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const load = async () => {
      if (!current) {
        return;
      }
      // Keep the second guard so a late response cannot update a closed drawer.
      // eslint-disable-next-line react-doctor/async-defer-await
      const result = await getBugHistoryAction({ bugId });
      if (!current) {
        return;
      }
      if (result.ok) {
        setHistory(result.data);
        onClientReportChange?.(result.data.bug.clientCompanyId !== null);
        setError(null);
      } else {
        setError(result.error.message);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [bugId, onClientReportChange]);

  if (error) {
    return (
      <p className="error" role="alert">
        {error}
      </p>
    );
  }
  if (!history) {
    return <p className="muted">Loading bug workflow…</p>;
  }
  return (
    <BugDetailWorkflow
      embedded
      employees={employees}
      history={history}
      isAdmin={isAdmin}
      userId={userId}
    />
  );
};
