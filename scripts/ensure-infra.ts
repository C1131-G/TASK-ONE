import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

// Brings up the local backend services before the app starts: launches Docker
// Desktop when the engine is not running, then starts the single PostgreSQL
// instance and MinIO and waits until Postgres reports healthy.
//
//   bun run scripts/ensure-infra.ts
//
// Set SKIP_INFRA=1 to skip (CI, or a database that is hosted elsewhere).

const ENGINE_TIMEOUT_MS = 240_000;
const HEALTH_TIMEOUT_MS = 90_000;
const POLL_MS = 2000;
const SERVICES = ["postgres", "minio", "minio-init"];

const DOCKER_DESKTOP_PATHS = [
  process.env["DOCKER_DESKTOP_PATH"],
  "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe",
  "/Applications/Docker.app",
];

const log = (message: string): void => {
  process.stdout.write(`[infra] ${message}\n`);
};

const docker = (args: string[]) =>
  spawnSync("docker", args, { encoding: "utf-8", timeout: 20_000 });

const engineReady = (): boolean => docker(["info"]).status === 0;

const launchDockerDesktop = (): boolean => {
  if (process.platform === "win32") {
    const path = DOCKER_DESKTOP_PATHS.find(
      (entry) => entry && existsSync(entry)
    );
    if (!path) {
      return false;
    }
    spawn(path, [], { detached: true, stdio: "ignore" }).unref();
    return true;
  }
  if (process.platform === "darwin") {
    spawn("open", ["-a", "Docker"], {
      detached: true,
      stdio: "ignore",
    }).unref();
    return true;
  }
  return false;
};

const waitUntil = async (
  ready: () => boolean,
  timeoutMs: number
): Promise<boolean> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (ready()) {
      return true;
    }
    // oxlint-disable-next-line no-await-in-loop
    await sleep(POLL_MS);
  }
  return ready();
};

const postgresHealthy = (): boolean =>
  docker([
    "inspect",
    "-f",
    "{{.State.Health.Status}}",
    "taskora-postgres",
  ]).stdout?.trim() === "healthy";

const main = async (): Promise<void> => {
  if (process.env["SKIP_INFRA"] === "1") {
    log("SKIP_INFRA=1, leaving services alone.");
    return;
  }

  if (!engineReady()) {
    log("Docker engine is not running; starting Docker Desktop...");
    if (!launchDockerDesktop()) {
      throw new Error(
        "Docker is not running and Docker Desktop was not found. Start Docker, or set DOCKER_DESKTOP_PATH."
      );
    }
    if (!(await waitUntil(engineReady, ENGINE_TIMEOUT_MS))) {
      throw new Error("Docker Desktop did not become ready in time.");
    }
    log("Docker engine is ready.");
  }

  log("Starting PostgreSQL and MinIO...");
  const up = spawnSync("docker", ["compose", "up", "-d", ...SERVICES], {
    stdio: "inherit",
  });
  if (up.status !== 0) {
    throw new Error("docker compose up failed.");
  }

  if (!(await waitUntil(postgresHealthy, HEALTH_TIMEOUT_MS))) {
    throw new Error("PostgreSQL did not become healthy in time.");
  }
  log("PostgreSQL is healthy.");
};

try {
  await main();
} catch (error) {
  log(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
