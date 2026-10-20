"use client";

import { useSearchParams } from "next/navigation";

// A filter, sort or tab kept in the URL so it survives reload and can be
// shared. Next.js syncs native history updates with useSearchParams, so the
// change re-renders the client without a server round trip; the default value
// leaves the URL clean.
export const useSearchParamState = <Value extends string>(
  name: string,
  values: readonly Value[],
  defaultValue: Value
) => {
  const searchParams = useSearchParams();
  const raw = searchParams.get(name);
  const value = values.find((candidate) => candidate === raw) ?? defaultValue;

  // Controls hand back plain strings; anything outside the allowed values is
  // ignored.
  const setValue = (requested: string) => {
    const next = values.find((candidate) => candidate === requested);
    if (next === undefined) {
      return;
    }
    const url = new URL(window.location.href);
    if (next === defaultValue) {
      url.searchParams.delete(name);
    } else {
      url.searchParams.set(name, next);
    }
    window.history.replaceState(
      null,
      "",
      `${url.pathname}${url.search}${url.hash}`
    );
  };

  return [value, setValue] as const;
};
