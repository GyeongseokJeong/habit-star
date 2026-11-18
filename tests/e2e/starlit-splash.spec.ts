import { expect, test } from "@playwright/test";

test("installed PWA starts with the concise Starlit Night branding", async ({
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe("별하루");
  expect(manifest.short_name).toBe("별하루");
  expect(manifest.background_color.toLowerCase()).toBe("#19242a");
  expect(manifest.theme_color.toLowerCase()).toBe("#19242a");
  expect(manifest.display).toBe("standalone");
});

for (const theme of ["light", "dark"] as const) {
  test(`saved ${theme} theme is restored without a mismatched page background`, async ({
    page,
  }) => {
    await page.addInitScript((savedTheme) => {
      localStorage.setItem("byeolharu_v2_theme", savedTheme);
    }, theme);
    await page.goto("/");
    await expect(page.locator(".byeolharu")).toHaveClass(
      new RegExp(theme),
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-byeolharu-theme",
      theme,
    );
    await expect(page.locator("body")).toHaveCSS(
      "background-color",
      theme === "dark" ? "rgb(12, 17, 27)" : "rgb(247, 246, 242)",
    );
    await expect(page.locator(".byeolharu")).toHaveCSS(
      "background-color",
      theme === "dark" ? "rgb(12, 17, 27)" : "rgb(247, 246, 242)",
    );
  });
}
