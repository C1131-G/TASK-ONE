import { Layer } from "effect";

import {
  addComment,
  attachFile,
  confirmFix,
  rateBug,
  reopenFix,
  taskIdForBug,
} from "./portal-bug-actions";
import {
  listNotifications,
  listProjects,
  responseTimes,
} from "./portal-bug-lists";
import { getBug, listBugPage, listBugs } from "./portal-bug-reads";
import { editBug, submitBug, withdrawBug } from "./portal-bug-submission";
import { PortalBugs } from "./portal-contracts";

export const PortalBugsLive = Layer.succeed(
  PortalBugs,
  PortalBugs.of({
    addComment,
    attachFile,
    confirmFix,
    editBug,
    getBug,
    listBugPage,
    listBugs,
    listNotifications,
    listProjects,
    rateBug,
    reopenFix,
    responseTimes,
    submitBug,
    taskIdForBug,
    withdrawBug,
  })
);
