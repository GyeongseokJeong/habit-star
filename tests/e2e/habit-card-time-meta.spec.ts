import { expect, test } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`optional schedule time stays clear and contextual in ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
    if (theme === "dark") {
      const dark = page.getByRole("button", { name: "다크 모드로 전환" });
      if (await dark.isVisible()) await dark.click();
    }

    // A routine without a scheduled time still belongs to the night group.
    await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
    await editor.getByPlaceholder("예: 하루 10분 책 읽기").fill("시간 자유 습관");
    await editor.getByRole("button", { name: "밤", exact: true }).click();
    await expect(editor.getByLabel("예정 시간")).toHaveValue("");
    await editor.getByRole("button", { name: "새 습관 추가하기" }).click();

    await page.getByRole("tab", { name: "전체", exact: true }).click();
    const freeCard = page.locator(".habit-card").filter({
      has: page.getByRole("heading", { name: "시간 자유 습관" }),
    });
    await expect(freeCard).toBeVisible();
    await expect(freeCard.locator(".time-badge")).toHaveText("자유롭게밤 루틴");
    await expect(freeCard.locator(".time-badge svg")).toHaveCount(0);
    await expect(freeCard.locator(".status-pill")).toHaveCount(0);
    await expect(freeCard.locator(".star")).toHaveCount(5);

    await page.getByRole("tab", { name: "밤", exact: true }).click();
    await expect(freeCard.locator(".time-badge")).toHaveText("자유롭게");
    await expect(freeCard.locator(".time-badge svg")).toHaveCount(0);

    const scheduled = page.locator(".habit-card").filter({
      has: page.getByRole("heading", { name: "독서 30분 & TOP 50 책장" }),
    });
    await expect(scheduled).toBeVisible();
    await expect(scheduled.locator(".time-badge")).toHaveText("21:30");
    await expect(scheduled.locator(".time-badge svg")).toHaveCount(1);

    // A time-group label reappears only where it adds context.
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    await expect(scheduled.locator(".time-badge")).toHaveText("21:30밤 루틴");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
