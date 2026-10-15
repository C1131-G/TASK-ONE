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
import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { listClientCompanies } from "@/features/clients/clients-queries";
import { ClientCompanyCreateForm } from "@/features/clients/components/client-company-forms";
import { getPageSession } from "@/src/server/auth/page-session";

const ClientCompanyList = async () => {
  const session = await getPageSession();
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    redirect("/");
  }
  const result = await listClientCompanies({});
  if (!result.ok) {
    return (
      <div className="panel panel-b" role="alert">
        Client companies could not be loaded. Refresh to retry.
      </div>
    );
  }
  const companies = result.data;
  return (
    <>
      <div className="ph">
        <div>
          <h1>Clients</h1>
          <p>
            {companies.length === 1
              ? "1 client company can report bugs through the portal."
              : `${companies.length} client companies can report bugs through the portal.`}
          </p>
        </div>
        <div className="acts">
          <Link className="btn btn-secondary btn-sm" href="/clients/audit">
            Audit log
          </Link>
          <ClientCompanyCreateForm />
        </div>
      </div>
      {companies.length ? (
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
                  <TableCell className="clients-num">
                    {company.userCount}
                  </TableCell>
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
      )}
    </>
  );
};

// The header carries the company count, so the skeleton repeats its title.
const ClientCompanyListSkeleton = () => (
  <>
    <div className="ph">
      <div>
        <h1>Clients</h1>
        <p className="muted">Loading client companies…</p>
      </div>
    </div>
    <PanelSkeleton label="Loading client companies…" rows={5} />
  </>
);

export { ClientCompanyList, ClientCompanyListSkeleton };
