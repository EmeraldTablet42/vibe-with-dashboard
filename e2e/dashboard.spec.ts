import { expect, test } from "@playwright/test";

test("cockpit loads, creates a Run, resolves a decision, and opens inspector tabs", async ({
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

  await expect(page.getByRole("heading", { name: "Plan / Kanban" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live Session" })).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await page.getByRole("button", { name: /Long\s+장기 수행/ }).click();
  await expect(page.getByText("Long · 장기 수행", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inspector" })).toHaveCount(0);
  await page.getByRole("button", { name: "Inspector" }).click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByPlaceholder("Codex에게 보낼 다음 작업...").click();
  await page.keyboard.type("E2E smoke Run을 생성하고 이벤트 스트림 갱신을 확인해줘.");
  await page.getByRole("button", { name: "Run" }).click();
  await expect(
    page.getByRole("heading", { name: /E2E smoke Run/ }).first()
  ).toBeVisible();

  const approveButton = page.getByRole("button", { name: "승인" }).first();
  if (await approveButton.isVisible()) {
    await approveButton.click();
    await page.waitForTimeout(500);
  }

  await page.getByRole("button", { name: "Inspector" }).click();
  await page.getByLabel("GitHub").click();
  await expect(page.getByText("auth")).toBeVisible();

  await page.getByLabel("Design").click();
  await expect(page.getByText("--radius")).toBeVisible();

  await page.getByLabel("Harness").click();
  await expect(page.getByText("Repo Skills")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "project-dashboard-agent" })
  ).toBeVisible();
  await expect(page.getByText("MCP Servers")).toBeVisible();
  await expect(page.getByRole("heading", { name: "dashboard" }).first()).toBeVisible();
  await expect(page.getByText("Harness Files")).toBeVisible();
  await expect(page.getByText("Project Dashboard Agent")).toBeVisible();

  await page.getByLabel("Agents").click();
  await expect(
    page.getByRole("heading", { name: "dashboard-reviewer" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "테마 전환" }).click();
  expect(consoleErrors).toEqual([]);
});
