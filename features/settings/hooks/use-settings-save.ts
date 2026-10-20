"use client";

import { useState, useTransition } from "react";

const useSaveState = () => {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return { error, pending, setError, startTransition };
};

export { useSaveState };
