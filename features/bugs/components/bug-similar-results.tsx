/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import Link from "next/link";

export interface SimilarBug {
  readonly id: string;
  readonly latestFixOutcome: "passed" | "failed" | null;
  readonly latestFixSummary: string | null;
  readonly projectKey: string;
  readonly projectTaskNumber: number;
  readonly status: string;
  readonly title: string;
}
export const SimilarBugResults = ({
  bugs,
}: {
  readonly bugs: readonly SimilarBug[];
}) =>
  bugs.length > 0 ? (
    <ul aria-label="Similar earlier bugs" className="bug-similar-results">
      {bugs.map((bug) => (
        <li key={bug.id}>
          <Link href={`/bugs/${bug.id}`} target="_blank">
            {bug.projectKey}-{bug.projectTaskNumber} · {bug.title}{" "}
            <span>{bug.status}</span>
          </Link>
          {bug.latestFixSummary ? (
            <p>Latest verified fix: {bug.latestFixSummary}</p>
          ) : null}
          {bug.latestFixOutcome === "failed" && !bug.latestFixSummary ? (
            <p>Latest verification failed; see the report history.</p>
          ) : null}
        </li>
      ))}
    </ul>
  ) : null;
