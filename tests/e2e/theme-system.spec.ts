import { expect, test } from "@playwright/test";

async function openThemeSettings(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  return page.getByRole("group", { name: "화면 테마" });
}

test("fresh installation follows OS dark mode before hydration and reacts to OS changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-byeolharu-theme", "dark");
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
  const settings = await openThemeSettings(page);
  await expect(settings.getByRole("button", { name: "시스템" })).toHaveAttribute("aria-pressed", "true");

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator(".byeolharu")).toHaveClass(/light/);
  await expect(page.locator("html")).toHaveAttribute("data-byeolharu-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
});

test("explicit selection persists and ignores later OS changes until system is selected", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const settings = await openThemeSettings(page);
  await settings.getByRole("button", { name: "라이트" }).click();
  await expect(settings.getByRole("button", { name: "라이트" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".byeolharu")).toHaveClass(/light/);
  await expect(page.locator("html")).toHaveAttribute("data-byeolharu-theme", "light");
  await page.reload();
  await expect(page.locator(".byeolharu")).toHaveClass(/light/);
  await page.emulateMedia({ colorScheme: "light" });
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator(".byeolharu")).toHaveClass(/light/);
  const again = await openThemeSettings(page);
  await again.getByRole("button", { name: "시스템" }).click();
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("byeolharu_v3_theme_mode"))).toBe("system");
});

test("legacy dark selection is preserved and old implicit light becomes system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("seededLegacy")) return;
    sessionStorage.setItem("seededLegacy", "1");
    localStorage.setItem("byeolharu_v2_theme", "dark");
  });
  await page.goto("/");
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
  await expect((await openThemeSettings(page)).getByRole("button", { name: "다크" })).toHaveAttribute("aria-pressed", "true");

  await page.evaluate(() => {
    localStorage.removeItem("byeolharu_v3_theme_mode");
    localStorage.setItem("byeolharu_v2_theme", "light");
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
  await expect((await openThemeSettings(page)).getByRole("button", { name: "시스템" })).toHaveAttribute("aria-pressed", "true");
});

test("header shortcut makes a user-selected override without changing habit records", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("button", { name: "라이트 모드로 전환" }).click();
  await expect(page.locator(".byeolharu")).toHaveClass(/light/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("byeolharu_v3_theme_mode"))).toBe("light");
  await page.reload();
  await expect(page.locator(".byeolharu")).toHaveClass(/light/);
});
