import { mock } from "bun:test";

// Cache directives and revalidation have no effect outside the Next.js
// runtime; recording calls lets tests observe what an action asked to refresh.
// This module must be imported before any module that imports next/cache.
export const revalidatedPaths: string[] = [];
export const updatedTags: string[] = [];
export const refreshes: { count: number } = { count: 0 };
const noop = () => {
  // Intentionally empty.
};
mock.module("next/cache", () => ({
  cacheLife: noop,
  cacheTag: noop,
  io: () => Promise.resolve(),
  refresh: () => {
    refreshes.count += 1;
  },
  revalidatePath: (path: string) => {
    revalidatedPaths.push(path);
  },
  updateTag: (tag: string) => {
    updatedTags.push(tag);
  },
}));
