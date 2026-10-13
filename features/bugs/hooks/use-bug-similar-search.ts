"use client";

import { useState } from "react";
import type { MouseEvent } from "react";

import { listBugsAction } from "@/features/bugs/bugs-actions";

import type { SimilarBug } from "../components/bug-similar-results";

export const useBugSimilarSearch = (
  setMessage: (message: string | null) => void
) => {
  const [similarBugs, setSimilarBugs] = useState<readonly SimilarBug[]>([]);
  const [searchingSimilar, setSearchingSimilar] = useState(false);

  const findSimilarBugs = async (event: MouseEvent<HTMLButtonElement>) => {
    const { form } = event.currentTarget;
    if (!form) {
      return;
    }
    const data = new FormData(form);
    const query =
      String(data.get("title") ?? "").trim() ||
      String(data.get("component") ?? "").trim();
    if (!query) {
      setMessage("Enter a title or component before searching previous bugs.");
      return;
    }
    setSearchingSimilar(true);
    setMessage(null);
    try {
      const result = await listBugsAction({ includeArchived: true, query });
      if (result.ok === false) {
        setMessage(result.error.message);
      } else {
        setSimilarBugs(
          result.data
            .slice(0, 5)
            .map(({ bug, latestFixOutcome, latestFixSummary }) => ({
              id: bug.id,
              latestFixOutcome,
              latestFixSummary,
              projectKey: bug.projectKey,
              projectTaskNumber: bug.projectTaskNumber,
              status: bug.status,
              title: bug.title,
            }))
        );
      }
    } catch {
      setMessage("Earlier bug reports could not be searched.");
    }
    setSearchingSimilar(false);
  };

  return { findSimilarBugs, searchingSimilar, similarBugs };
};
