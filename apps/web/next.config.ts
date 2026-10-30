import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const monorepoRoot = fileURLToPath(new URL("../..", import.meta.url));

const exposeTestingApi = process.env["EXPOSE_TESTING_API"] === "1";

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    brief: { expire: 300, revalidate: 60, stale: 30 },
    moderate: { expire: 86_400, revalidate: 3600, stale: 300 },
    realtime: { expire: 30, revalidate: 10, stale: 0 },
    reference: { expire: 604_800, revalidate: 86_400, stale: 3600 },
  },
  experimental: {
    agentFeedback: false,
    agentUpgrade: "latest",
    exposeTestingApiInProductionBuild: exposeTestingApi,
    instantInsights: {
      validationLevel: "warning",
    },
    optimizePackageImports: ["@phosphor-icons/react"],
    turbopackGc: true,
    turbopackLazyDynamicImports: true,
    turbopackRustReactCompiler: true,
    useTypeScriptCli: true,
  },
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    root: monorepoRoot,
  },
  typedRoutes: true,
};

export default nextConfig;
