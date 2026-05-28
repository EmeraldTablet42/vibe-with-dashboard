import { expect, test } from "@playwright/test";

test("English monitoring shell loads with archive and folded panels", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    consoleErrors.push(message.text());
  });

  await page.goto("/");

  await expect(page.getByText("Vibe with Dashboard")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Active/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Archive/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Plan", exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kanban", exact: true })
  ).toBeVisible();
  await expect(page.getByText("No active plan")).toBeVisible();
  await expect(page.getByText("No cards")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Activity" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Inspector" })).toHaveCount(0);

  const sidebar = page.getByTestId("plan-sidebar");
  const defaultBox = await sidebar.boundingBox();
  expect(defaultBox?.width).toBeGreaterThan(330);

  const handle = page.getByLabel("Resize plan");
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + 1, handleBox!.y + 20);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 120, handleBox!.y + 20);
  await page.mouse.up();

  const resizedBox = await sidebar.boundingBox();
  expect(resizedBox!.width).toBeGreaterThan(defaultBox!.width + 60);

  await page.getByRole("button", { name: "Close plan" }).click();
  await expect(sidebar).toHaveCount(0);
  await page.getByRole("button", { name: "Open plan" }).first().click();
  const reopenedBox = await page.getByTestId("plan-sidebar").boundingBox();
  expect(Math.round(reopenedBox!.width)).toBe(Math.round(defaultBox!.width));

  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByText("No archived boards")).toBeVisible();
  await page.getByRole("tab", { name: /Active/ }).click();

  await page.request.post("/api/agent/plan", {
    data: {
      task: "Implement onboarding",
      title: "Implement onboarding",
      summary: "Prepare the first monitored workflow.",
      translations: {
        ko: {
          title: "온보딩 구현",
          summary: "첫 모니터링 흐름을 준비한다.",
          task: "온보딩 구현",
        },
      },
      milestone: {
        title: "Current work",
        translations: {
          ko: { title: "현재 작업", summary: "구현 단계" },
        },
      },
      cards: [
        {
          title: "Create screen",
          summary: "Render the main active board.",
          translations: {
            ko: { title: "화면 만들기", summary: "활성 보드를 렌더링한다." },
          },
          priority: "high",
          status: "ready",
        },
      ],
    },
  });
  await page.reload();

  await expect(
    page.getByRole("heading", { name: "Implement onboarding" }).first()
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create screen" })).toBeVisible();
  await expect(page.getByText("Ready", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("High", { exact: true }).first()).toBeVisible();

  await expect(page.getByPlaceholder(/Codex/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run" })).toHaveCount(0);

  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(page.getByText("Activities")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Inspector" }).click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();

  await page.getByLabel("GitHub").click();
  await expect(page.getByText("Auth")).toBeVisible();

  await page.getByLabel("Design").click();
  await expect(page.getByText("--radius")).toBeVisible();

  await page.getByLabel("Harness").click();
  await expect(page.getByText("Skills", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "vibe-with-dashboard" })
  ).toBeVisible();
  await expect(page.getByText("MCP", { exact: true })).toBeVisible();

  await page.getByLabel("Agents").click();
  await expect(
    page.getByRole("heading", { name: "dashboard-reviewer" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("nextjs-portal")).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});

test("Korean browser locale localizes shell and agent-supplied items", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ locale: "ko-KR", baseURL });
  const page = await context.newPage();

  await context.request.post("/api/agent/plan", {
    data: {
      task: "Implement onboarding",
      title: "Implement onboarding",
      translations: {
        ko: { title: "온보딩 구현", task: "온보딩 구현" },
      },
      milestone: {
        title: "Current work",
        translations: { ko: { title: "현재 작업" } },
      },
      cards: [
        {
          title: "Create screen",
          translations: { ko: { title: "화면 만들기" } },
          priority: "high",
          status: "ready",
        },
      ],
    },
  });
  await page.goto("/");

  await expect(page.getByRole("tab", { name: /진행/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /아카이브/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "온보딩 구현" }).first()
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "화면 만들기" })).toBeVisible();
  await expect(page.getByText("현재 작업").first()).toBeVisible();

  await context.close();
});
