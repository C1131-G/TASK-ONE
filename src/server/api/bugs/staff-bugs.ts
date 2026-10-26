import { staffBugActionRoutes } from "../../../mobile-api/routes-bugs";
import { staffWorkflowWrite } from "./staff-workflow";

export const pickWorkspaceBug = staffWorkflowWrite(
  staffBugActionRoutes.pick,
  "pick",
  "pick"
);

export const triageWorkspaceBug = staffWorkflowWrite(
  staffBugActionRoutes.triage,
  "triage",
  "triage"
);

export const reassignWorkspaceBug = staffWorkflowWrite(
  staffBugActionRoutes.reassign,
  "reassign",
  "reassign"
);

export const requestBugInfo = staffWorkflowWrite(
  staffBugActionRoutes.requestInfo,
  "requestInfo",
  "request-info"
);
