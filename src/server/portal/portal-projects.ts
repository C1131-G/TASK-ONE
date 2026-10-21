import { Layer } from "effect";

import { PortalProjects } from "./portal-project-contracts";
import { getSharedProject, listSharedProjects } from "./portal-project-reads";

export const PortalProjectsLive = Layer.succeed(
  PortalProjects,
  PortalProjects.of({ getSharedProject, listSharedProjects })
);
