/* eslint-disable shadcn/no-unknown-classes, shadcn/no-restyle -- Workspace classes are defined in app/workspace-styles. */

import { Buildings } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SkeletonDataGrid } from "@/components/workspace/skeleton-shapes";
import { listAllClientCompanies } from "@/features/clients/clients-queries";
import { readOrThrow } from "@/lib/read-result";
import { getPageSession } from "@/src/server/auth/page-session";

const ClientCompanyList = async () => {
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/");
  }
  const companies = readOrThrow(
    await listAllClientCompanies(),
    "Client companies"
  );
  return companies.length ? (
    <section aria-label="Client companies" className="panel clients-panel">
      <Table className="clients-table">
        <TableCaption className="sr-only">Client companies</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="clients-num">Active users</TableHead>
            <TableHead className="clients-num">Projects</TableHead>
            <TableHead className="clients-num">Handlers</TableHead>
            <TableHead className="clients-num">Open bugs</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company) => (
            <TableRow key={company.id}>
              <TableCell>
                <Link
                  className="clients-company-link"
                  href={`/clients/${company.id}`}
                  transitionTypes={["nav-forward"]}
                >
                  <Buildings aria-hidden="true" size={16} />
                  <strong>{company.name}</strong>
                </Link>
              </TableCell>
              <TableCell>
                <Badge variant={company.active ? "secondary" : "outline"}>
                  {company.active ? "Active" : "Deactivated"}
                </Badge>
              </TableCell>
              <TableCell className="clients-num">{company.userCount}</TableCell>
              <TableCell className="clients-num">
                {company.projectCount}
              </TableCell>
              <TableCell className="clients-num">
                {company.handlerCount}
              </TableCell>
              <TableCell className="clients-num">
                {company.openBugCount}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  ) : (
    <section className="clients-empty-state">
      <Buildings aria-hidden="true" size={24} />
      <h2>No client companies yet</h2>
      <p>
        Create a company, link its projects and add client users so they can
        report bugs through the portal.
      </p>
    </section>
  );
};

const COLUMNS = [
  "Company",
  "Status",
  "Active users",
  "Projects",
  "Handlers",
  "Open bugs",
] as const;

const ClientCompanyCount = async () => {
  const companies = readOrThrow(
    await listAllClientCompanies(),
    "Client companies"
  );
  return companies.length === 1
    ? "1 client company can report bugs through the portal."
    : `${companies.length} client companies can report bugs through the portal.`;
};

// Mirrors ClientCompanyList: the column headings are static; every row is
// data.
const ClientCompanyListSkeleton = () => (
  <section aria-label="Client companies" className="panel clients-panel">
    <SkeletonDataGrid
      columns={COLUMNS}
      label="Loading client companies…"
      rows={5}
      widths="2fr 1fr 1fr 1fr 1fr 1fr"
    />
  </section>
);

export { ClientCompanyCount, ClientCompanyList, ClientCompanyListSkeleton };
