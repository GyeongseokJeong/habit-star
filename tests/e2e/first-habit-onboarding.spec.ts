import { expect, test } from "@playwright/test";
test.use({ timezoneId: "Asia/Seoul" });

for (const width of [320, 390, 430]) {
  for (const dark of [false, true]) {
    test("first-use at " + width + "px " + (dark ? "dark" : "light"), async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
      if (dark) await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      await page.getByRole("tab", { name: "전체", exact: true }).click();
      await expect(page.locator(".first-habit-hint")).toBeVisible();
      await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toHaveCount(1);
      await expect(page.locator(".habit-sample-badge").first()).toHaveText("예시");
      await expect(page.locator(".metrics")).toBeVisible();
      await expect(page.locator(".tabs [role=tab]")).toHaveCount(5);
      await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
      await editor.getByRole("button", { name: "독서 20분 템플릿" }).click();
      await expect(editor.getByPlaceholder("예: 하루 10분 책 읽기")).toHaveValue("독서 20분");
      await editor.getByRole("button", { name: "새 습관 추가하기" }).click();
      await expect(editor).toHaveCount(0);
      await expect(page.locator(".first-habit-hint")).toHaveCount(0);
      const card = page.locator(".habit-card").filter({
        has: page.getByRole("heading", { name: "독서 20분", exact: true }),
      });
      await expect(card).toBeVisible();
      await expect(card.locator(".habit-sample-badge")).toHaveCount(0);
      await expect(card.locator(".star-tray button")).toHaveCount(5);
      await card.getByRole("button", { name: "독서 20분 3점" }).click();
      await expect(page.locator(".normal-done-toggle")).toHaveAttribute("aria-expanded", "false");
      await expect(card.locator(".habit-first-practice")).toHaveText("첫 실천이에요! 작은 시작이 빛나요.");
      await expect(card.getByRole("button", { name: "독서 20분 3점" })).toHaveAttribute("aria-pressed", "true");
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await page.reload();
      await page.getByRole("tab", { name: "전체", exact: true }).click();
      await expect(page.locator(".first-habit-hint, .habit-first-practice")).toHaveCount(0);
      await expect(page.locator(".habit-sample-badge").first()).toHaveText("예시");
    });
  }
}
test("rating a seeded example is not a first real practice", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  const sample = page.locator(".habit-card").filter({
    has: page.getByRole("heading", { name: "독서 30분 & TOP 50 책장" }),
  });
  await expect(sample.locator(".habit-sample-badge")).toBeVisible();
  await sample.getByRole("button", { name: "독서 30분 & TOP 50 책장 3점" }).click();
  await expect(page.locator(".habit-first-practice")).toHaveCount(0);
});

test("detail-first completion never strands keyboard focus when its card folds", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const create = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await create.getByPlaceholder("예: 하루 10분 책 읽기").fill("키보드 첫 실천");
  await create.getByRole("button", { name: "새 습관 추가하기" }).click();
  const card = page.locator(".habit-card").filter({
    has: page.getByRole("heading", { name: "키보드 첫 실천", exact: true }),
  });
  await card.locator(".card-content").focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog", { name: "오늘의 실천 기록" });
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "단순 체크만 하기" }).click();
  await expect(detail).toHaveCount(0);
  await expect(card.locator(".habit-first-practice")).toBeVisible();
  // The standard completed group stays collapsed, but the focus must not
  // fall through to body once the held card moves after its brief cue.
  await expect(card).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".normal-done-toggle")).toHaveAttribute("aria-expanded", "false");
  const active = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    focused: document.activeElement?.id,
  }));
  expect(active.tag).not.toBe("BODY");
  expect(active.tag).toBe("BUTTON");
});

test("compact example label is announced to assistive technology", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("byeolharu_compact_view_v1", "1"));
  await page.goto("/");
  await expect(page.locator(".compact-habit-list")).toBeVisible();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  const row = page.locator(".compact-habit-row").filter({ hasText: "독서 30분 & TOP 50 책장" });
  await expect(row).toHaveAttribute("aria-label", /독서 30분 & TOP 50 책장, 예시 습관/);
  await expect(row.locator(".compact-sample-badge")).toHaveText("예시");
});

