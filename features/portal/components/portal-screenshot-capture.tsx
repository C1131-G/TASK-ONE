"use client";

/* eslint-disable shadcn/no-restyle -- Preserve established portal classes on shared controls. */

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in apps/web/app/workspace-styles/portal-screenshot.css. */

import { Camera } from "@phosphor-icons/react";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { WorkspaceButton } from "@/components/workspace/workspace-button";
import { noSubscription } from "@/features/portal/components/portal-bug-form-mode";
import { PortalScreenshotEditor } from "@/features/portal/components/portal-screenshot-editor";
import { NoFrameError, grabFrame } from "@/features/portal/portal-frame-grab";
import { canCaptureScreen } from "@/features/portal/portal-screen-capture";
import { formatFileSize } from "@/features/portal/portal-upload-rules";

export interface CapturedScreenshot {
  readonly description: string;
  readonly file: File;
}

type Support = "unknown" | "yes" | "no";

const supportSnapshot = (): Support =>
  canCaptureScreen(navigator.mediaDevices) ? "yes" : "no";
const supportServerSnapshot = (): Support => "unknown";

const Thumb = ({ captured }: { readonly captured: CapturedScreenshot }) => {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const objectUrl = URL.createObjectURL(captured.file);
    // An object URL is a browser resource, so it is created and released here.
    // oxlint-disable-next-line react/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [captured.file]);
  return url ? (
    // oxlint-disable-next-line next/no-img-element, react-doctor/nextjs-no-img-element -- A local blob preview cannot go through the image optimizer.
    <img
      alt={captured.description || "Screenshot to attach"}
      className="portal-thumb"
      height={64}
      src={url}
      width={64}
    />
  ) : (
    <span aria-hidden="true" className="portal-thumb portal-thumb-icon" />
  );
};

const captureError = (error: unknown): string => {
  if (error instanceof NoFrameError) {
    return error.message;
  }
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "No screenshot was taken. Choose Capture screenshot to try again, or describe the problem in words.";
  }
  return "We could not capture the screen. You can attach a screenshot file instead, or describe the problem in words.";
};

// An optional screenshot of the tab or window the person picks, with marks to
// point at the problem. It becomes one attachment on the report.
const PortalScreenshotCapture = ({
  captured,
  disabled,
  onChange,
}: {
  readonly captured: CapturedScreenshot | null;
  readonly disabled: boolean;
  readonly onChange: (next: CapturedScreenshot | null) => void;
}) => {
  const support = useSyncExternalStore(
    noSubscription,
    supportSnapshot,
    supportServerSnapshot
  );
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [problem, setProblem] = useState("");
  const [capturing, startCapture] = useTransition();

  if (support === "unknown") {
    return null;
  }
  if (support === "no") {
    return (
      <p className="hint">
        Capturing a screenshot is not available in this browser (phones and
        tablets usually cannot). You can attach a screenshot you already took,
        or describe the problem in the fields above.
      </p>
    );
  }

  const capture = () => {
    setProblem("");
    startCapture(async () => {
      try {
        const frame = await grabFrame();
        startCapture(() => setBase(frame));
      } catch (error) {
        startCapture(() => setProblem(captureError(error)));
      }
    });
  };

  if (base) {
    return (
      <PortalScreenshotEditor
        base={base}
        onDiscard={() => setBase(null)}
        onUse={(file, description) => {
          setBase(null);
          onChange({ description, file });
        }}
      />
    );
  }

  return (
    <div className="portal-shot">
      <div className="portal-shot-acts">
        <WorkspaceButton
          aria-busy={capturing}
          className="btn btn-secondary btn-sm"
          disabled={disabled || capturing}
          onClick={capture}
          type="button"
        >
          <Camera aria-hidden="true" size={16} />
          {captured ? "Retake screenshot" : "Capture screenshot"}
        </WorkspaceButton>
        <span className="hint">
          Your browser will ask which tab or window to share. Only one picture
          is taken, then sharing stops.
        </span>
      </div>
      {problem ? (
        <p className="portal-form-error" role="alert">
          {problem}
        </p>
      ) : null}
      {captured ? (
        <ul aria-label="Captured screenshot" className="portal-file-list">
          <li>
            <Thumb captured={captured} />
            <span className="portal-file-name">
              <strong>{captured.file.name}</strong>
              <span className="faint">
                {formatFileSize(captured.file.size)}
              </span>
            </span>
            <WorkspaceButton
              aria-label="Remove captured screenshot"
              className="btn btn-ghost btn-sm"
              disabled={disabled}
              onClick={() => onChange(null)}
              type="button"
            >
              Remove
            </WorkspaceButton>
          </li>
        </ul>
      ) : null}
    </div>
  );
};

export { PortalScreenshotCapture };
