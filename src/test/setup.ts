import fs from "node:fs";
import path from "node:path";

const dbPath = path.resolve(process.cwd(), ".dashboard", "test.sqlite");
process.env.DASHBOARD_DB_PATH = dbPath;

for (const suffix of ["", "-wal", "-shm"]) {
  const target = `${dbPath}${suffix}`;
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
  }
}

