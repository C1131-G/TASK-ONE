import {
  emptyValues,
  valuesFromBug,
} from "@/features/portal/components/portal-bug-form-model";
import type { Values } from "@/features/portal/components/portal-bug-form-model";
import type {
  PortalBugDetail,
  PortalProject,
  PortalResponseTimes,
} from "@/src/server/portal/portal-contracts";

export type Mode =
  | {
      readonly kind: "create";
      readonly projects: readonly PortalProject[];
      // A closed bug being reported again; its fields prefill the form.
      readonly recurrenceOf?: PortalBugDetail;
      readonly responseTimes?: PortalResponseTimes | null;
    }
  | {
      readonly kind: "edit";
      readonly bug: PortalBugDetail;
      readonly onCancel: () => void;
      readonly onDone: () => void;
    };

const unsubscribe = () => {
  // The browser's environment does not change while the form is open.
};
export const noSubscription = () => unsubscribe;

export const initialValues = (mode: Mode): Values => {
  if (mode.kind === "edit") {
    return valuesFromBug(mode.bug);
  }
  const { recurrenceOf } = mode;
  if (recurrenceOf) {
    // Environment is left to the current browser; screenshots start empty.
    return {
      ...valuesFromBug(recurrenceOf),
      browser: null,
      device: null,
      os: null,
    };
  }
  return emptyValues(
    mode.projects.length === 1 ? (mode.projects[0]?.id ?? "") : ""
  );
};

export const submitLabel = (mode: Mode, pending: boolean) => {
  if (mode.kind === "edit") {
    return pending ? "Saving…" : "Save changes";
  }
  return pending ? "Submitting…" : "Submit bug";
};

export const conflictMessage =
  "This bug changed while you were editing. Reload the page to see the latest version, then try again.";
