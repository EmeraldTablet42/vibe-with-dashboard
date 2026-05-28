import path from "node:path";

export function getProjectRoot() {
  const cwd = path.join(/*turbopackIgnore: true*/ process.cwd(), ".");
  return process.env.VIBE_DASHBOARD_PROJECT_ROOT
    ? path.resolve(process.env.VIBE_DASHBOARD_PROJECT_ROOT)
    : cwd;
}

export function getAppRoot() {
  const cwd = path.join(/*turbopackIgnore: true*/ process.cwd(), ".");
  return process.env.VIBE_DASHBOARD_APP_ROOT
    ? path.resolve(process.env.VIBE_DASHBOARD_APP_ROOT)
    : cwd;
}
