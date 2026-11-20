import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  test(`weekly reflection opens from calendar and returns without overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
    await page.getByRole("tab", { name: "달력", exact: true }).click();
    await expect(page.getByRole("button", { name: "최근 7일 돌아보기" })).toBeVisible();
    await page.getByRole("button", { name: "최근 7일 돌아보기" }).click();
    await expect(page.getByRole("heading", { name: "최근 7일 돌아보기" })).toBeVisible();
    await expect(page.getByText("조금 더 기록이 쌓이면 알려드릴게요.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "달력으로 돌아가기" }).click();
    await expect(page.getByRole("tab", { name: "달력", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "최근 7일 돌아보기" })).toBeVisible();
  });
}

test("reflection respects light and dark theme and does not change guest history", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "달력", exact: true }).click();
  await page.getByRole("button", { name: "최근 7일 돌아보기" }).click();
  await expect(page.getByRole("heading", { name: "최근 7일 돌아보기" })).toBeVisible();
  await page.getByRole("button", { name: "다크 모드로 전환" }).click();
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
  await expect(page.getByRole("heading", { name: "최근 7일 돌아보기" })).toBeVisible();
  await page.getByRole("button", { name: "달력으로 돌아가기" }).click();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".metrics")).toBeVisible();
});
