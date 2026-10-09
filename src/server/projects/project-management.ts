import { Layer } from "effect";

import { ProjectManagement } from "./project-contracts";
import { createProject } from "./project-create";
import { duplicateProject } from "./project-duplicate";
import {
  listProjectMilestones,
  saveProjectMilestones,
} from "./project-milestones";
import {
  archiveProject,
  restoreProject,
  updateProject,
} from "./project-mutations";
import { setProjectPeople } from "./project-people";
import { listProjects } from "./project-queries";

export const ProjectManagementLive = Layer.succeed(
  ProjectManagement,
  ProjectManagement.of({
    archiveProject,
    createProject,
    duplicateProject,
    listProjectMilestones,
    listProjects,
    restoreProject,
    saveProjectMilestones,
    setProjectPeople,
    updateProject,
  })
);
