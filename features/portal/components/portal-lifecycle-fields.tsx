"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";

import type { Satisfaction } from "./portal-lifecycle-support";

export const FieldError = ({
  id,
  message,
}: {
  readonly id: string;
  readonly message: string;
}) =>
  message ? (
    <p className="err" id={id} role="alert">
      {message}
    </p>
  ) : null;

export const SatisfactionPicker = ({
  disabled,
  legend,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly legend: string;
  readonly onChange: (value: Satisfaction | null) => void;
  readonly value: Satisfaction | null;
}) => (
  <fieldset className="portal-rate-set">
    <legend className="label">{legend}</legend>
    <div className="portal-rate-btns">
      <button
        aria-label="Good, thumbs up"
        aria-pressed={value === "up"}
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={() => onChange(value === "up" ? null : "up")}
        type="button"
      >
        <ThumbsUp
          aria-hidden="true"
          size={16}
          weight={value === "up" ? "fill" : "regular"}
        />
        <span aria-hidden="true">👍</span>
      </button>
      <button
        aria-label="Not good, thumbs down"
        aria-pressed={value === "down"}
        className="btn btn-secondary btn-sm"
        disabled={disabled}
        onClick={() => onChange(value === "down" ? null : "down")}
        type="button"
      >
        <ThumbsDown
          aria-hidden="true"
          size={16}
          weight={value === "down" ? "fill" : "regular"}
        />
        <span aria-hidden="true">👎</span>
      </button>
    </div>
  </fieldset>
);
