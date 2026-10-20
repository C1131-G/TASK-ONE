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
import { ClientCompanyLogo } from "@/features/clients/components/client-company-logo";
import { ClientCompanyUsers } from "@/features/clients/components/client-company-users";
import type { ClientCompanyAdminDetail } from "@/src/server/clients/client-company-contracts";

import { BugSummary, InsightPanel } from "./client-company-insight-panel";

const ClientCompanyWorkspace = ({
  detail,
  employeeOptions,
  projectOptions,
}: {
  readonly detail: ClientCompanyAdminDetail;
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
      <Link
        className="clients-back"
        href="/clients"
        transitionTypes={["nav-back"]}
      >
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
      <ClientCompanyLogo
        companyId={company.id}
        companyName={company.name}
        logoUrl={detail.logoUrl}
        onVersion={setLocalVersion}
        version={version}
      />
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
          <TabsTrigger value="insight">Insight</TabsTrigger>
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
        <TabsContent value="insight">
          <InsightPanel detail={detail} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export { ClientCompanyWorkspace };
