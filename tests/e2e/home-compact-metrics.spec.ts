import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`home summary and calendar remain compact at ${width}px in ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ width, height: 780 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
      if (theme === "dark") {
        const toggle = page.getByRole("button", { name: "다크 모드로 전환" });
        if (await toggle.isVisible()) await toggle.click();
      }

      const metrics = page.getByRole("region", { name: "오늘의 통계" });
      await expect(metrics).toBeVisible();
      await expect(metrics.getByText("오늘의 실천")).toBeVisible();
      await expect(metrics.getByText("평균 별점")).toBeVisible();
      await expect(metrics.getByText("연속 실천")).toBeVisible();
      await expect(metrics.locator(".metric-star")).toHaveCount(1);
      const metricBoxes = await metrics.locator(".metric").evaluateAll((elements) =>
        elements.map((element) => {
          const bounds = element.getBoundingClientRect();
          return { x: bounds.x, width: bounds.width, height: bounds.height };
        }),
      );
      expect(metricBoxes).toHaveLength(3);
      expect(Math.max(...metricBoxes.map((item) => item.width)) -
        Math.min(...metricBoxes.map((item) => item.width))).toBeLessThanOrEqual(1);
      expect(Math.max(...metricBoxes.map((item) => item.height)) -
        Math.min(...metricBoxes.map((item) => item.height))).toBeLessThanOrEqual(1);
      const metricsBounds = await metrics.boundingBox();
      expect(metricsBounds).not.toBeNull();
      expect(metricsBounds!.height).toBeLessThanOrEqual(90);
      expect(metricsBounds!.height).toBeGreaterThanOrEqual(70);

      const add = page.getByRole("button", { name: "새 습관 추가", exact: true });
      const addBounds = await add.boundingBox();
      expect(addBounds).not.toBeNull();
      expect(addBounds!.height).toBeGreaterThanOrEqual(44);
      await expect(add).toHaveCSS("background-color", await page.locator(".metrics").evaluate((el) =>
        getComputedStyle(el).backgroundColor,
      ));

      const tabs = page.getByRole("tablist", { name: "시간대별 루틴" });
      await expect(tabs.getByRole("tab")).toHaveCount(5);
      const calendar = tabs.getByRole("tab", { name: "달력", exact: true });
      const tabBounds = await calendar.boundingBox();
      expect(tabBounds).not.toBeNull();
      expect(tabBounds!.height).toBeGreaterThanOrEqual(44);
      await expect(tabs.getByRole("tab", { name: /별점 매트릭스/ })).toHaveCount(0);
      await calendar.click();
      await expect(calendar).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("heading", { name: "차곡차곡 쌓인 나의 별" })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
  }
}
