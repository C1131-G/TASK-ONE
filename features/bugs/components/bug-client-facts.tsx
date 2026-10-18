/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import { slaClockText } from "../bug-sla-format";
import type { BugHistory } from "../bug-workflow-ui-shared";
import { MAX_CLIENT_REOPENS } from "./bug-client-labels";

export const ClientOutcomeFacts = ({
  report,
  resolutionText,
}: {
  readonly report: NonNullable<BugHistory["clientReport"]>;
  readonly resolutionText: string | null;
}) => (
  <>
    {report.reopenCount > 0 ? (
      <div>
        <dt>Reopened by the client</dt>
        <dd>
          {report.reopenCount} of {MAX_CLIENT_REOPENS} times
          {report.reopenCount >= MAX_CLIENT_REOPENS ? " (now admin-only)" : ""}
        </dd>
      </div>
    ) : null}
    {report.satisfaction ? (
      <div>
        <dt>Client rating</dt>
        <dd>
          <span aria-hidden="true">
            {report.satisfaction === "up" ? "👍" : "👎"}
          </span>{" "}
          <span className="sr-only">
            {report.satisfaction === "up" ? "Thumbs up" : "Thumbs down"}
          </span>
          {report.satisfactionComment ? (
            <span className="muted"> “{report.satisfactionComment}”</span>
          ) : null}
        </dd>
      </div>
    ) : null}
    {resolutionText ? (
      <div>
        <dt>Closed</dt>
        <dd>{resolutionText}</dd>
      </div>
    ) : null}
  </>
);

export const SlaFacts = ({
  sla,
}: {
  readonly sla: NonNullable<NonNullable<BugHistory["clientReport"]>["sla"]>;
}) => (
  <>
    {(
      [
        ["First response", sla.firstResponse],
        ["Resolution", sla.resolution],
      ] as const
    ).map(([label, clock]) => (
      <div key={label}>
        <dt>{label}</dt>
        <dd>
          <span className={`bug-sla-text bug-sla-${clock.state}`}>
            {slaClockText(clock)}
          </span>
        </dd>
      </div>
    ))}
  </>
);
