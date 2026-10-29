import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

import { resolveApiMode } from "@/api/api-mode";

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const readJson = (file: string): Record<string, any> =>
  JSON.parse(readFileSync(path.join(mobileRoot, file), "utf8"));

const eas = readJson("eas.json");
const expo = readJson("app.json").expo;

it("builds an installable APK for the preview profile", () => {
  expect(eas.build.preview.android.buildType).toBe("apk");
  expect(eas.build.preview.distribution).toBe("internal");
});

it("gives the app a stable package and bundle id for both stores", () => {
  expect(expo.android.package).toBe("com.cibi.taskora");
  expect(expo.ios.bundleIdentifier).toBe("com.cibi.taskora");
});

it("only uses API modes the app understands, and ships production live", () => {
  for (const [name, profile] of Object.entries<Record<string, any>>(eas.build)) {
    const mode: string | undefined = profile.env?.EXPO_PUBLIC_API_MODE;
    if (mode !== undefined) {
      expect(resolveApiMode(mode), `${name} profile`).toBe(mode);
    }
  }
  expect(eas.build.production.env?.EXPO_PUBLIC_API_MODE ?? "live").toBe("live");
});

it("shows the whole UI in preview builds while the backend catches up", () => {
  expect(eas.build.preview.env.EXPO_PUBLIC_API_MODE).toBe("hybrid");
});

it("opens the Maestro flows on the app's own package", () => {
  for (const flow of ["login-flow.yaml", "task-create-flow.yaml"]) {
    const text = readFileSync(path.join(mobileRoot, "e2e", flow), "utf8");

    expect(text.startsWith(`appId: ${expo.android.package}`), flow).toBe(true);
  }
});

it("paints the splash with the workspace background in light and dark", () => {
  const splash = expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen");

  expect(splash[1].backgroundColor).toBe("#fbfaf8");
  expect(splash[1].dark.backgroundColor).toBe("#1a1a19");
});
