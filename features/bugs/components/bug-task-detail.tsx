/* eslint-disable shadcn/no-unknown-classes -- Error and muted styles come from app/workspace-styles. */

"use client";

import { useCallback, useEffect, useState } from "react";

import { getBugHistoryAction } from "@/features/bugs/bugs-actions";
import { BugDetailWorkflow } from "@/features/bugs/components/bug-detail-workflow";
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

  const refresh = useCallback(async () => {
    const result = await getBugHistoryAction({ bugId });
    if (result.ok) {
      setHistory(result.data);
      setError(null);
    } else {
      setError(result.error.message);
    }
  }, [bugId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const result = await getBugHistoryAction({ bugId });
      if (!active) {
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
      active = false;
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
      onRefresh={refresh}
    />
  );
};
