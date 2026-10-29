import { withSkeleton } from "react-zero-skeleton";

import { WorkspaceScreen } from "@/components/workspace/workspace-screen";

/** Uses the rendered native screen tree as the source for its loading bones. */
export const SkelterWorkspaceScreen = withSkeleton(WorkspaceScreen);
