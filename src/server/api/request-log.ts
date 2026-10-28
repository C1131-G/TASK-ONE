import { AsyncLocalStorage } from "node:async_hooks";

import { Effect } from "effect";

// What is known about the request being answered. The route gate fills it in
// as it learns who is calling; `respondWith` writes it out as one log line.
// Only identifiers go in: never a body, a query string, a header or a URL.
export interface RequestRecord {
  method?: string;
  operationId?: string;
  userId?: string;
}

const store = new AsyncLocalStorage<RequestRecord>();

export const withRequestRecord = async <Result>(
  run: () => Promise<Result>
): Promise<{ readonly record: RequestRecord; readonly value: Result }> => {
  const record: RequestRecord = {};
  const value = await store.run(record, run);
  return { record, value };
};

export const annotateRequest = (fields: RequestRecord): Effect.Effect<void> =>
  Effect.sync(() => {
    const record = store.getStore();
    if (record) {
      Object.assign(record, fields);
    }
  });
