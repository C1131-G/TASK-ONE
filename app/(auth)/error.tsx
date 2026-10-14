"use client";

import { RouteError } from "@/components/ui/route-error";

const AuthError = ({ reset }: { readonly reset: () => void }) => (
  <RouteError reset={reset} title="Sign-in page unavailable" />
);

export default AuthError;
