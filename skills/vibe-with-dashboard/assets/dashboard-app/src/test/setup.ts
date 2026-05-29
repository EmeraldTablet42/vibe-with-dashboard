import fs from "node:fs";
import path from "node:path";

const workerId =
  process.env.VITEST_POOL_ID ?? process.env.VITEST_WORKER_ID ?? "0";
const dbPath = path.resolve(
  process.cwd(),
  ".dashboard",
  `test-${workerId}.sqlite`
);
process.env.DASHBOARD_DB_PATH = dbPath;

for (const suffix of ["", "-wal", "-shm"]) {
  const target = `${dbPath}${suffix}`;
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}
