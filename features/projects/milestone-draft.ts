export interface MilestoneDraftItem {
  readonly id: string | null;
  readonly name: string;
  readonly dueDate: string | null;
  readonly completed: boolean;
}

export interface MilestoneDraftItemWithKey extends MilestoneDraftItem {
  readonly key: string;
}

export interface MilestoneDraftState {
  readonly baseline: readonly MilestoneDraftItem[];
  readonly baseVersion: number;
  readonly dirty: boolean;
  readonly draft: readonly MilestoneDraftItemWithKey[];
}

export type MilestoneDraftAction =
  | {
      readonly type: "edit";
      readonly draft: readonly MilestoneDraftItemWithKey[];
      readonly incoming: readonly MilestoneDraftItem[];
      readonly version: number;
    }
  | {
      readonly type: "reload";
      readonly incoming: readonly MilestoneDraftItem[];
      readonly version: number;
      readonly draft: readonly MilestoneDraftItemWithKey[];
    }
  | {
      readonly type: "saved";
      readonly incoming: readonly MilestoneDraftItem[];
      readonly version: number;
      readonly draft: readonly MilestoneDraftItemWithKey[];
    };

export const serializeMilestoneDraft = (
  items: readonly MilestoneDraftItem[]
): string =>
  JSON.stringify(
    items.map(({ id, name, dueDate, completed }) => ({
      completed,
      dueDate,
      id,
      name,
    }))
  );

export const reduceMilestoneDraft = (
  state: MilestoneDraftState,
  action: MilestoneDraftAction
): MilestoneDraftState => {
  if (action.type === "edit") {
    const baseline = state.dirty ? state.baseline : action.incoming;
    const baseVersion = state.dirty ? state.baseVersion : action.version;
    return {
      baseVersion,
      baseline,
      dirty:
        serializeMilestoneDraft(action.draft) !==
        serializeMilestoneDraft(baseline),
      draft: action.draft,
    };
  }

  return {
    baseVersion: action.version,
    baseline: action.incoming,
    dirty: false,
    draft: action.draft,
  };
};
