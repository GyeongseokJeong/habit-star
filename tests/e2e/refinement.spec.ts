import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1365, height: 1000 },
]) {
  test(`emoji pixels, picker and responsive themes at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    await page.locator(".normal-done-toggle").click();
    await expect(
      page.getByRole("heading", { name: "미온수 한 잔 & 영양제", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("별하루를 더 가까이", { exact: true }),
    ).toHaveCount(0);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      await expect(page.locator(`.byeolharu.${theme}`)).toBeVisible();
      const result = await page.evaluate(async () => {
        await document.fonts.ready;
        const icons = [
          ...document.querySelectorAll<HTMLElement>(".habit-emoji"),
        ];
        const pixels = icons.map((icon) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 80;
          const context = canvas.getContext("2d")!;
          context.font = `40px ${getComputedStyle(icon).fontFamily}`;
          context.fillText(icon.textContent!, 0, 50);
          return [...context.getImageData(0, 0, 80, 80).data].filter(
            (v, i) => i % 4 === 3 && v > 0,
          ).length;
        });
        return {
          pixels,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(result.overflow).toBe(false);
      expect(result.pixels).toHaveLength(5);
      expect(result.pixels.every((count) => count > 100)).toBe(true);
    }
    await page
      .getByRole("button", { name: "새 습관 추가", exact: true })
      .click();
    await expect(page.locator(".emoji-picker button")).toHaveCount(12);
    await page.getByRole("button", { name: "🌱 아이콘", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "🌱 아이콘", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByPlaceholder("예: 하루 10분 책 읽기")
      .fill("아이콘 보존 확인");
    await page
      .getByRole("button", { name: "새 습관 추가하기", exact: true })
      .click();
    const card = page.locator(".habit-card").filter({
      has: page.getByRole("heading", {
        name: "아이콘 보존 확인",
        exact: true,
      }),
    });
    await expect(card.locator(".habit-emoji")).toHaveText("🌱");
    await page.reload();
    await expect(card.locator(".habit-emoji")).toHaveText("🌱");
  });
}

test("normal view groups completed habits below pending and preserves their order and undo", async ({ page }) => {
  await page.setViewportSize({ width: 395, height: 595 });
  await page.goto("/");
  const pendingTitles = () =>
    page.locator(".normal-pending-list .habit-card h3").allTextContents();
  const completedTitles = () =>
    page.locator(".normal-completed-list .habit-card h3").allTextContents();
  const book = "독서 30분 & TOP 50 책장";
  const stretch = "취침 전 스트레칭 10분";
  const morning = ["미온수 한 잔 & 영양제", "아침 가벼운 러닝 20분"];
  const lunch = "건강한 점심 & 가벼운 산책";

  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect.poll(pendingTitles).toEqual([book, stretch]);
  await page.getByRole("tab", { name: "밤", exact: true }).click();
  await expect.poll(pendingTitles).toEqual([book, stretch]);

  await page.getByRole("button", { name: `${book} 1점` }).click();
  await expect.poll(pendingTitles).toEqual([stretch]);
  const fold = page.locator(".normal-done-toggle");
  await expect(fold).toContainText("완료한 습관 1개");
  await expect(fold).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".normal-completed-list")).toHaveCount(0);
  await fold.click();
  await expect.poll(completedTitles).toEqual([book]);

  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect.poll(pendingTitles).toEqual([stretch]);
  await expect(page.locator(".normal-completed-list")).toHaveCount(0);
  await page.locator(".normal-done-toggle").click();
  await expect.poll(completedTitles).toEqual([...morning, lunch, book]);

  await page.reload();
  await page.getByRole("tab", { name: "밤", exact: true }).click();
  await expect.poll(pendingTitles).toEqual([stretch]);
  await expect(page.locator(".normal-done-toggle")).toBeVisible();
  await page.locator(".normal-done-toggle").click();
  await page.getByRole("button", { name: `${book} 1점` }).click();
  await expect.poll(pendingTitles).toEqual([book, stretch]);
  await expect(page.locator(".normal-done-toggle")).toHaveCount(0);
});

test("the three home metrics reflect rating, completion and undo without changing the stage teaser", async ({ page }) => {
  await page.setViewportSize({ width: 395, height: 595 });
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  const hero = page.getByRole("region", { name: "나의 별자리 미리보기" });
  const metrics = page.getByRole("region", { name: "오늘의 통계" });
  await expect(hero).toContainText("첫 번째 별빛");
  await expect(metrics.locator(".metric")).toHaveCount(3);
  await expect(metrics.locator(".completion-metric .metric-value")).toHaveText("3/ 5");
  await expect(metrics).not.toContainText("실천율");

  await page.getByRole("button", { name: "독서 30분 & TOP 50 책장 1점" }).click();
  await expect(metrics.locator(".completion-metric .metric-value")).toHaveText("4/ 5");
  await expect(hero).not.toContainText("4 / 5");
  await page.getByRole("button", { name: "취침 전 스트레칭 10분 1점" }).click();
  await expect(metrics.locator(".completion-metric .metric-value")).toHaveText("5/ 5");
  await page.locator(".normal-done-toggle").click();
  await page.getByRole("button", { name: "독서 30분 & TOP 50 책장 1점" }).click();
  await expect(metrics.locator(".completion-metric .metric-value")).toHaveText("4/ 5");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("새로운 작은 습관");
  await page.getByRole("button", { name: "새 습관 추가하기", exact: true }).click();
  await expect(metrics.locator(".completion-metric .metric-value")).toHaveText("4/ 6");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(395);
});

for (const width of [320, 395]) {
  test(`mobile matrix tiles fit their seven columns at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 549 });
    await page.goto("/");
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    await page.locator(".normal-done-toggle").click();
    await expect(
      page.getByRole("heading", { name: "미온수 한 잔 & 영양제" }),
    ).toBeVisible();

    for (const theme of ["light", "dark"]) {
      if (theme === "dark") {
        const themeButton = page.getByRole("button", {
          name: "다크 모드로 전환",
        });
        await themeButton.focus();
        await page.keyboard.press("Enter");
      }
      await page.getByRole("tab", { name: "달력" }).click();
      await expect(
        page.getByRole("heading", { name: "차곡차곡 쌓인 나의 별 5" }),
      ).toBeVisible();
      const dimensions = await page.evaluate(() => {
        const grid = document.querySelector(".expanded .calendar-grid.days")!;
        const tiles = [...grid.querySelectorAll(".day-tile")];
        const columnWidth = grid.getBoundingClientRect().width / 7;
        return {
          columnWidth,
          widestTile: Math.max(
            ...tiles.map((tile) => tile.getBoundingClientRect().width),
          ),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(dimensions.widestTile).toBeLessThanOrEqual(dimensions.columnWidth);
      expect(dimensions.overflow).toBe(false);
      await expect(
        page.getByRole("tab", { name: "달력" }),
      ).toContainText("달력");
      await expect(page.locator(".matrix-panel")).toHaveCount(1);
      const closing = page.locator(".closing-footer");
      await expect(closing).toContainText("꾸준함은 완벽함보다 빛나요.");
      await expect(closing.locator(".closing-copy p")).toBeVisible();
      await expect(page.locator(".little-note, .gentle-note, .site-footer")).toHaveCount(0);
      await expect
        .poll(() => closing.evaluate((footer) => footer.getBoundingClientRect().height))
        .toBeLessThan(190);
      await page.getByRole("tab", { name: "전체" }).click();
      await expect(page.locator(".matrix-panel")).toHaveCount(0);
    }
  });
}

