import { describe, expect, it } from "vitest";

import { convertProposedPlanToDashboardPayload } from "@/lib/plan/proposed-plan";

describe("proposed plan conversion contract", () => {
  it("preserves implementation, test, and assumption bullets as dashboard cards", () => {
    const payload = convertProposedPlanToDashboardPayload(`
<proposed_plan>
# Dashboard locale repair

## Implementation
Keep every major implementation item.
- Add Native/English content toggle.
- Color Plan labels by hierarchy and state.

## Test Plan
- Verify Korean content renders by browser locale.
- Verify archive deletion updates the board.

## Assumptions
- Agents provide translations; the dashboard does not call an LLM.
</proposed_plan>
`);

    expect(payload).toMatchObject({
      task: "Dashboard locale repair",
      replace: true,
      source: "proposed_plan",
    });
    expect(payload.milestones.map((milestone) => milestone.title)).toEqual([
      "Implementation",
      "Test Plan",
      "Assumptions",
    ]);

    const cards = payload.milestones.flatMap((milestone) => milestone.cards);
    expect(cards.map((card) => card.summary)).toEqual([
      "Add Native/English content toggle.",
      "Color Plan labels by hierarchy and state.",
      "Verify Korean content renders by browser locale.",
      "Verify archive deletion updates the board.",
      "Agents provide translations; the dashboard does not call an LLM.",
    ]);
    expect(cards.at(-1)).toMatchObject({
      priority: "low",
      status: "backlog",
    });
  });
});
