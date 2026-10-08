import type { NextConfig } from "next";

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
    instantInsights: {
      validationLevel: "warning",
    },
    optimizePackageImports: ["@phosphor-icons/react"],
    turbopackGc: true,
    turbopackLazyDynamicImports: true,
    turbopackRustReactCompiler: true,
    useTypeScriptCli: true,
  },
  partialPrefetching: true,
  reactCompiler: true,
  typedRoutes: true,
};

export default nextConfig;
