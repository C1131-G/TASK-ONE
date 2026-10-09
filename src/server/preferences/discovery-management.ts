import { Layer } from "effect";

import { DiscoveryManagement } from "./discovery-contracts";
import {
  toggleProjectFavorite,
  toggleTaskFavorite,
} from "./discovery-favorites";
import { listPersonalWorkspace, searchWorkspace } from "./discovery-queries";
import { addRecentSearch } from "./discovery-recent-searches";

export {
  DiscoveryManagement,
  PersonalWorkspaceSchema,
  WorkspaceSearchResultsSchema,
} from "./discovery-contracts";
export type {
  PersonalWorkspace,
  WorkspaceSearchResults,
} from "./discovery-contracts";

export const DiscoveryManagementLive = Layer.succeed(
  DiscoveryManagement,
  DiscoveryManagement.of({
    addRecentSearch,
    listPersonalWorkspace,
    searchWorkspace,
    toggleProjectFavorite,
    toggleTaskFavorite,
  })
);