test("first-use hint can be dismissed without changing habits, even after reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".first-habit-hint")).toBeVisible();
  const cardsBefore = await page.locator(".habit-card").count();
  await page.getByRole("button", { name: "시작 안내 닫기" }).click();
  await expect(page.locator(".first-habit-hint")).toHaveCount(0);
  await expect(page.locator(".habit-card")).toHaveCount(cardsBefore);
  await page.reload();
  await expect(page.locator(".first-habit-hint")).toHaveCount(0);
});

test("a seeded example interaction does not suppress the first real habit invitation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".first-habit-hint")).toBeVisible();
  const sample = page.locator(".habit-card").filter({
    has: page.getByRole("heading", { name: "독서 30분 & TOP 50 책장" }),
  });
  await sample.getByRole("button", { name: "독서 30분 & TOP 50 책장 3점" }).click();
  await expect(page.locator(".first-habit-hint")).toBeVisible();
});

test("first actual completion stays visible before fold and never celebrates again after undo", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await editor.getByPlaceholder("예: 하루 10분 책 읽기").fill("첫 기록 유지");
  await editor.getByRole("button", { name: "새 습관 추가하기" }).click();
  const card = page.locator(".habit-card").filter({
    has: page.getByRole("heading", { name: "첫 기록 유지", exact: true }),
  });
  await card.getByRole("button", { name: "첫 기록 유지 3점" }).click();
  await expect(card.locator(".habit-first-practice")).toBeVisible();
  // At 2 seconds the message must still be on a visible card, not hidden
  // inside a collapsed completed group as in the previous implementation.
  await page.waitForTimeout(2000);
  await expect(card).toBeVisible();
  await expect(card.locator(".habit-first-practice")).toBeVisible();
  await expect(card).toHaveCount(0, { timeout: 5000 });
  await page.getByRole("button", { name: /완료한 습관 1개/ }).click();
  const completed = page.locator(".normal-completed-list .habit-card").filter({
    has: page.getByRole("heading", { name: "첫 기록 유지", exact: true }),
  });
  await completed.getByRole("button", { name: "첫 기록 유지 3점" }).click();
  const pending = page.locator(".normal-pending-list .habit-card").filter({
    has: page.getByRole("heading", { name: "첫 기록 유지", exact: true }),
  });
  await expect(pending).toBeVisible();
  await pending.getByRole("button", { name: "첫 기록 유지 3점" }).click();
  await expect(page.locator(".habit-first-practice")).toHaveCount(0);
});

test("first practice also works in compact mode and preserves the collapsed group", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
  await page.addInitScript(() => localStorage.setItem("byeolharu_compact_view_v1", "1"));
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await editor.getByPlaceholder("예: 하루 10분 책 읽기").fill("간편 첫 실천");
  await editor.getByRole("button", { name: "새 습관 추가하기" }).click();
  const compact = page.locator(".compact-habit-card").filter({ hasText: "간편 첫 실천" });
  await compact.locator(".compact-habit-row").click();
  await compact.getByRole("button", { name: "간편 첫 실천 3점" }).click();
  await expect(compact.locator(".habit-first-practice")).toBeVisible();
  await page.waitForTimeout(2000);
  await expect(compact.locator(".habit-first-practice")).toBeVisible();
  await expect(page.locator(".compact-done-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(compact).toHaveCount(0, { timeout: 5000 });
});

test("a habit scheduled for another weekday explains why it is absent today", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await editor.getByPlaceholder("예: 하루 10분 책 읽기").fill("내일만 실행");
  // Friday 2026-11-20 is weekday 5; use a Saturday-only routine.
  for (const label of ["월요일", "화요일", "수요일", "목요일", "금요일", "일요일"]) {
    const day = editor.getByRole("button", { name: label, exact: true });
    if (await day.getAttribute("aria-pressed") === "true") await day.click();
  }
  await editor.getByRole("button", { name: "새 습관 추가하기" }).click();
  await expect(page.getByText(/선택한 반복 요일에 표시돼요/)).toBeVisible();
  await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
});
