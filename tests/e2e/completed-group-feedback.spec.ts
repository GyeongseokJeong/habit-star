import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

test("normal view highlights only when a newly completed habit enters its fold", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T22:00:00+09:00"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "전체", exact: true }).click();

  const toggle = page.locator(".normal-done-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toHaveClass(/completion-nudge/);

  const card = page.locator(".normal-pending-list .habit-card").filter({
    has: page.getByRole("heading", { name: "독서 30분 & TOP 50 책장" }),
  });
  await card.getByRole("button", { name: "독서 30분 & TOP 50 책장 4점" }).click();

  // Feedback waits until the existing 700 ms held-completion period ends.
  await expect(card).toBeVisible();
  await expect(toggle).not.toHaveClass(/completion-nudge/);
  await expect(toggle).toHaveClass(/completion-nudge/, { timeout: 5000 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).not.toHaveClass(/completion-nudge/, { timeout: 4000 });

  // Revisiting a tab or reloading an existing completion never fakes feedback.
  await page.getByRole("tab", { name: "밤", exact: true }).click();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(toggle).not.toHaveClass(/completion-nudge/);
  await page.reload();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(toggle).not.toHaveClass(/completion-nudge/);

  // Unchecking a completed habit reduces the count; it must not glow.
  await toggle.click();
  const completedCard = page.locator(".normal-completed-list .habit-card").filter({
    has: page.getByRole("heading", { name: "독서 30분 & TOP 50 책장" }),
  });
  await completedCard.getByRole("button", { name: "독서 30분 & TOP 50 책장 4점" }).click();
  await expect(completedCard).toHaveCount(0, { timeout: 5000 });
  await expect(toggle).not.toHaveClass(/completion-nudge/);
});

test("compact view reuses the same short cue, with no forced expansion", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T22:00:00+09:00"));
  await page.addInitScript(() => localStorage.setItem("byeolharu_compact_view_v1", "1"));
  await page.goto("/");
  await expect(page.locator(".compact-habit-list")).toBeVisible();
  await page.getByRole("tab", { name: "전체", exact: true }).click();

  const toggle = page.locator(".compact-done-toggle");
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toHaveClass(/completion-nudge/);

  const row = page.locator(".compact-habit-group .compact-habit-card").filter({
    hasText: "독서 30분 & TOP 50 책장",
  });
  await row.locator(".compact-habit-row").click();
  await row.getByRole("button", { name: "독서 30분 & TOP 50 책장 3점" }).click();

  await expect(toggle).toHaveClass(/completion-nudge/, { timeout: 5000 });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).not.toHaveClass(/completion-nudge/, { timeout: 4000 });
});

test("successive completions restart the active fold animation without opening it", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T22:00:00+09:00"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "전체", exact: true }).click();

  const toggle = page.locator(".normal-done-toggle");
  const reading = page.locator(".normal-pending-list .habit-card").filter({
    has: page.getByRole("heading", { name: "독서 30분 & TOP 50 책장" }),
  });
  await reading.getByRole("button", { name: "독서 30분 & TOP 50 책장 4점" }).click();
  await expect(toggle).toHaveClass(/completion-nudge-1/, { timeout: 5000 });
  await expect(toggle).toHaveCSS("animation-name", "completed-group-nudge-1");

  // The next habit completes while the previous 1.1s cue is still active.
  const stretch = page.locator(".normal-pending-list .habit-card").filter({
    has: page.getByRole("heading", { name: "취침 전 스트레칭 10분" }),
  });
  await stretch.getByRole("button", { name: "취침 전 스트레칭 10분 5점" }).click();
  await expect(toggle).toHaveClass(/completion-nudge-2/, { timeout: 5000 });
  await expect(toggle).toHaveCSS("animation-name", "completed-group-nudge-2");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(toggle).not.toHaveClass(/completion-nudge/, { timeout: 4000 });
});

test("reduced-motion users receive no animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  const result = await page.evaluate(() => {
    const style = document.createElement("button");
    style.className = "normal-done-toggle completion-nudge completion-nudge-2";
    document.querySelector(".byeolharu")?.appendChild(style);
    const animation = getComputedStyle(style).animationName;
    style.remove();
    return animation;
  });
  expect(result).toBe("none");
});
