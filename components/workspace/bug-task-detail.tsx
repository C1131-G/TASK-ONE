/* eslint-disable shadcn/no-unknown-classes -- Error and muted styles come from workspace-reference.css. */

"use client";

import { useEffect, useState } from "react";

import { getBugHistoryAction } from "@/app/actions/bugs";
import { BugDetailWorkflow } from "@/components/workspace/bug-detail-workflow";
import type { BugHistorySchema } from "@/src/server/work/bug-history";

type BugHistory = typeof BugHistorySchema.Type;

export const BugTaskDetail = ({
  bugId,
  employees,
  isAdmin,
  userId,
}: {
  readonly bugId: string;
  readonly employees: readonly { readonly id: string; readonly name: string }[];
  readonly isAdmin: boolean;
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
        setError(null);
      } else {
        setError(result.error.message);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [bugId]);

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
