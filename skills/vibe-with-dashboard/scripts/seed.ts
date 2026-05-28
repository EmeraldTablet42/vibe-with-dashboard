import { getSeedSummary } from "../src/lib/db/seed";

const summary = getSeedSummary();
console.log(
  JSON.stringify(
    {
      seeded: true,
      boards: summary.boards.length,
      goals: summary.goals.length,
      activities: summary.activities.length,
    },
    null,
    2
  )
);
