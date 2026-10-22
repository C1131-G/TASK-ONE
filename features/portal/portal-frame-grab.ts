import { stopStream } from "@/features/portal/portal-screen-capture";
import { fitWithin } from "@/features/portal/portal-screenshot-geometry";

// Large enough to keep text readable on a 4K screen, small enough to keep the
// editor responsive.
const FRAME_LONGEST_EDGE = 2560;

export class NoFrameError extends Error {
  override name = "NoFrameError";
}

// requestAnimationFrame only takes a callback, so it is wrapped once here.
const nextPaint = (): Promise<void> =>
  // oxlint-disable-next-line promise/avoid-new -- Bridges a callback-only browser API.
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const drawFrame = async (stream: MediaStream): Promise<HTMLCanvasElement> => {
  const video = document.createElement("video");
  video.muted = true;
  video.srcObject = stream;
  await video.play();
  // The first painted frame can still be blank right after play() resolves.
  await nextPaint();
  const size = fitWithin(
    { height: video.videoHeight, width: video.videoWidth },
    FRAME_LONGEST_EDGE
  );
  if (video.videoWidth === 0 || video.videoHeight === 0) {
    throw new NoFrameError("The shared screen had no picture.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new NoFrameError("This browser cannot draw the screenshot.");
  }
  context.drawImage(video, 0, 0, size.width, size.height);
  return canvas;
};

// Asks the person to pick a tab or window, takes one frame, and stops sharing
// straight away. Nothing is recorded or sent anywhere from here.
export const grabFrame = async (): Promise<HTMLCanvasElement> => {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: false,
    video: true,
  });
  try {
    return await drawFrame(stream);
  } finally {
    stopStream(stream);
  }
};
