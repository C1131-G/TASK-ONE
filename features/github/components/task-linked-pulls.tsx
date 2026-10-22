/* eslint-disable shadcn/no-unknown-classes */

import type { LinkedPull } from "@/src/server/github/github-contracts";

const STATE_BADGES = {
  closed: { label: "Closed", tone: "gray" },
  merged: { label: "Merged", tone: "green" },
  open: { label: "Open", tone: "amber" },
} as const;

const PULL_PAGE_PATTERN =
  /^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+\/pull\/\d+$/u;

// Titles come from outside the app and are rendered only as React text. The
// link is drawn only for a real pull request page, so a stored URL can never
// become a script or a lookalike host.
export const TaskLinkedPulls = ({
  pulls,
}: {
  readonly pulls: readonly LinkedPull[];
}) => {
  if (pulls.length === 0) {
    return null;
  }
  return (
    <section aria-label="Pull requests" className="stack">
      <h3>Pull requests</h3>
      <ul className="stack">
        {pulls.map((pull) => {
          const badge = STATE_BADGES[pull.state];
          const reference = `${pull.repoFullName}#${pull.number}`;
          return (
            <li className="row" key={pull.id}>
              <span className={`badge ${badge.tone}`}>{badge.label}</span>
              {PULL_PAGE_PATTERN.test(pull.url) ? (
                <a href={pull.url} rel="noopener noreferrer" target="_blank">
                  {pull.title}
                </a>
              ) : (
                <span>{pull.title}</span>
              )}
              <span className="muted">{reference}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
