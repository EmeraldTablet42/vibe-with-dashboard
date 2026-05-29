import { expect, test } from "@playwright/test";

test("English monitoring shell loads with archive and folded panels", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: "http://127.0.0.1:3100",
  });
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
        en: {
          title: "Implement onboarding",
          summary: "Prepare the first monitored workflow.",
          task: "Implement onboarding",
        },
      },
      milestone: {
        title: "Current work",
        translations: {
          ko: { title: "현재 작업", summary: "구현 단계" },
          en: { title: "Current work", summary: "Implementation stage" },
        },
      },
      cards: [
        {
          title: "Create screen",
          summary: "Render the main active board.",
          translations: {
            ko: { title: "화면 만들기", summary: "활성 보드를 렌더링한다." },
            en: { title: "Create screen", summary: "Render the main active board." },
          },
          priority: "high",
          status: "ready",
        },
      ],
    },
  });

  await expect(
    page.getByRole("heading", { name: "Implement onboarding" }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Implement onboarding" })
  ).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Create screen" })).toBeVisible();
  await expect(
    page.locator('[data-testid="kanban-card"][data-card-title="Create screen"][data-card-status="ready"]')
  ).toBeVisible();
  const readyProgress = Number(
    await page.getByTestId("work-progress-bar").getAttribute("data-work-progress")
  );
  await page.request.post("/api/agent/activity", {
    data: {
      phase: "implement",
      title: "Screen in progress",
      message: "The card moved without a page reload.",
      cards: [{ title: "Create screen", status: "doing" }],
    },
  });
  await expect(
    page.locator('[data-testid="kanban-card"][data-card-title="Create screen"][data-card-status="doing"]')
  ).toBeVisible();
  await expect(
    page.locator('[data-card-plan-status="doing"][data-active-card="true"]')
  ).toHaveCount(1);
  await expect(
    page.locator('[data-testid="kanban-card"][data-card-status="doing"]')
  ).toHaveCount(1);
  await expect(page.getByTestId("current-focus-card")).toHaveAttribute(
    "data-active-focus",
    "true"
  );
  await expect(
    page.locator('[data-card-plan-status="doing"][data-active-card="true"]')
  ).toBeVisible();
  await expect(
    page.locator('[data-testid="kanban-card"][data-card-title="Create screen"]')
  ).toHaveClass(/kanban-card-active/);
  await expect
    .poll(async () =>
      Number(await page.getByTestId("work-progress-bar").getAttribute("data-work-progress"))
    )
    .toBeGreaterThan(readyProgress);
  await expect(page.getByText("Progress", { exact: true })).toBeVisible();
  await expect(page.getByText("Build", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Ready", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("High", { exact: true }).first()).toBeVisible();
  await expect(page.locator('[data-status-badge="ready"]').first()).toBeVisible();
  await expect(page.locator('[data-priority-badge="high"]').first()).toBeVisible();
  await expect(page.locator('[data-goal-status-badge="active"]').first()).toBeVisible();
  await expect(page.locator('[data-milestone-status-badge="active"]').first()).toBeVisible();

  await expect(page.getByPlaceholder(/Codex/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Run" })).toHaveCount(0);

  await expect(page.getByTestId("rubber-duck")).toBeVisible();
  await expect(page.locator("audio")).toHaveCount(0);
  const duckAsset = await page.evaluate(async () => {
    const blob = await fetch("/rubber-duck/rubber-duck-2d5.png").then((response) =>
      response.blob()
    );
    const image = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas context unavailable");
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const cornerIndexes = [
      0,
      canvas.width - 1,
      (canvas.height - 1) * canvas.width,
      canvas.width * canvas.height - 1,
    ];
    let borderTransparent = 0;
    let borderTotal = 0;
    let nonTransparent = 0;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const alpha = data[(y * canvas.width + x) * 4 + 3];
        if (alpha > 0) nonTransparent += 1;
        if (
          x < 4 ||
          y < 4 ||
          x >= canvas.width - 4 ||
          y >= canvas.height - 4
        ) {
          borderTotal += 1;
          if (alpha === 0) borderTransparent += 1;
        }
      }
    }
    return {
      cornerAlpha: cornerIndexes.map((index) => data[index * 4 + 3]),
      borderTransparentRatio: borderTransparent / borderTotal,
      nonTransparent,
    };
  });
  expect(duckAsset.cornerAlpha).toEqual([0, 0, 0, 0]);
  expect(duckAsset.borderTransparentRatio).toBe(1);
  expect(duckAsset.nonTransparent).toBeGreaterThan(1000);
  await page.request.post("/api/agent/suggestions", {
    data: {
      suggestions: [
        {
          keyword: "Tests",
          title: "Add coverage",
          summary: "Cover the new path.",
          detail: "A focused test protects the dashboard contract.",
          actionPrompt: "Add tests for the Rubber Duck suggestion path.",
          priority: "high",
        },
      ],
    },
  });
  await page.reload();
  await expect(page.getByTestId("duck-unread-badge")).toBeVisible();
  await page.getByRole("button", { name: "Open duck suggestions" }).click();
  await expect(page.getByTestId("duck-suggestion-chip")).toHaveText("Tests");
  await page.getByRole("button", { name: "Open duck suggestions" }).click();
  await expect(page.getByTestId("duck-suggestion-chip")).toHaveCount(0);
  await page.getByRole("button", { name: "Open duck suggestions" }).click();
  await expect(page.getByTestId("duck-suggestion-chip")).toHaveText("Tests");
  await page.getByTestId("duck-suggestion-chip").click();
  await expect(page.getByRole("heading", { name: "Add coverage" })).toBeVisible();
  await expect(page.getByText("A focused test protects the dashboard contract.")).toBeVisible();
  await page.getByRole("button", { name: "Copy prompt" }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("Add tests for the Rubber Duck suggestion path.");
  await expect(page.getByTestId("duck-unread-badge")).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Minimize duck" }).click();
  await expect(page.getByTestId("rubber-duck-minimized")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("rubber-duck-minimized")).toBeVisible();
  await page.getByTestId("rubber-duck-minimized").click();
  await expect(page.getByTestId("rubber-duck")).toBeVisible();

  await page.request.post("/api/agent/activity", {
    data: {
      phase: "result",
      title: "Archive ready",
      message: "Archive this board with its duck suggestion.",
      cards: [{ title: "Create screen", status: "done" }],
    },
  });
  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByRole("heading", { name: "Implement onboarding" }).first()).toBeVisible();
  await expect(page.getByText("Suggestions", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tests" }).click();
  await expect(page.getByRole("heading", { name: "Add coverage" })).toBeVisible();
  await page.getByRole("button", { name: "Copy prompt" }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("Add tests for the Rubber Duck suggestion path.");
  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Delete archive" }).last().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("No archived boards")).toBeVisible();

  await page.request.post("/api/agent/plan", {
    data: {
      task: "Clear archive smoke",
      title: "Clear archive smoke",
      replace: true,
      cards: [{ title: "Clearable card", status: "ready", priority: "medium" }],
    },
  });
  await page.request.post("/api/agent/activity", {
    data: {
      phase: "result",
      title: "Clear archive ready",
      message: "Create one archive for clear-all.",
      cards: [{ title: "Clearable card", status: "done" }],
    },
  });
  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByRole("heading", { name: "Clear archive smoke" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear all archives" }).click();
  await page.getByRole("button", { name: "Clear", exact: true }).click({ force: true });
  await expect(page.getByText("No archived boards")).toBeVisible();
  await page.getByRole("tab", { name: /Active/ }).click();

  await page.evaluate(() => {
    window.localStorage.setItem("vibe-duck-minimized", "0");
  });
  await page.request.post("/api/agent/suggestions", {
    data: {
      suggestions: [
        {
          keyword: "Clear",
          title: "Clear suggestions",
          actionPrompt: "Clear stale suggestions.",
          priority: "medium",
        },
      ],
    },
  });
  await page.reload();
  await page.locator('[data-testid="rubber-duck"] .duck-quack').click();
  await expect(page.getByTestId("duck-suggestion-chip")).toHaveText("Clear");
  await page.request.post("/api/agent/suggestions", {
    data: { suggestions: [] },
  });
  await page.reload();
  await page.locator('[data-testid="rubber-duck"] .duck-quack').click();
  await expect(page.getByTestId("duck-suggestion-chip")).toHaveCount(0);
  await expect(page.getByTestId("duck-idle-chip")).toBeVisible();

  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Activity" })).toBeVisible();
  await expect(page.getByText("Activities")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Inspector" }).click();
  await expect(page.getByRole("heading", { name: "Inspector" })).toBeVisible();

  await page.getByLabel("GitHub").click();
  await expect(page.getByText("Auth", { exact: true })).toBeVisible();

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
        en: { title: "Implement onboarding", task: "Implement onboarding" },
      },
      milestone: {
        title: "Current work",
        translations: {
          ko: { title: "현재 작업" },
          en: { title: "Current work" },
        },
      },
      cards: [
        {
          title: "Create screen",
          translations: {
            ko: { title: "화면 만들기" },
            en: { title: "Create screen" },
          },
          priority: "high",
          status: "ready",
        },
      ],
    },
  });
  await context.request.post("/api/agent/suggestions", {
    data: {
      suggestions: [
        {
          keyword: "Tests",
          title: "Add coverage",
          summary: "Cover the new path.",
          detail: "A focused test protects the dashboard contract.",
          actionPrompt: "Add tests.",
          priority: "high",
          translations: {
            ko: {
              keyword: "테스트",
              title: "커버리지 추가",
              summary: "새 경로를 검증한다.",
              detail: "집중 테스트로 대시보드 계약을 보호한다.",
              actionPrompt: "테스트를 추가해줘.",
            },
          },
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
  await page.getByRole("button", { name: "English" }).click();
  await expect(
    page.getByRole("heading", { name: "Implement onboarding" }).first()
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create screen" })).toBeVisible();
  await page.getByRole("button", { name: "자국어" }).click();
  await page.getByRole("button", { name: "러버덕 제안 열기" }).click();
  await expect(page.getByTestId("duck-suggestion-chip")).toHaveText("테스트");
  await page.getByTestId("duck-suggestion-chip").click();
  await expect(page.getByRole("heading", { name: "커버리지 추가" })).toBeVisible();

  await context.close();
});
