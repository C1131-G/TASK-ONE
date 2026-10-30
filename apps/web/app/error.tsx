"use client";

import { RouteError } from "@/components/ui/route-error";

const RootError = ({ reset }: { readonly reset: () => void }) => (
  <RouteError reset={reset} title="Application error" />
);

export default RootError;
