"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<
  ComponentProps<typeof Input>,
  "trailingAction" | "type"
> & {
  readonly visibilityLabel: string;
};

const PasswordInput = ({ visibilityLabel, ...props }: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  const toggleVisibility = () => setVisible((current) => !current);

  return (
    <div className="relative">
      <Input {...props} trailingAction type={visible ? "text" : "password"} />
      <Button
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 z-10 -translate-y-1/2"
        onClick={toggleVisibility}
        size="icon-lg"
        type="button"
        variant="ghost"
      >
        {visible ? (
          <EyeSlash aria-hidden="true" size={18} />
        ) : (
          <Eye aria-hidden="true" size={18} />
        )}
      </Button>
    </div>
  );
};

export { PasswordInput };
