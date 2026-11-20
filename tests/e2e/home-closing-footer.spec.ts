import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430, 1365]) {
  for (const theme of ["light", "dark"] as const) {
    test(`B4.3 subtle horizon closing at ${width}px in ${theme}`, async ({ page }) => {
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
      expect(sizes.scenic).toBeLessThanOrEqual(width <= 620 ? 124 : 134);
      const blend = await closing.evaluate((el) => {
        const landscape = el.querySelector(".closing-landscape")!;
        const waves = el.querySelector(".closing-waves")!;
        const brand = el.querySelector(".closing-brand")!;
        const copy = el.querySelector(".closing-copy")!;
        const page = el.closest(".byeolharu")!;
        const colors = [...waves.querySelectorAll("#closing-wave-distance stop[class], #closing-wave-foreground stop[class]")]
          .map((stop) => getComputedStyle(stop).stopColor);
        const scene = landscape.getBoundingClientRect();
        const brandBox = brand.getBoundingClientRect();
        const copyBox = copy.getBoundingClientRect();
        return {
          scene: scene.toJSON(),
          brand: brandBox.toJSON(),
          copy: copyBox.toJSON(),
          wave: waves.getBoundingClientRect().toJSON(),
          farPathCount: waves.querySelectorAll(".closing-wave-far").length,
          nearPathCount: waves.querySelectorAll(".closing-wave-near").length,
          glintPathCount: waves.querySelectorAll(".closing-wave-glint").length,
          glowCount: waves.querySelectorAll(".closing-horizon-light").length,
          glowGradientCount: waves.querySelectorAll("#closing-horizon-glow").length,
          glowStops: [...waves.querySelectorAll("#closing-horizon-glow stop[class]")].map((stop) => ({
            color: getComputedStyle(stop).stopColor,
            opacity: getComputedStyle(stop).stopOpacity,
          })),
          horizonHaze: getComputedStyle(el).getPropertyValue("--closing-horizon-haze").trim(),
          horizonHazeIsColor: CSS.supports("color", getComputedStyle(el).getPropertyValue("--closing-horizon-haze").trim()),
          waveMask: getComputedStyle(waves).maskImage || getComputedStyle(waves).webkitMaskImage,
          waveWidth: getComputedStyle(waves).width,
          sceneWidth: getComputedStyle(landscape).width,
          waveLeft: waves.getBoundingClientRect().left - scene.left,
          colors,
          waveNearBottomColor: getComputedStyle(waves.querySelector(".closing-wave-near-bottom")!).stopColor,
          pageBackground: getComputedStyle(page).getPropertyValue("--bg").trim(),
          decorationHidden: waves.getAttribute("aria-hidden"),
          brandPosition: getComputedStyle(brand).position,
        };
      });
      expect(blend.farPathCount).toBe(1);
      expect(blend.nearPathCount).toBe(1);
      expect(blend.glintPathCount).toBe(0);
      expect(blend.glowCount).toBe(1);
      expect(blend.glowGradientCount).toBe(1);
      expect(blend.glowStops).toHaveLength(2);
      expect(blend.glowStops.every((stop) => stop.color !== "" && stop.opacity !== "")).toBe(true);
      // CSS custom properties can serialize to #RRGGBBAA even if authored as rgb(... / alpha).
      expect(blend.horizonHazeIsColor).toBe(true);
      expect(blend.horizonHaze).not.toBe("");
      expect(blend.waveMask).toContain("linear-gradient");
      expect(blend.waveMask).toContain("15%");
      expect(blend.waveMask).toContain("85%");
      expect(blend.waveMask).toContain("96%");
      expect(Number.parseFloat(blend.waveWidth)).toBeGreaterThan(Number.parseFloat(blend.sceneWidth));
      expect(blend.waveLeft).toBeLessThan(0);
      // Separate wave stops from the two glow stops so artwork additions don't break this contract.
      expect(blend.colors).toHaveLength(6);
      expect(blend.colors.every((value) => value !== "" && value !== "none")).toBe(true);
      expect(blend.colors[0]).toBe(theme === "dark" ? "rgb(81, 66, 117)" : "rgb(217, 208, 235)");
      expect(Number(blend.glowStops[0].opacity)).toBeCloseTo(theme === "dark" ? .36 : .19, 2);
      expect(Number(blend.glowStops[1].opacity)).toBeCloseTo(theme === "dark" ? .17 : .08, 2);
      expect(blend.decorationHidden).toBe("true");
      expect(blend.scene.bottom).toBeCloseTo(blend.wave.bottom, 0);
      expect(blend.brand.bottom).toBeLessThanOrEqual(blend.scene.bottom + 1);
      expect(blend.copy.bottom).toBeLessThan(blend.brand.top);
      expect(blend.wave.top).toBeLessThan(blend.copy.bottom);
      expect(blend.brandPosition).toBe("relative");
      await expect(closing.locator(".closing-divider, .closing-moonlit-scene")).toHaveCount(0);
      expect(blend.pageBackground).toMatch(/^#/);
      expect(sizes.total).toBeLessThanOrEqual(width <= 620 ? 125 : 135);
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
