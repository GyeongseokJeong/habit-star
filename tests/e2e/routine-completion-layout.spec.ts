import { expect, test } from "@playwright/test";
import { seedLegacyFiveHabits } from "./fixtures/legacy-five-habits";

async function setCompact(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "간편 보기" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "닫기" }).click();
}

test("all time tabs and calendar keep each view’s approved content gap", async ({ page }) => {
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
      // B4.4 tightens only the normal mobile view; compact keeps its 16px rhythm.
      const expected = mode === "normal" ? 12 : 16;
      expect(distance, `${mode} / ${label} spacing`).toBeGreaterThanOrEqual(expected - 0.5);
      expect(distance, `${mode} / ${label} spacing`).toBeLessThanOrEqual(expected + 0.5);
    }
  }
});

test("morning and day completion copy does not claim the whole day is finished", async ({ page }) => {
  await seedLegacyFiveHabits(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "아침", exact: true }).click();
  await expect(page.locator(".routine-completion-card")).toHaveText("아침 루틴을 모두 마쳤어요");
  await expect(page.locator(".routine-completion-card")).toHaveCSS("border-top-style", "dashed");
  await expect(page.locator(".routine-completion-card")).toHaveCSS("min-height", "88px");
  await expect(page.locator(".normal-done-toggle")).toContainText("완료한 습관 2개");
  // The only seeded daytime habit is already completed: no duplicate preview.
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);

  await page.getByRole("tab", { name: "낮", exact: true }).click();
  await expect(page.locator(".routine-completion-card")).toHaveText("낮 루틴을 모두 마쳤어요");
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
  await expect(page.locator(".routine-completion-card")).toHaveText("밤 루틴을 모두 마쳤어요");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".normal-all-done")).toHaveText("오늘의 실천을 모두 마쳤어요 ✨");
});

test("other-period cards stay hidden while their records remain in day and all folds", async ({ page }) => {
  await seedLegacyFiveHabits(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "낮", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  const completed = page.locator(".normal-completed-list .habit-card").first();
  const title = (await completed.locator("h3").innerText()).trim();
  await completed.getByRole("button", { name: title + " 4점" }).click();
  const pending = page.locator(".normal-pending-list .habit-card");
  await expect(pending).toHaveCount(1, { timeout: 5000 });

  await page.getByRole("tab", { name: "아침", exact: true }).click();
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: title, exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: "낮", exact: true }).click();
  const dayCard = page.locator(".normal-pending-list .habit-card").filter({ hasText: title });
  await expect(dayCard).toBeVisible();
  await dayCard.getByRole("button", { name: title + " 4점" }).click();
  await expect(pending).toHaveCount(0, { timeout: 5000 });
  await page.locator(".normal-done-toggle").click();
  await expect(page.locator(".normal-completed-list .habit-card").filter({ hasText: title })).toBeVisible();

  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  await expect(page.locator(".normal-completed-list .habit-card").filter({ hasText: title })).toBeVisible();
});

test("compact view uses scoped completion copy and keeps completed items folded", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLegacyFiveHabits(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await setCompact(page);
  await page.getByRole("tab", { name: "아침", exact: true }).click();
  await expect(page.locator(".routine-completion-card")).toHaveText("아침 루틴을 모두 마쳤어요");
  await expect(page.locator(".compact-done-toggle")).toContainText("완료한 습관 2개");
  await expect(page.locator(".compact-completed-list")).toHaveCount(0);
  await page.getByRole("tab", { name: "낮", exact: true }).click();
  await expect(page.locator(".routine-completion-card")).toHaveText("낮 루틴을 모두 마쳤어요");
  await expect(page.locator(".compact-done-toggle")).toContainText("완료한 습관 1개");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".compact-all-done")).toHaveCount(0);
});
