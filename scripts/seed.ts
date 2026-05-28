import { getSeedSummary } from "../src/lib/db/seed";

const summary = getSeedSummary();
console.log(
  JSON.stringify(
    {
      seeded: true,
      goals: summary.goals.length,
      runs: summary.runs.length,
    },
    null,
    2
  )
);

