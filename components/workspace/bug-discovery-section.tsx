/* eslint-disable shadcn/no-unknown-classes -- Bug views use reference workspace CSS classes. */

"use client";

import type { BugHistory } from "./bug-workflow-ui-shared";

export const BugDiscoverySection = ({
  history,
}: {
  readonly history: BugHistory;
}) => (
  <section
    aria-label="Discovery report"
    className="panel panel-b bug-detail-section"
  >
    <header>
      <h2>Discovery report</h2>
      <span
        className={`bug-severity-label bug-severity-label-${history.bug.severity}`}
      >
        {history.bug.severity}
      </span>
    </header>
    <div className="bug-detail-facts">
      <p>
        <strong>Found by</strong>
        <span>{history.bug.discoverySource.replaceAll("_", " ")}</span>
      </p>
      <p>
        <strong>Environment</strong>
        <span>
          {history.bug.environment}{" "}
          {history.bug.appVersion ? `· ${history.bug.appVersion}` : ""}
        </span>
      </p>
      <p>
        <strong>Browser / device</strong>
        <span>
          {[history.bug.browser, history.bug.device, history.bug.os]
            .filter(Boolean)
            .join(" · ") || "Not recorded"}
        </span>
      </p>
      <p>
        <strong>Reporter</strong>
        <span>{history.bug.reporterId}</span>
      </p>
    </div>
    <div className="bug-report-detail-grid">
      <div>
        <h3>Reproduction steps</h3>
        <ol>
          {history.bug.reproductionSteps.map((step, index) => (
            <li key={`${index}-${step}`}>{step}</li>
          ))}
        </ol>
      </div>
      <div>
        <h3>Expected</h3>
        <p>{history.bug.expectedBehavior}</p>
        <h3>Actual</h3>
        <p>{history.bug.actualBehavior}</p>
      </div>
    </div>
    {history.bug.description ? (
      <p className="bug-long-description">{history.bug.description}</p>
    ) : null}
  </section>
);
