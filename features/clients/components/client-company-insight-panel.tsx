/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import {
  clientStatusText,
  isOpenClientLabel,
} from "@/features/portal/client-status";
import type { ClientCompanyDetail } from "@/src/server/clients/client-company-contracts";

export const BugSummary = ({
  bugCounts,
  satisfaction,
  sla,
}: {
  readonly bugCounts: ClientCompanyDetail["bugCounts"];
  readonly satisfaction: ClientCompanyDetail["satisfaction"];
  readonly sla: ClientCompanyDetail["sla"];
}) => {
  const rated = satisfaction.up + satisfaction.down;
  const total = bugCounts.reduce((sum, { count }) => sum + count, 0);
  const groups = [
    {
      heading: "Open",
      items: bugCounts.filter(({ label }) => isOpenClientLabel(label)),
    },
    {
      heading: "Finished",
      items: bugCounts.filter(({ label }) => !isOpenClientLabel(label)),
    },
  ] as const;
  return (
    <section
      aria-labelledby="client-bugs-heading"
      className="panel clients-panel"
    >
      <div className="panel-h clients-panel-h">
        <div>
          <h2 id="client-bugs-heading">Bugs summary</h2>
          <p className="muted">
            {total === 1 ? "1 bug" : `${total} bugs`} reported, counted by the
            status the client sees.
          </p>
        </div>
      </div>
      <div className="panel-b clients-bug-groups">
        {groups.map(({ heading, items }) => (
          <div className="clients-bug-group" key={heading}>
            <h3 className="sub">{heading}</h3>
            <dl className="clients-bug-counts">
              {items.map(({ count, label }) => (
                <div
                  className="clients-bug-count"
                  data-empty={count === 0 || undefined}
                  key={label}
                >
                  <dt>{clientStatusText[label]}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <p className="panel-b clients-ratings clients-sla">
        <span className="sub">SLA</span>{" "}
        {sla.tracked === 0
          ? "No SLA-tracked bugs yet."
          : `${sla.tracked} tracked · ${sla.responseBreaches} first-response ${sla.responseBreaches === 1 ? "breach" : "breaches"} · ${sla.resolutionBreaches} resolution ${sla.resolutionBreaches === 1 ? "breach" : "breaches"}`}
      </p>
      <p className="panel-b clients-ratings">
        <span className="sub">Client ratings</span>{" "}
        <span aria-hidden="true">
          👍 {satisfaction.up} · 👎 {satisfaction.down}
        </span>
        <span className="sr-only">
          {satisfaction.up} thumbs up, {satisfaction.down} thumbs down
        </span>
        {rated > 0
          ? ` · ${Math.round((satisfaction.up / rated) * 100)}% positive`
          : ""}
      </p>
    </section>
  );
};

const formatBusinessMinutes = (minutes: number): string => {
  const total = Math.round(minutes);
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  const mins = total % 60;
  const parts = [
    days ? `${days}d` : null,
    hours ? `${hours}h` : null,
    mins || total === 0 ? `${mins}m` : null,
  ].filter(Boolean);
  return `${parts.join(" ")} of business time`;
};

const formatPercent = (rate: number | null): string =>
  rate === null ? "—" : `${Math.round(rate * 100)}%`;

export const InsightPanel = ({
  detail,
}: {
  readonly detail: ClientCompanyDetail;
}) => {
  const { insight, satisfaction, sla } = detail;
  const rated = satisfaction.up + satisfaction.down;
  const openBugs = detail.bugCounts.filter(
    ({ count, label }) => isOpenClientLabel(label) && count > 0
  );
  return (
    <section
      aria-labelledby="client-insight-heading"
      className="panel clients-panel"
    >
      <div className="panel-h clients-panel-h">
        <div>
          <h2 id="client-insight-heading">Insight</h2>
          <p className="muted">
            Response times, SLA and satisfaction for this client.
          </p>
        </div>
      </div>
      <dl className="clients-insight-list">
        <div>
          <dt>Open bugs</dt>
          <dd>
            {openBugs.length ? (
              openBugs
                .map(
                  ({ count, label }) => `${clientStatusText[label]}: ${count}`
                )
                .join(" · ")
            ) : (
              <small>No open bugs</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Average first response</dt>
          <dd>
            {insight.averageFirstResponseMinutes === null
              ? "No responses yet"
              : formatBusinessMinutes(insight.averageFirstResponseMinutes)}
          </dd>
        </div>
        <div>
          <dt>SLA breach rate</dt>
          <dd>
            {formatPercent(insight.slaBreachRate)}{" "}
            <small>
              {sla.tracked === 0
                ? "no tracked bugs"
                : `${sla.tracked} tracked · ${sla.responseBreaches} response, ${sla.resolutionBreaches} resolution breaches`}
            </small>
          </dd>
        </div>
        <div>
          <dt>Reopen rate</dt>
          <dd>{formatPercent(insight.reopenRate)}</dd>
        </div>
        <div>
          <dt>Thumbs-up rate</dt>
          <dd>
            {formatPercent(insight.thumbsUpRate)} <small>{rated} rated</small>
          </dd>
        </div>
      </dl>
    </section>
  );
};
