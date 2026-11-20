import { expect, test } from "@playwright/test";

async function setCompact(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "간편 보기" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "닫기" }).click();
}

test("all time tabs and calendar keep a consistent 16px content gap in both views", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();

  for (const mode of ["normal", "compact"]) {
    if (mode === "compact") await setCompact(page);
    for (const label of ["전체", "아침", "낮", "밤", "달력"]) {
      await page.getByRole("tab", { name: label, exact: true }).click();
      const distance = await page.evaluate(() => {
        const tabs = document.querySelector(".tabs")!.getBoundingClientRect();
        const panel = document.querySelector("#routine-panel")!.getBoundingClientRect();
        return panel.top - tabs.bottom;
      });
      expect(distance, `${mode} / ${label} spacing`).toBeGreaterThanOrEqual(15.5);
      expect(distance, `${mode} / ${label} spacing`).toBeLessThanOrEqual(16.5);
    }
  }
});

test("morning and day completion copy does not claim the whole day is finished", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "아침", exact: true }).click();
  await expect(page.locator(".normal-all-done")).toHaveText("아침 루틴을 모두 마쳤어요 ✨");
  await expect(page.locator(".normal-done-toggle")).toContainText("완료한 습관 2개");
  // The only seeded daytime habit is already completed: no duplicate preview.
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);

  await page.getByRole("tab", { name: "낮", exact: true }).click();
  await expect(page.locator(".normal-all-done")).toHaveText("낮 루틴을 모두 마쳤어요 ✨");
  await expect(page.locator(".normal-done-toggle")).toContainText("완료한 습관 1개");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".normal-all-done")).toHaveCount(0);

  await page.getByRole("tab", { name: "밤", exact: true }).click();
  const pending = page.locator(".normal-pending-list .habit-card");
  for (let remaining = await pending.count(); remaining > 0; remaining--) {
    const card = pending.first();
    const title = (await card.locator("h3").innerText()).trim();
    await card.getByRole("button", { name: title + " 4점" }).click();
    await expect(pending).toHaveCount(remaining - 1, { timeout: 5000 });
  }
  await expect(page.locator(".normal-all-done")).toHaveText("밤 루틴을 모두 마쳤어요 ✨");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".normal-all-done")).toHaveText("오늘의 실천을 모두 마쳤어요 ✨");
});

test("completed upcoming habits are hidden but remain in day and all completed folds", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "아침", exact: true }).click();
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);

  await page.getByRole("tab", { name: "낮", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  const completed = page.locator(".normal-completed-list .habit-card").first();
  const title = (await completed.locator("h3").innerText()).trim();
  await completed.getByRole("button", { name: title + " 4점" }).click();
  await expect(page.locator(".normal-pending-list .habit-card")).toHaveCount(1, { timeout: 5000 });

  await page.getByRole("tab", { name: "아침", exact: true }).click();
  const upcoming = page.locator(".upcoming-heading + .habit-grid .habit-card");
  await expect(upcoming).toHaveCount(1);
  await expect(upcoming.first()).not.toHaveClass(/is-completed/);
  await upcoming.first().getByRole("button", { name: title + " 4점" }).click();
  await expect(upcoming).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);

  await page.getByRole("tab", { name: "낮", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  await expect(page.locator(".normal-completed-list .habit-card").filter({ hasText: title })).toBeVisible();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  await expect(page.locator(".normal-completed-list .habit-card").filter({ hasText: title })).toBeVisible();
});

test("compact view uses scoped completion copy and keeps completed items folded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await setCompact(page);
  await page.getByRole("tab", { name: "아침", exact: true }).click();
  await expect(page.locator(".compact-all-done")).toHaveText("아침 루틴을 모두 마쳤어요 ✨");
  await expect(page.locator(".compact-done-toggle")).toContainText("완료한 습관 2개");
  await expect(page.locator(".compact-completed-list")).toHaveCount(0);
  await page.getByRole("tab", { name: "낮", exact: true }).click();
  await expect(page.locator(".compact-all-done")).toHaveText("낮 루틴을 모두 마쳤어요 ✨");
  await expect(page.locator(".compact-done-toggle")).toContainText("완료한 습관 1개");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".compact-all-done")).toHaveCount(0);
});
