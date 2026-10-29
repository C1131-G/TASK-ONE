import { WorkspaceTabShell } from "@/features/navigation/workspace-tabs";
import { PreferencesRoute } from "@/features/preferences/preferences-route";

export default function NotificationSettingsRoute() {
  return (
    <WorkspaceTabShell>
      <PreferencesRoute audience="workspace" />
    </WorkspaceTabShell>
  );
}