test("time-of-day tabs update their heading and visible habit count", async ({
  page,
}) => {
  await page.setViewportSize({ width: 395, height: 549 });
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  await expect(
    page.getByRole("heading", { name: "미온수 한 잔 & 영양제" }),
  ).toBeVisible();
  for (const [tab, heading, count] of [
    ["아침", "나의 아침 루틴", "2"],
    ["낮", "나의 낮 루틴", "1"],
    ["밤", "나의 밤 루틴", "2"],
    ["전체", "나의 데일리 루틴", "5"],
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await expect(page.locator(".routine-heading h2")).toContainText(heading);
    await expect(page.locator(".routine-heading h2 > span")).toHaveText(count);
    await expect(page.locator(".matrix-panel")).toHaveCount(0);
    await expect(
      page.getByRole("tab", { name: tab, exact: true }),
    ).toHaveAttribute("aria-selected", "true");
  }
});

test("legacy custom emoji remains selected without changing the original", async ({
  page,
}) => {
  const raw = JSON.stringify([
    {
      id: "legacy-icon",
      title: "나만의 이모지",
      icon: "🦉",
      timeGroup: "night",
      completed: false,
      rating: 0,
      memo: "남겨둔 메모",
      alarmEnabled: false,
    },
  ]);
  await page.addInitScript((raw) => {
    localStorage.setItem("byeolharu_v1_habits", raw);
    localStorage.setItem("byeolharu_v1_day", "2026-01-01");
  }, raw);
  await page.goto("/");
  await page
    .getByRole("button", { name: "나만의 이모지 수정", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "🦉 아이콘", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "수정 완료", exact: true }).click();
  await expect(page.locator(".habit-emoji").first()).toHaveText("🦉");
  expect(
    await page.evaluate(() => localStorage.getItem("byeolharu_v1_habits")),
  ).toBe(raw);
});

test("install action is only in settings when a real prompt is available", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  await expect(
    page.getByRole("heading", { name: "미온수 한 잔 & 영양제", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: async () => {
        document.body.dataset.installPrompt = "opened";
      },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  });
  await expect(
    page.getByRole("button", { name: "별하루 앱 설치" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  await page
    .getByRole("button", { name: "별하루 앱 설치", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-install-prompt",
    "opened",
  );
  await expect(
    page.getByRole("button", { name: "별하루 앱 설치", exact: true }),
  ).toHaveCount(0);
});

test("auth tabs, password visibility, resend cooldown and reset preserve existing endpoints", async ({
  page,
}) => {
  await page.route("http://127.0.0.1:54321/**", (route) => route.abort());
  let resends = 0;
  await page.route("**/auth/v1/resend**", (route) => {
    resends++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.route("**/auth/v1/recover**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(page.getByRole("heading", { name: "별하루에 오신 걸 환영해요" })).toBeVisible();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await page
    .getByRole("button", { name: "비밀번호 표시", exact: true })
    .click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByLabel("이메일", { exact: true })
    .fill("ui-check@example.test");
  await page
    .getByRole("button", { name: "인증 메일이 오지 않았나요?" })
    .click();
  await expect(page.getByLabel("인증받을 이메일")).toHaveValue(
    "ui-check@example.test",
  );
  await page
    .getByRole("button", { name: "인증 메일 다시 보내기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /초 후 재발송 가능/ }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("이메일을 확인해주세요");
  expect(resends).toBe(1);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page
    .getByRole("button", { name: "비밀번호 찾기", exact: true })
    .click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveCount(0);
  await page.getByLabel("이메일", { exact: true }).fill("ui-check@example.test");
  await page
    .getByRole("button", { name: "재설정 메일 보내기", exact: true })
    .click();
  await expect(page.getByText("메일을 확인해주세요", { exact: true })).toBeVisible();
});
