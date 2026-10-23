import { accountRoutes } from "./routes-account";
import { attachmentRoutes } from "./routes-attachments";
import { bugRoutes } from "./routes-bugs";
import { notificationRoutes } from "./routes-notifications";
import { taskRoutes } from "./routes-tasks";

// Every route the app can call. Each domain keeps its own list; this file only
// joins them.
export const mobileRoutes = [
  ...accountRoutes,
  ...taskRoutes,
  ...bugRoutes,
  ...notificationRoutes,
  ...attachmentRoutes,
] as const;
