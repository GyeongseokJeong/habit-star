import { expect, test } from "@playwright/test";
import { seedLegacyFiveHabits } from "./fixtures/legacy-five-habits";

for (const width of [320, 390, 430]) {
  test(`compact toggle has a small visual track with 44px+ touch target at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await page.getByRole("button", { name: "앱 설정", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "간편 보기" });
    const track = toggle.locator(".compact-switch-track");
    const thumb = track.locator(".compact-switch-thumb");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    const geometry = await toggle.evaluate((el) => {
      const button = el.getBoundingClientRect();
      const t = el.querySelector(".compact-switch-track")!.getBoundingClientRect();
      return { touch: [button.width, button.height], track: [t.width, t.height], centered: Math.abs(t.x + t.width / 2 - button.x - button.width / 2) < 1 };
    });
    expect(geometry.touch[0]).toBeGreaterThanOrEqual(44);
    expect(geometry.touch[1]).toBeGreaterThanOrEqual(44);
    expect(geometry.track[0]).toBe(44);
    expect(geometry.track[1]).toBe(26);
    expect(geometry.centered).toBe(true);
    const before = await thumb.evaluate((el) => getComputedStyle(el).transform);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => thumb.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("normal and compact views share completed group behavior without changing records", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();

  const pending = page.locator(".normal-pending-list .habit-card").first();
  await expect(pending).toBeVisible();
  const name = (await pending.locator("h3").innerText()).trim();
  await pending.getByRole("button", { name: name + " 4점" }).click();
  const group = page.locator(".normal-completed-group");
  await expect(group).toBeVisible();
  await expect(group.locator(".normal-done-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".normal-completed-list")).toHaveCount(0);
  await group.locator(".normal-done-toggle").click();
  await expect(group.locator(".normal-completed-list .habit-card").filter({ hasText: name })).toBeVisible();
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "간편 보기" });
  await toggle.click();
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.locator(".compact-done-toggle")).toBeVisible();
  await page.locator(".compact-done-toggle").click();
  const finished = page.locator(".compact-completed-list .compact-habit-card").filter({ hasText: name });
  await expect(finished).toBeVisible();
  await finished.locator(".compact-habit-row").click();
  await finished.getByRole("button", { name: name + " 4점" }).click();
  await expect(page.locator(".compact-habit-group .compact-habit-card").filter({ hasText: name })).toBeVisible({ timeout: 5000 });
});

test("normal-view keyboard rating keeps focus when the completed card moves", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  const pending = page.locator(".normal-pending-list .habit-card").first();
  await expect(pending).toBeVisible();
  const name = (await pending.locator("h3").innerText()).trim();
  const star = pending.getByRole("button", { name: name + " 4점" });
  await star.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".normal-done-toggle")).toBeVisible({ timeout: 5000 });
  await expect.poll(() => page.evaluate(() => ({
    focused: document.activeElement !== document.body,
    connected: document.activeElement?.isConnected === true,
  }))).toEqual({ focused: true, connected: true });
});

test("completed reflection restores focus to the stable tab when its card folds", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "밤", exact: true }).click();
  const opener = page.locator(".normal-pending-list .habit-card .card-content").first();
  await expect(opener).toBeVisible();
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "오늘의 실천 기록" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "단순 체크만 하기" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".normal-done-toggle")).toBeVisible();
  await expect(page.getByRole("tab", { name: "밤", exact: true })).toBeFocused();
});

test("keyboard completing a current-period habit moves focus to its stable completed fold", async ({ page }) => {
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
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);
  const star = pending.first().getByRole("button", { name: title + " 4점" });
  await star.focus();
  await page.keyboard.press("Enter");
  await expect(pending).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".normal-done-toggle")).toBeFocused();
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);
});
