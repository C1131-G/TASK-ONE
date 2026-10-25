import { WorkspaceEmptyState } from "@/components/workspace/workspace-empty-state";
import { WorkspaceTabShell } from "@/features/navigation/workspace-tabs";

/**
 * Screens for domains whose live routes are still pending get this frame:
 * honest about the state, reachable from the More menu, and swapped for
 * the real screen when the domain lands.
 */
export const PendingDomainScreen = ({ title }: { readonly title: string }) => (
  <WorkspaceTabShell>
    <WorkspaceEmptyState
      message="This area arrives with its live API routes."
      title={title}
    />
  </WorkspaceTabShell>
);
