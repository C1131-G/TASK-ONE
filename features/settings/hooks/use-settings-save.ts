"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const useSaveState = () => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return { error, pending, router, setError, startTransition };
};

export { useSaveState };
