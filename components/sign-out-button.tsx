"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/src/client/auth-client";

const SignOutButton = () => {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const signOut = async () => {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Sign-out failed. Try again.");
      } else {
        router.replace("/login");
        router.refresh();
      }
    } catch {
      setError("Sign-out failed. Try again.");
    }
    setPending(false);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        aria-busy={pending}
        className="min-w-32"
        disabled={pending}
        onClick={signOut}
        type="button"
        variant="outline"
      >
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      <p aria-live="polite" className="text-sm text-destructive">
        {error}
      </p>
    </div>
  );
};

export { SignOutButton };
