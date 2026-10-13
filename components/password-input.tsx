"use client";

/* eslint-disable shadcn/no-restyle, shadcn/no-unknown-classes -- Auth screens are styled by app/auth.css. */

import { Eye, EyeSlash, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import type { ComponentProps, KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<
  ComponentProps<typeof Input>,
  "className" | "trailingAction" | "type"
> & {
  readonly visibilityLabel: string;
};

const PasswordInput = ({
  onKeyUp,
  visibilityLabel,
  ...props
}: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const toggleVisibility = () => setVisible((current) => !current);
  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState("CapsLock"));
    onKeyUp?.(event);
  };

  return (
    <div className="auth-password">
      <div className="auth-password-box">
        <Input
          {...props}
          className="auth-input"
          onBlur={() => setCapsLock(false)}
          onKeyUp={trackCapsLock}
          trailingAction
          type={visible ? "text" : "password"}
        />
        <Button
          aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
          aria-pressed={visible}
          className="auth-eye"
          onClick={toggleVisibility}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {visible ? (
            <EyeSlash aria-hidden="true" size={16} />
          ) : (
            <Eye aria-hidden="true" size={16} />
          )}
        </Button>
      </div>
      {capsLock ? (
        <output className="auth-caps">
          <WarningCircle aria-hidden="true" size={13} weight="bold" />
          Caps Lock is on
        </output>
      ) : null}
    </div>
  );
};

export { PasswordInput };
