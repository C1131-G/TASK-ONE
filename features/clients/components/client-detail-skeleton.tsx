/* eslint-disable shadcn/no-restyle */
/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the client company workspace markup. */

import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SkeletonBone,
  SkeletonDataGrid,
} from "@/components/workspace/skeleton-shapes";

const USER_COLUMNS = ["User", "Status", "Last active", "Actions"] as const;

// Mirrors ClientCompanyWorkspace: titles, the logo copy, tab names and column
// headings are static; the company, counts and users are data.
const ClientCompanyDetailSkeleton = () => (
  <div className="clients-workspace">
    <Link className="clients-back" href="/clients">
      <ArrowLeft aria-hidden="true" size={14} />
      All clients
    </Link>
    <header className="ph clients-heading">
      <div>
        <p className="eyebrow">Client company</p>
        <div className="clients-title">
          <SkeletonBone shape="title" />
        </div>
        <p>
          <SkeletonBone />
        </p>
      </div>
    </header>
    <section className="panel clients-panel">
      <div className="panel-h clients-panel-h">
        <div>
          <h2>Logo</h2>
          <p className="muted">
            Shown next to the company name in the client portal. PNG, JPEG, or
            WebP up to 2 MB.
          </p>
        </div>
      </div>
    </section>
    <Tabs className="clients-tabs" value="users">
      <TabsList inert>
        <TabsTrigger value="users">Users</TabsTrigger>
        <TabsTrigger value="projects">Projects</TabsTrigger>
        <TabsTrigger value="handlers">Handlers</TabsTrigger>
        <TabsTrigger value="bugs">Bugs summary</TabsTrigger>
        <TabsTrigger value="insight">Insight</TabsTrigger>
      </TabsList>
    </Tabs>
    <section className="panel clients-panel">
      <div className="panel-h clients-panel-h">
        <div>
          <h2>Users</h2>
          <p className="muted">Read-only preview; recorded in the audit log.</p>
        </div>
      </div>
      <SkeletonDataGrid
        columns={USER_COLUMNS}
        label="Loading client company…"
        rows={4}
        widths="2fr 1fr 1.5fr 2.5fr"
      />
    </section>
  </div>
);

export { ClientCompanyDetailSkeleton };
