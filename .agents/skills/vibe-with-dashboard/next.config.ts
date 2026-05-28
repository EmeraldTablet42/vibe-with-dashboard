import type { NextConfig } from "next";
import path from "node:path";

const appRoot = path.resolve(process.env.VIBE_DASHBOARD_APP_ROOT ?? process.cwd());

const nextConfig: NextConfig = {
  devIndicators: false,
  serverExternalPackages: ["better-sqlite3"],
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
