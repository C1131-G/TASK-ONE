"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal pages reuse the workspace stylesheet classes. */

import { PortalFilePicker } from "@/features/portal/components/portal-file-picker";
import { PortalScreenshotCapture } from "@/features/portal/components/portal-screenshot-capture";
import type { CapturedScreenshot } from "@/features/portal/components/portal-screenshot-capture";
import { PORTAL_MAX_FILES_PER_BUG } from "@/features/portal/portal-upload-rules";

// The optional evidence on a new report: a captured screenshot (which uses one
// of the bug's attachment slots) and any files the person already has.
const PortalReportAttachments = ({
  captured,
  disabled,
  files,
  onCaptured,
  onFiles,
}: {
  readonly captured: CapturedScreenshot | null;
  readonly disabled: boolean;
  readonly files: readonly File[];
  readonly onCaptured: (next: CapturedScreenshot | null) => void;
  readonly onFiles: (files: File[]) => void;
}) => (
  <div className="field">
    <span className="label">
      Screenshots <span className="faint">(optional)</span>
    </span>
    <PortalScreenshotCapture
      captured={captured}
      disabled={disabled}
      onChange={onCaptured}
    />
    <PortalFilePicker
      disabled={disabled}
      files={files}
      onChange={onFiles}
      slots={PORTAL_MAX_FILES_PER_BUG - (captured ? 1 : 0)}
    />
  </div>
);

export { PortalReportAttachments };
