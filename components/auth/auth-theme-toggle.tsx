"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Auth screens are styled by app/auth.css. */

import { Moon, Sun } from "@phosphor-icons/react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

const AuthThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const toggle = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");

  return (
    <Button
      aria-label="Toggle color theme"
      className="auth-ghost auth-icon-btn"
      onClick={toggle}
      title="Toggle theme"
      type="button"
      variant="ghost"
    >
      <Moon aria-hidden="true" className="auth-theme-moon" size={16} />
      <Sun aria-hidden="true" className="auth-theme-sun" size={16} />
    </Button>
  );
};

export { AuthThemeToggle };
