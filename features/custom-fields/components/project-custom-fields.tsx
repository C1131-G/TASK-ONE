/* eslint-disable shadcn/no-unknown-classes */

import { PanelSkeleton } from "@/components/workspace/panel-skeleton";
import { CustomFieldManager } from "@/features/custom-fields/components/custom-field-manager";
import { listProjectCustomFields } from "@/features/custom-fields/custom-field-queries";
import { getProject } from "@/features/projects/projects-queries";
import { readOrThrow } from "@/lib/read-result";
import { getPageSession } from "@/src/server/auth/page-session";

// Administrators define the fields; everyone else is told where they stand.
// The project read decides whether the page exists at all.
export const ProjectCustomFields = async ({
  projectId,
}: {
  readonly projectId: string;
}) => {
  const [session, project] = await Promise.all([
    getPageSession(),
    getProject(projectId),
  ]);
  if (session.kind !== "authenticated" || session.user.role !== "admin") {
    return (
      <section className="panel panel-b" role="alert">
        Only administrators can define custom fields.
      </section>
    );
  }
  const fields = readOrThrow(
    await listProjectCustomFields({ projectId: project.id }),
    "Custom fields"
  );
  return <CustomFieldManager fields={fields} projectId={project.id} />;
};

export const ProjectCustomFieldsSkeleton = () => (
  <PanelSkeleton label="Loading custom fields…" rows={3} variant="list" />
);
