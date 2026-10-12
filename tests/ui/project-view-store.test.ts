import { expect, test } from "bun:test";

import { defaultProjectViewSearch } from "../../components/workspace/project-view-search";
import { createProjectViewStore } from "../../components/workspace/view-store/project-view-store";

test("setSearch merges a patch and keeps the other fields", () => {
  const store = createProjectViewStore(defaultProjectViewSearch);
  store.actions.setSearch({ q: "release" });
  store.actions.setSearch({ sort: "due" });
  expect(store.state.search).toEqual({
    ...defaultProjectViewSearch,
    q: "release",
    sort: "due",
  });
});

test("replaceSearch swaps the whole search", () => {
  const store = createProjectViewStore(defaultProjectViewSearch);
  store.actions.setSearch({ status: "todo" });
  store.actions.replaceSearch({ ...defaultProjectViewSearch, group: "none" });
  expect(store.state.search).toEqual({
    ...defaultProjectViewSearch,
    group: "none",
  });
});

test("subscribers are notified once per change with the new state", () => {
  const store = createProjectViewStore(defaultProjectViewSearch);
  const seen: string[] = [];
  const subscription = store.subscribe(({ search }) => {
    seen.push(search.priority);
  });
  store.actions.setSearch({ priority: "high" });
  store.actions.setSearch({ priority: "low" });
  subscription.unsubscribe();
  store.actions.setSearch({ priority: "urgent" });
  expect(seen).toEqual(["high", "low"]);
});
