"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal.css. */

import { CheckCircle } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import type { FormEvent } from "react";

import { changeOwnPasswordAction } from "@/features/user/user-actions";

const MIN_LENGTH = 12;

interface Fields {
  readonly confirm: string;
  readonly current: string;
  readonly next: string;
}

interface Feedback {
  readonly done: boolean;
  readonly error: string;
  readonly field: string | undefined;
}

const NO_FEEDBACK: Feedback = { done: false, error: "", field: undefined };
const EMPTY_FIELDS: Fields = { confirm: "", current: "", next: "" };

const PortalChangePassword = () => {
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [feedback, setFeedback] = useState<Feedback>(NO_FEEDBACK);
  const [pending, setPending] = useState(false);
  const { current, next, confirm } = fields;
  const { done, error, field: errorField } = feedback;

  const fail = (message: string, field: string) => {
    setFeedback({ done: false, error: message, field });
    setPending(false);
    formRef.current?.querySelector<HTMLInputElement>(`#${field}`)?.focus();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(NO_FEEDBACK);
    if (next.length < MIN_LENGTH) {
      fail(`Use at least ${MIN_LENGTH} characters.`, "portal-new-password");
      return;
    }
    if (next !== confirm) {
      fail("The new passwords do not match.", "portal-confirm-password");
      return;
    }
    setPending(true);
    try {
      const result = await changeOwnPasswordAction({
        currentPassword: current,
        newPassword: next,
      });
      if (result.ok) {
        setFields(EMPTY_FIELDS);
        setFeedback({ done: true, error: "", field: undefined });
        setPending(false);
        return;
      }
      fail(result.error.message, "portal-current-password");
    } catch {
      fail(
        "Your password could not be changed. Try again.",
        "portal-current-password"
      );
    }
  };

  const invalid = (field: string) => (errorField === field ? true : undefined);
  const describedBy = (field: string) =>
    errorField === field ? "portal-password-error" : undefined;

  return (
    <form
      aria-busy={pending}
      className="portal-form"
      noValidate
      onSubmit={submit}
      ref={formRef}
    >
      {done ? (
        <output className="portal-success">
          <CheckCircle aria-hidden="true" size={16} weight="fill" />
          Your password has been changed.
        </output>
      ) : null}
      {error ? (
        <p
          className="portal-form-error"
          id="portal-password-error"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="field">
        <label className="label" htmlFor="portal-current-password">
          Current password
        </label>
        <input
          aria-describedby={describedBy("portal-current-password")}
          aria-invalid={invalid("portal-current-password")}
          autoComplete="current-password"
          className="input"
          disabled={pending}
          id="portal-current-password"
          maxLength={128}
          onChange={(event) =>
            setFields({ ...fields, current: event.target.value })
          }
          required
          type="password"
          value={current}
        />
      </div>
      <div className="field">
        <label className="label" htmlFor="portal-new-password">
          New password
        </label>
        <input
          aria-describedby={describedBy("portal-new-password")}
          aria-invalid={invalid("portal-new-password")}
          autoComplete="new-password"
          className="input"
          disabled={pending}
          id="portal-new-password"
          maxLength={128}
          minLength={MIN_LENGTH}
          onChange={(event) =>
            setFields({ ...fields, next: event.target.value })
          }
          required
          type="password"
          value={next}
        />
        <p className="hint">At least {MIN_LENGTH} characters.</p>
      </div>
      <div className="field">
        <label className="label" htmlFor="portal-confirm-password">
          Confirm new password
        </label>
        <input
          aria-describedby={describedBy("portal-confirm-password")}
          aria-invalid={invalid("portal-confirm-password")}
          autoComplete="new-password"
          className="input"
          disabled={pending}
          id="portal-confirm-password"
          maxLength={128}
          onChange={(event) =>
            setFields({ ...fields, confirm: event.target.value })
          }
          required
          type="password"
          value={confirm}
        />
      </div>
      <div>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Updating password…" : "Change password"}
        </button>
      </div>
    </form>
  );
};

export { PortalChangePassword };
