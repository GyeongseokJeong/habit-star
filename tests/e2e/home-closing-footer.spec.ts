import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430, 1365]) {
  for (const theme of ["light", "dark"] as const) {
    test(`B3.4 compact closing at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
      if (theme === "dark") {
        const dark = page.getByRole("button", { name: "다크 모드로 전환" });
        if (await dark.isVisible()) await dark.click();
      }
      await page.getByRole("tab", { name: "전체", exact: true }).click();

      const closing = page.locator("footer.closing-footer[aria-label='하루의 마무리']");
      await expect(closing).toBeVisible();
      await expect(closing.getByRole("heading", { name: "꾸준함은 완벽함보다 빛나요." })).toBeVisible();
      await expect(closing.locator(".closing-brand")).toHaveText("별하루");
      await expect(page.locator(".gentle-note, .little-note, .site-footer, .sidebar")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "별점 기록 안내" })).toHaveCount(0);
      const sizes = await closing.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const scenic = el.querySelector(".closing-landscape")!.getBoundingClientRect();
        return { total: rect.height, scenic: scenic.height, left: rect.left, right: rect.right };
      });
      expect(sizes.scenic).toBeLessThanOrEqual(width <= 620 ? 118 : 128);
      const blend = await closing.evaluate((el) => {
        const landscape = el.querySelector(".closing-landscape")!;
        const waves = el.querySelector(".closing-waves")!;
        const divider = el.querySelector(".closing-divider")!;
        const page = el.closest(".byeolharu")!;
        const colors = [...waves.querySelectorAll("stop")].map((stop) => getComputedStyle(stop).stopColor);
        return {
          waveBounds: waves.getBoundingClientRect().toJSON(),
          landscapeBounds: landscape.getBoundingClientRect().toJSON(),
          wavePaths: waves.querySelectorAll("path").length,
          waveColors: colors,
          pageBackground: getComputedStyle(page).getPropertyValue("--bg").trim(),
          separatorHeight: divider.getBoundingClientRect().height,
          separatorWidth: divider.getBoundingClientRect().width,
          brandGap: el.querySelector(".closing-brand")!.getBoundingClientRect().top - divider.getBoundingClientRect().bottom,
        };
      });
      expect(blend.wavePaths).toBe(2);
      expect(blend.waveColors).toHaveLength(5);
      expect(blend.waveColors.every((value) => value !== "none" && value !== "")).toBe(true);
      expect(blend.waveBounds.bottom).toBeCloseTo(blend.landscapeBounds.bottom, 0);
      expect(blend.waveBounds.height).toBeGreaterThanOrEqual(width <= 620 ? 62 : 70);
      await expect(closing.locator(".closing-waves")).toHaveAttribute("aria-hidden", "true");
      await expect(closing.locator(".closing-moonlit-scene")).toHaveCount(0);
      const expectedWaveLeft = theme === "dark" ? "rgb(69, 64, 93)" : "rgb(224, 213, 240)";
      expect(blend.waveColors[0]).toBe(expectedWaveLeft);
      expect(blend.pageBackground).toMatch(/^#/);
      expect(blend.separatorHeight).toBe(1);
      expect(blend.separatorWidth).toBeLessThan(width);
      expect(blend.brandGap).toBeLessThanOrEqual(8);
      expect(sizes.total).toBeLessThanOrEqual(190);
      expect(sizes.left).toBeGreaterThanOrEqual(0);
      expect(sizes.right).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (width > 850) {
        expect((await page.locator(".dashboard-layout").boundingBox())!.width).toBeLessThanOrEqual(901);
      }

      await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
      const account = page.getByRole("dialog", { name: "내 계정" });
      await expect(account.getByRole("button", { name: "사용 안내" })).toBeVisible();
      await account.getByRole("button", { name: "사용 안내" }).click();
      const help = page.getByRole("dialog", { name: "나의 속도로, 별하루" });
      await expect(help).toBeVisible();
      await expect(help).toContainText("같은 별을 다시 누르면 기록이 취소돼요.");
      await expect(help).toContainText("비회원 기록과 테마는 이 브라우저에 저장돼요.");
    });
  }
}

test("B3.4 closing does not claim completion before a habit is recorded", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  const closing = page.locator("footer.closing-footer[aria-label='하루의 마무리']");
  await expect(closing).toBeVisible();
  // A seeded demo may already include completed records. Assert the prompt matches the real summary.
  const completed = await page.locator(".completion-metric .metric-value").innerText();
  const done = Number(completed.split("/")[0].trim()) > 0;
  await expect(closing).toContainText(done
    ? "오늘도 한 걸음, 잘 해내고 있어요."
    : "작은 시작도 충분히 소중해요.");
});
