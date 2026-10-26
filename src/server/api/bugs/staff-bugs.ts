import { staffBugActionRoutes } from "../../../mobile-api/routes-bugs";
import { staffWorkflowWrite } from "./staff-workflow";

export const pickWorkspaceBug = staffWorkflowWrite(
  staffBugActionRoutes.pick,
  "pick",
  "pick"
);
