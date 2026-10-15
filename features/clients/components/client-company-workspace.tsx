/* eslint-disable shadcn/no-unknown-classes */
/* eslint-disable shadcn/no-restyle */

"use client";

import { ArrowLeft } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ClientCompanyHandlers,
  ClientCompanyProjects,
} from "@/features/clients/components/client-company-assignments";
import {
  ClientCompanyRenameForm,
  ClientCompanyStatusControl,
} from "@/features/clients/components/client-company-forms";
import { ClientCompanyUsers } from "@/features/clients/components/client-company-users";
import {
  clientStatusText,
  isOpenClientLabel,
} from "@/features/portal/client-status";
import type { ClientCompanyDetail } from "@/src/server/clients/client-company-contracts";

const BugSummary = ({
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

const ClientCompanyWorkspace = ({
  detail,
  employeeOptions,
  projectOptions,
}: {
  readonly detail: ClientCompanyDetail;
  readonly employeeOptions: readonly {
    readonly email: string;
    readonly id: string;
    readonly name: string;
  }[];
  readonly projectOptions: readonly {
    readonly id: string;
    readonly key: string;
    readonly name: string;
  }[];
}) => {
  const { company } = detail;
  // A mutation answers with the next version before the refreshed page
  // arrives; whichever is newer guards the following change.
  const [localVersion, setLocalVersion] = useState(company.version);
  const version = Math.max(localVersion, company.version);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="clients-workspace">
      <Link className="clients-back" href="/clients">
        <ArrowLeft aria-hidden="true" size={14} />
        All clients
      </Link>
      <header className="ph clients-heading">
        <div>
          <p className="eyebrow">Client company</p>
          <div className="clients-title">
            <h1>{company.name}</h1>
            <Badge variant={company.active ? "secondary" : "outline"}>
              {company.active ? "Active" : "Deactivated"}
            </Badge>
          </div>
          <p>
            {company.userCount} active users · {company.projectCount} projects ·{" "}
            {company.handlerCount} handlers · {company.openBugCount} open bugs
          </p>
        </div>
        <div className="acts">
          <ClientCompanyRenameForm
            company={company}
            onVersion={setLocalVersion}
            version={version}
          />
          <ClientCompanyStatusControl
            company={company}
            onError={setError}
            onVersion={setLocalVersion}
            version={version}
          />
        </div>
      </header>
      {error ? (
        <p className="error clients-error" role="alert">
          {error}
        </p>
      ) : null}
      <Tabs className="clients-tabs" defaultValue="users">
        <TabsList aria-label="Client company sections">
          <TabsTrigger value="users">
            Users <span className="ct">{detail.users.length}</span>
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects <span className="ct">{detail.projects.length}</span>
          </TabsTrigger>
          <TabsTrigger value="handlers">
            Handlers <span className="ct">{detail.handlers.length}</span>
          </TabsTrigger>
          <TabsTrigger value="bugs">Bugs summary</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <ClientCompanyUsers
            companyActive={company.active}
            companyId={company.id}
            companyName={company.name}
            users={detail.users}
          />
        </TabsContent>
        <TabsContent value="projects">
          <ClientCompanyProjects
            companyId={company.id}
            onVersion={setLocalVersion}
            projectOptions={projectOptions}
            projects={detail.projects}
            version={version}
          />
        </TabsContent>
        <TabsContent value="handlers">
          <ClientCompanyHandlers
            companyId={company.id}
            employeeOptions={employeeOptions}
            handlers={detail.handlers}
            onVersion={setLocalVersion}
            version={version}
          />
        </TabsContent>
        <TabsContent value="bugs">
          <BugSummary
            bugCounts={detail.bugCounts}
            satisfaction={detail.satisfaction}
            sla={detail.sla}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export { ClientCompanyWorkspace };
