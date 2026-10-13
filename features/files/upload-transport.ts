export type PutResult = "ok" | "failed" | "aborted";

// oxlint-disable promise/avoid-new -- XHR is callback based and has no promise API.

// fetch() cannot report upload progress, so the signed PUT goes through XHR.
export const putWithProgress = (
  url: string,
  headers: Readonly<Record<string, string>>,
  file: File,
  onProgress: (loadedBytes: number) => void,
  signal: AbortSignal
): Promise<PutResult> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve("aborted");
      return;
    }
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    for (const [name, value] of Object.entries(headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener("progress", (event) =>
      onProgress(event.loaded)
    );
    request.addEventListener("load", () =>
      resolve(request.status >= 200 && request.status < 300 ? "ok" : "failed")
    );
    request.addEventListener("error", () => resolve("failed"));
    request.addEventListener("abort", () => resolve("aborted"));
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(file);
  });
