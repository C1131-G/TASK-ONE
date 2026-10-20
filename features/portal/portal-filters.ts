import type { ClientStatusLabel } from "./client-status";
import { clientStatusLabels } from "./client-status";

export interface PortalBugFilterValues {
  readonly mine: boolean;
  readonly project?: string;
  readonly status?: ClientStatusLabel;
}

type SearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

// Reads the list filters from the URL; unknown values are ignored.
export const parsePortalBugFilters = (
  params: SearchParams
): PortalBugFilterValues => {
  const status = clientStatusLabels.find(
    (label) => label === first(params["status"])
  );
  const project = first(params["project"]);
  return {
    mine: first(params["mine"]) === "1",
    ...(project ? { project } : {}),
    ...(status ? { status } : {}),
  };
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

// The client user a staff member previews the portal as, from `?as=`.
export const parsePortalPreviewTarget = (
  params: SearchParams
): string | undefined => first(params["as"])?.trim() || undefined;

// The bug being reported again, from `?from=`; anything but a UUID is ignored.
export const parsePortalReportFrom = (
  params: SearchParams
): string | undefined => {
  const from = first(params["from"]);
  return from && UUID_PATTERN.test(from) ? from : undefined;
};
