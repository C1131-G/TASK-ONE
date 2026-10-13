"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Auth screens are styled by features/user/styles/*.css. */

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/src/client/auth-client";

const AuthSignOutButton = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  const signOut = async () => {
    setPending(true);
    setFailed(false);
    try {
      const result = await authClient.signOut();
      if (!result.error) {
        router.replace("/login");
        router.refresh();
        return;
      }
    } catch {
      // Reported through the label below.
    }
    setFailed(true);
    setPending(false);
  };

  let label = "Sign out";
  if (pending) {
    label = "Signing out…";
  } else if (failed) {
    label = "Sign-out failed. Retry";
  }

  return (
    <Button
      aria-busy={pending}
      className="auth-ghost"
      disabled={pending}
      onClick={signOut}
      type="button"
      variant="ghost"
    >
      <SignOut aria-hidden="true" size={14} />
      <span aria-live="polite">{label}</span>
    </Button>
  );
};

export { AuthSignOutButton };
