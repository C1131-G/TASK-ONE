import { describe, expect, it } from "bun:test";

import {
  reduceMilestoneDraft,
  serializeMilestoneDraft,
} from "@/features/projects/milestone-draft";

const original = [
  { completed: false, dueDate: null, id: "m1", name: "Design" },
] as const;
const updated = [
  { completed: false, dueDate: "2026-11-01", id: "m1", name: "Design" },
] as const;
const keyedOriginal = original.map((item) => ({ ...item, key: item.id }));

const initial = {
  baseVersion: 4,
  baseline: original,
  dirty: false,
  draft: keyedOriginal,
};

describe("milestone draft reconciliation", () => {
  it("uses a newer server version when the local draft is clean", () => {
    const remote = [{ completed: true, dueDate: null, id: "m2", name: "Ship" }];
    const result = reduceMilestoneDraft(initial, {
      draft: remote.map((item) => ({ ...item, key: item.id })),
      incoming: remote,
      type: "reload",
      version: 5,
    });

    expect(result.baseVersion).toBe(5);
    expect(result.dirty).toBe(false);
    expect(result.draft[0]?.name).toBe("Ship");
  });

  it("keeps a dirty draft based on its captured version until explicit reload", () => {
    const dirty = reduceMilestoneDraft(initial, {
      draft: keyedOriginal.map((item) => ({ ...item, name: "Local edit" })),
      incoming: original,
      type: "edit",
      version: 4,
    });
    const remote = [{ completed: true, dueDate: null, id: "m2", name: "Ship" }];
    const stillDirty = reduceMilestoneDraft(dirty, {
      draft: dirty.draft,
      incoming: remote,
      type: "edit",
      version: 5,
    });

    expect(stillDirty.baseVersion).toBe(4);
    expect(stillDirty.dirty).toBe(true);
    expect(stillDirty.draft[0]?.name).toBe("Local edit");

    const reloaded = reduceMilestoneDraft(stillDirty, {
      draft: remote.map((item) => ({ ...item, key: item.id })),
      incoming: remote,
      type: "reload",
      version: 5,
    });
    expect(reloaded.baseVersion).toBe(5);
    expect(reloaded.dirty).toBe(false);
  });

  it("compares milestone values without client-only keys", () => {
    expect(serializeMilestoneDraft(keyedOriginal)).toBe(
      serializeMilestoneDraft(original)
    );
    expect(serializeMilestoneDraft(keyedOriginal)).not.toBe(
      serializeMilestoneDraft(updated)
    );
  });
});
