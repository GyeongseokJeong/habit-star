import { expect, test } from "@playwright/test";

for (const variant of ["baseline", "declared", "optout"] as const) {
  test(`force dark probe ${variant} exposes a consistent B2 sample without data writes`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/diagnostics/force-dark/${variant}`);
    await expect(page.getByRole("heading", { name: "웹페이지 강제 다크 A/B/C" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "강제 다크 실험 전환" }).getByRole("link")).toHaveCount(3);
    await expect(page.locator("[data-experiment-day='0']")).toHaveCSS("background-color", "rgb(46, 60, 79)");
    await expect(page.locator("[data-experiment-day='3']")).toHaveCSS("background-color", "rgb(128, 104, 71)");
    await expect(page.locator("[data-experiment-day='disabled']")).toHaveCSS("opacity", "1");
    await expect.poll(async () => JSON.parse(await page.locator("[data-force-dark-report]").innerText())?.htmlScheme).not.toBeNull();
    const report = JSON.parse(await page.locator("[data-force-dark-report]").innerText());
    expect(report.page.background).toBe("rgb(17, 25, 37)");
    expect(report.panel.background).toBe("rgb(32, 44, 61)");
    if (variant === "baseline") {
      expect(report.metaScheme).toBeNull();
      expect(report.htmlScheme).toBe("light");
      expect(report.appScheme).toBe("dark");
    } else if (variant === "declared") {
      expect(report.metaScheme).toBe("light dark");
      expect(report.htmlScheme).toBe("light dark");
      expect(report.appScheme).toBe("dark");
    } else {
      expect(report.metaScheme).toBe("light dark");
      expect(report.htmlScheme).toMatch(/light only|only light/);
      expect(report.appScheme).toMatch(/light only|only light/);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("force dark probes remain linked with keyboard and focus", async ({ page }) => {
  await page.goto("/diagnostics/force-dark/baseline");
  const link = page.getByRole("link", { name: "B · 테마 지원 명시" });
  await link.focus();
  await expect(link).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/diagnostics\/force-dark\/declared$/);
});
