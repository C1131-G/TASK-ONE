import { accountRoutes } from "./routes-account";
import { attachmentRoutes } from "./routes-attachments";
import { bugRoutes } from "./routes-bugs";
import { directoryRoutes } from "./routes-directory";
import { findRoutes } from "./routes-find";
import { insightRoutes } from "./routes-insight";
import { notificationRoutes } from "./routes-notifications";
import { projectRoutes } from "./routes-projects";
import { taskRoutes } from "./routes-tasks";

// Every route the app can call. Each domain keeps its own list; this file only
// joins them.
export const mobileRoutes = [
  ...accountRoutes,
  ...taskRoutes,
  ...bugRoutes,
  ...notificationRoutes,
  ...attachmentRoutes,
  ...projectRoutes,
  ...directoryRoutes,
  ...insightRoutes,
  ...findRoutes,
] as const;
