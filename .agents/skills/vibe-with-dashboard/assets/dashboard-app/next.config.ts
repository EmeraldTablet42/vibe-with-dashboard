import type { NextConfig } from "next";
import path from "node:path";

const appRoot = process.env.VIBE_DASHBOARD_APP_ROOT
  ? path.resolve(process.env.VIBE_DASHBOARD_APP_ROOT)
  : path.join(/*turbopackIgnore: true*/ process.cwd(), ".");

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
