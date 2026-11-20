import { expect, test } from "@playwright/test";

async function setCompact(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "간편 보기" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "닫기" }).click();
}

for (const width of [320, 390, 430]) {
  test(`compact view reduces card height and persists settings at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    const oldCard = page.locator(".habit-card").first();
    await expect(oldCard).toBeVisible();
    const oldHeight = (await oldCard.boundingBox())!.height;
    await setCompact(page);
    await expect(page.locator(".habit-card")).toHaveCount(0);
    await expect(page.locator(".compact-metrics")).toBeVisible();
    await expect(page.locator(".metrics")).toHaveCount(0);
    await expect(page.locator(".closing-footer")).toBeHidden();
    const rows = page.locator(".compact-habit-row");
    await expect(rows.first()).toBeVisible();
    expect((await rows.first().boundingBox())!.height).toBeLessThan(oldHeight * .65);
    expect((await rows.first().boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.locator(".compact-done-toggle")).toBeVisible();
    await expect(page.locator(".compact-completed-list")).toHaveCount(0);
    await page.reload();
    await expect(page.locator(".compact-metrics")).toBeVisible();
    // A reload resets the manually chosen tab; startup may select the current
    // time-of-day tab after hydration. Explicitly return to All before checking
    // the saved compact preference and its completed-habit fold.
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator(".compact-done-toggle")).toBeVisible();
    await page.locator(".compact-done-toggle").click();
    await expect(page.locator(".compact-completed-list .compact-habit-card").first()).toBeVisible();
    await page.locator(".compact-done-toggle").click();
    await expect(page.locator(".compact-completed-list")).toHaveCount(0);
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await page.getByRole("button", { name: "앱 설정", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "간편 보기" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await page.getByRole("button", { name: "닫기" }).click();
    await expect(page.locator(".habit-card").first()).toBeVisible();
  });
}

test("compact rating reuses existing optimistic save, completion fold and cancel", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await setCompact(page);
  const pending = page.locator(".compact-habit-group .compact-habit-card").first();
  await expect(pending).toBeVisible();
  await pending.locator(".compact-habit-row").click();
  const title = (await pending.locator(".compact-habit-title").innerText()).trim();
  const four = pending.getByRole("button", { name: title + " 4점" });
  await expect(four).toBeVisible();
  await four.click();
  await expect(page.locator(".compact-habit-detail")).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator(".compact-done-toggle")).toContainText("완료한 습관");
  await page.locator(".compact-done-toggle").click();
  const finished = page.locator(".compact-completed-list .compact-habit-card").filter({
    has: page.locator(".compact-habit-title", { hasText: title }),
  });
  await expect(finished).toBeVisible();
  await expect(finished.locator(".compact-habit-row")).toHaveAttribute("aria-label", /실천 완료, 별점 4점/);
  await finished.locator(".compact-habit-row").click();
  await finished.getByRole("button", { name: title + " 4점" }).click();
  await expect(page.locator(".compact-habit-group .compact-habit-card").filter({
    has: page.locator(".compact-habit-title", { hasText: title }),
  })).toBeVisible({ timeout: 5000 });
});

test("keyboard focus survives compact rating collapse and completed-row move", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await setCompact(page);
  const pending = page.locator(".compact-habit-group .compact-habit-card").first();
  await expect(pending).toBeVisible();
  await pending.locator(".compact-habit-row").click();
  const title = (await pending.locator(".compact-habit-title").innerText()).trim();
  const star = pending.getByRole("button", { name: title + " 4점" });
  await star.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".compact-habit-detail")).toHaveCount(0, { timeout: 5000 });
  await expect.poll(() => page.evaluate(() => ({
    focused: document.activeElement !== document.body,
    connected: document.activeElement?.isConnected === true,
  }))).toEqual({ focused: true, connected: true });
  const focused = await page.evaluate(() => document.activeElement?.className);
  expect(String(focused)).toMatch(/compact-habit-row|selected/);
});
