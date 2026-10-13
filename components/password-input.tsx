"use client";

import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useState } from "react";
import type { ComponentProps, Ref } from "react";

import { cn } from "@/lib/utils";

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  readonly visibilityLabel: string;
  readonly ref?: Ref<HTMLInputElement>;
};

const PasswordInput = ({
  className,
  ref,
  visibilityLabel,
  ...props
}: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  const toggleVisibility = () => setVisible((current) => !current);

  return (
    <div className="auth-password-field">
      <input
        {...props}
        className={cn("auth-input auth-password-input", className)}
        ref={ref}
        type={visible ? "text" : "password"}
      />
      <button
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-pressed={visible}
        className="auth-password-toggle"
        onClick={toggleVisibility}
        type="button"
      >
        <span aria-hidden="true" className="auth-password-icon">
          {visible ? <EyeSlash size={20} /> : <Eye size={20} />}
        </span>
      </button>
    </div>
  );
};

export { PasswordInput };
