import { expect, test } from "@playwright/test";

// Keep local day and time-group boundaries stable on CI.
test.use({ timezoneId: "Asia/Seoul" });

for (const width of [320, 390]) {
  test(`prior-only reminder and no next-preview at ${width}px`, async ({ page }) => {
    await page.clock.install({ time: new Date("2026-11-19T15:00:00+09:00") });
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
    await editor.getByPlaceholder("예: 하루 10분 책 읽기").fill("아침 미완료 검증");
    await editor.getByRole("button", { name: "아침", exact: true }).click();
    await editor.getByRole("button", { name: "새 습관 추가하기" }).click();

    await page.getByRole("tab", { name: "아침", exact: true }).click();
    await expect(page.locator(".upcoming-heading, .earlier-pending-link")).toHaveCount(0);

    await page.getByRole("tab", { name: "낮", exact: true }).click();
    const shortcut = page.locator(".earlier-pending-link");
    await expect(shortcut).toBeVisible();
    await expect(shortcut).toContainText("다른 시간대에 남은 습관");
    await expect(shortcut).toContainText("1개");
    await expect(shortcut).toContainText("전체 보기");
    await expect(page.locator(".upcoming-heading")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await shortcut.click();
    await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
    const card = page.locator(".habit-card").filter({ has: page.getByRole("heading", { name: "아침 미완료 검증" }) });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "아침 미완료 검증 3점" }).click();

    await page.getByRole("tab", { name: "낮", exact: true }).click();
    await expect(page.locator(".earlier-pending-link, .upcoming-heading")).toHaveCount(0);
  });
}

test("compact view reuses the same shortcut without duplicating cards", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-19T15:00:00+09:00") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await editor.getByPlaceholder("예: 하루 10분 책 읽기").fill("아침에서 남은 습관");
  await editor.getByRole("button", { name: "아침", exact: true }).click();
  await editor.getByRole("button", { name: "새 습관 추가하기" }).click();

  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  await page.getByRole("switch", { name: "간편 보기" }).click();
  await page.getByRole("button", { name: "내 계정으로" }).click();
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "낮", exact: true }).click();
  const shortcut = page.locator(".earlier-pending-link");
  await expect(shortcut).toBeVisible();
  await expect(shortcut).toContainText("1개");
  await expect(page.locator(".upcoming-heading, .habit-card")).toHaveCount(0);
  await shortcut.click();
  await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
});
