import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`B4.4 normal mobile spacing ${width}px / ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
      if (theme === "dark") {
        const toggle = page.getByRole("button", { name: "다크 모드로 전환" });
        if (await toggle.isVisible()) await toggle.click();
      }
      await page.getByRole("tab", { name: "전체", exact: true }).click();
      const root = page.locator(".byeolharu");
      await expect(root).not.toHaveClass(/compact-view/);
      await expect(page.locator(".dashboard-layout")).toHaveCSS("margin-top", "16px");
      await expect(page.locator(".routine-heading")).toHaveCSS("margin-bottom", "12px");
      await expect(page.locator(".tabs + #routine-panel")).toHaveCSS("margin-top", "12px");
      await expect(page.locator(".normal-habit-list")).toHaveCSS("row-gap", "10px");
      await expect(page.locator(".normal-pending-list")).toHaveCSS("row-gap", "10px");
      await expect(page.locator(".normal-pending-list")).toHaveCSS("column-gap", "10px");

      const star = page.locator(".normal-pending-list .habit-card .star").first();
      await expect(star).toBeVisible();
      const starBox = await star.boundingBox();
      expect(starBox).not.toBeNull();
      expect(starBox!.width).toBeGreaterThanOrEqual(44);
      expect(starBox!.height).toBeGreaterThanOrEqual(44);
      const edit = page.locator(".normal-pending-list .habit-card .icon-button.small").first();
      const editBox = await edit.boundingBox();
      expect(editBox).not.toBeNull();
      expect(editBox!.width).toBeGreaterThanOrEqual(44);
      expect(editBox!.height).toBeGreaterThanOrEqual(44);
      await expect(page.locator(".closing-landscape")).toHaveCSS("height", "122px");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
}

test("B4.4 leaves the existing compact view density untouched", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("byeolharu_compact_view_v1", "1"));
  await page.goto("/");
  await expect(page.locator(".compact-habit-list")).toBeVisible();
  await expect(page.locator(".byeolharu")).toHaveClass(/compact-view/);
  await expect(page.locator(".dashboard-layout")).toHaveCSS("margin-top", "13px");
  await expect(page.locator(".routine-heading")).toHaveCSS("margin-bottom", "8px");
  await expect(page.locator(".compact-habit-list")).toHaveCSS("row-gap", "7px");
  await expect(page.locator(".tabs + #routine-panel")).toHaveCSS("margin-top", "16px");
  await expect(page.locator(".closing-footer")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("B4.4 changes no desktop spacing", async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await expect(page.locator(".dashboard-layout")).toHaveCSS("margin-top", "28px");
  await expect(page.locator(".routine-heading")).toHaveCSS("margin-bottom", "16px");
  await expect(page.locator(".tabs + #routine-panel")).toHaveCSS("margin-top", "16px");
  await expect(page.locator(".normal-habit-list")).toHaveCSS("row-gap", "12px");
});
