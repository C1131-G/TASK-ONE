"use client";

/* eslint-disable shadcn/no-unknown-classes -- Portal classes are authored in app/workspace-styles/portal-screenshot.css. */

import { ArrowUpRight, Rectangle, PencilSimple } from "@phosphor-icons/react";
import { useId, useRef, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { useScreenshotMarks } from "@/features/portal/hooks/use-screenshot-marks";
import { drawAnnotation } from "@/features/portal/portal-screenshot-annotations";
import type {
  Annotation,
  AnnotationTool,
} from "@/features/portal/portal-screenshot-annotations";
import { compressScreenshot } from "@/features/portal/portal-screenshot-compress";
import type { Size } from "@/features/portal/portal-screenshot-geometry";
import { PORTAL_MAX_FILE_BYTES } from "@/features/portal/portal-upload-rules";

// Leaves headroom under the server's limit for the PNG container overhead.
const SAFE_SCREENSHOT_BYTES = PORTAL_MAX_FILE_BYTES - 256 * 1024;

const TOOLS: readonly {
  readonly icon: ReactNode;
  readonly label: string;
  readonly tool: AnnotationTool;
}[] = [
  {
    icon: <PencilSimple aria-hidden="true" size={16} />,
    label: "Pen",
    tool: "pen",
  },
  {
    icon: <Rectangle aria-hidden="true" size={16} />,
    label: "Rectangle",
    tool: "rectangle",
  },
  {
    icon: <ArrowUpRight aria-hidden="true" size={16} />,
    label: "Arrow",
    tool: "arrow",
  },
];

// Draws the frame and its marks at the target size and exports a PNG.
const encodeScreenshot =
  (base: HTMLCanvasElement, marks: readonly Annotation[]) =>
  (size: Size): Promise<Blob | null> => {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) {
      return Promise.resolve(null);
    }
    context.scale(size.width / base.width, size.height / base.height);
    context.drawImage(base, 0, 0);
    for (const mark of marks) {
      drawAnnotation(context, mark);
    }
    // toBlob only takes a callback, so it is wrapped once here.
    // oxlint-disable-next-line promise/avoid-new -- Bridges a callback-only browser API.
    return new Promise((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
  };

const PortalScreenshotEditor = ({
  base,
  onDiscard,
  onUse,
}: {
  readonly base: HTMLCanvasElement;
  readonly onDiscard: () => void;
  readonly onUse: (file: File, description: string) => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const helpId = useId();
  const descriptionId = useId();
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [exporting, startExport] = useTransition();
  const { announcement, canvasHandlers, clear, marks, setTool, tool, undo } =
    useScreenshotMarks(canvasRef, base);

  const use = () => {
    setError("");
    startExport(async () => {
      const result = await compressScreenshot({
        encode: encodeScreenshot(base, marks),
        maxBytes: SAFE_SCREENSHOT_BYTES,
        size: { height: base.height, width: base.width },
      });
      startExport(() => {
        if (!result) {
          setError(
            "This screenshot is too large to attach. Discard it, then capture a smaller window or tab."
          );
          return;
        }
        onUse(
          new File([result.blob], `screenshot-${Date.now()}.png`, {
            type: "image/png",
          }),
          description.trim()
        );
      });
    });
  };

  return (
    <section aria-label="Screenshot editor" className="portal-shot-editor">
      <div
        aria-label="Drawing tools"
        className="portal-shot-tools"
        role="toolbar"
      >
        {TOOLS.map((entry) => (
          <button
            aria-pressed={tool === entry.tool}
            className="btn btn-secondary btn-sm"
            key={entry.tool}
            onClick={() => setTool(entry.tool)}
            type="button"
          >
            {entry.icon}
            {entry.label}
          </button>
        ))}
        <button
          className="btn btn-ghost btn-sm"
          disabled={marks.length === 0}
          onClick={undo}
          type="button"
        >
          Undo
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={marks.length === 0}
          onClick={clear}
          type="button"
        >
          Clear
        </button>
      </div>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/prefer-tag-over-role -- A canvas cannot be an img element; the canvas is the drawing surface; it needs focus and key handlers for the keyboard path described in the help text. */}
      <canvas
        {...canvasHandlers}
        aria-describedby={helpId}
        aria-label={
          description ||
          "Screenshot of the page you are reporting. Add marks to point out the problem."
        }
        aria-roledescription="drawing area"
        className="portal-shot-canvas"
        height={base.height}
        ref={canvasRef}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- A canvas cannot be an img element.
        role="img"
        tabIndex={0}
        width={base.width}
      />
      <p className="hint" id={helpId}>
        Draw with a mouse, finger or pen. With a keyboard, focus the picture,
        move with the arrow keys (hold Shift for bigger steps), press Space to
        start a mark and Space again to finish it, or Escape to cancel. Marks
        are optional.
      </p>
      <output aria-live="polite" className="sr-only">
        {announcement}
      </output>
      <div className="field">
        <label className="label" htmlFor={descriptionId}>
          Describe the screenshot <span className="faint">(optional)</span>
        </label>
        <input
          autoComplete="off"
          className="input"
          id={descriptionId}
          maxLength={200}
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <p className="hint">
          Say what it shows, for people who cannot see the picture. It is added
          to your report.
        </p>
      </div>
      {error ? (
        <p className="portal-form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="portal-form-acts">
        <button
          aria-busy={exporting}
          className="btn btn-primary btn-sm"
          disabled={exporting}
          onClick={use}
          type="button"
        >
          {exporting ? "Preparing…" : "Use screenshot"}
        </button>
        <button
          className="btn btn-ghost btn-sm"
          disabled={exporting}
          onClick={onDiscard}
          type="button"
        >
          Discard
        </button>
      </div>
    </section>
  );
};

export { PortalScreenshotEditor };
