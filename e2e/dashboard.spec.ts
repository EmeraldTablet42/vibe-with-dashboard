import { expect, test } from "@playwright/test";

test("monitoring cockpit loads with vertical kanban, activity, and folded inspector", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("Encountered a script tag while rendering React component")) {
      return;
    }
    consoleErrors.push(text);
  });

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Plan", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kanban", exact: true })
  ).toBeVisible();
  await expect(page.getByText("현재 처리 지점", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Activity Timeline" })
  ).toHaveCount(0);
  await expect(page.getByText("현재 처리 지점 + 세로 실행 단계")).toBeVisible();
  await expect(page.getByText("Backlog", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("High", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Medium", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Low", { exact: true }).first()).toBeVisible();

  await expect(page.getByPlaceholder(/Codex에게/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run" })).toHaveCount(0);
  await expect(page.getByText("Decision Queue")).toHaveCount(0);
  await expect(page.getByText("heartbeat")).toHaveCount(0);

  await page.getByRole("button", { name: "Activity" }).click();
  await expect(
    page.getByRole("heading", { name: "Activity Timeline" })
  ).toBeVisible();
  await expect(page.getByText("Activities")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await expect(page.getByRole("heading", { name: "Inspector" })).toHaveCount(0);
  await page.getByRole("button", { name: "Inspector" }).click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();

  await page.getByLabel("GitHub").click();
  await expect(page.getByText("auth")).toBeVisible();

  await page.getByLabel("Design").click();
  await expect(page.getByText("--radius")).toBeVisible();

  await page.getByLabel("Harness").click();
  await expect(page.getByText("Repo Skills", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "codex-dashboard" })).toBeVisible();
  await expect(page.getByText("MCP Config", { exact: true })).toBeVisible();
  await expect(
    page.getByText("project-local MCP server 없음", { exact: true })
  ).toBeVisible();

  await page.getByLabel("Agents").click();
  await expect(
    page.getByRole("heading", { name: "dashboard-reviewer" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "테마 전환" }).click();
  expect(consoleErrors).toEqual([]);
});
