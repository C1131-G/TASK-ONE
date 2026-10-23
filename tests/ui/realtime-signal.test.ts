import { expect, test } from "bun:test";

import {
  announceRealtimeRefresh,
  subscribeToRealtimeRefresh,
} from "@/features/realtime/realtime-signal";

test("a subscriber hears each announced refresh", () => {
  const target = new EventTarget();
  let heard = 0;
  subscribeToRealtimeRefresh(() => {
    heard += 1;
  }, target);

  announceRealtimeRefresh(target);
  announceRealtimeRefresh(target);

  expect(heard).toBe(2);
});

test("unsubscribing stops the notifications", () => {
  const target = new EventTarget();
  let heard = 0;
  const unsubscribe = subscribeToRealtimeRefresh(() => {
    heard += 1;
  }, target);

  unsubscribe();
  announceRealtimeRefresh(target);

  expect(heard).toBe(0);
});
