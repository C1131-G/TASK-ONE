/* eslint-disable shadcn/no-unknown-classes -- Skeletons mirror the client company list markup. */

import Link from "next/link";

import {
  SkeletonBone,
  SkeletonDataGrid,
} from "@/components/workspace/skeleton-shapes";

const COLUMNS = [
  "Company",
  "Status",
  "Active users",
  "Projects",
  "Handlers",
  "Open bugs",
] as const;
// Mirrors ClientCompanyList: the title, audit link and column headings are
// static; the company count and every row are data.
const ClientCompanyListSkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Clients</h1>
        <p>
          <SkeletonBone />
        </p>
      </div>
      <div className="acts">
        <Link className="btn btn-secondary btn-sm" href="/clients/audit">
          Audit log
        </Link>
      </div>
    </div>
    <section aria-label="Client companies" className="panel clients-panel">
      <SkeletonDataGrid
        columns={COLUMNS}
        label="Loading client companies…"
        rows={8}
        widths="2fr 1fr 1fr 1fr 1fr 1fr"
      />
    </section>
  </>
);

export { ClientCompanyListSkeleton };
