import { expect, test } from "@playwright/test";
import { seedConstellationPoints } from "./fixtures/constellation-points";

test.use({ timezoneId: "Asia/Seoul" });
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-19T20:00:00+09:00"));
});

for (const width of [320, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`V5 STEP 1 preview is read-only, 4:5 and navigable at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 820 });
      await page.goto("/");
      const opener = page.getByRole("button", { name: /나의 별자리 STAGE 1/ });
      await expect(opener).toBeVisible();
      if (theme === "dark") {
        await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      }
      await opener.click();
      const dialog = page.getByRole("dialog", { name: "나의 별자리" });
      await expect(dialog).toBeVisible();
      const entry = dialog.getByRole("button", { name: "별빛 카드 만들기" });
      await expect(entry).toBeVisible();
      const entryRect = await entry.boundingBox();
      expect(entryRect?.height).toBeGreaterThanOrEqual(44);

      await entry.click();
      const preview = page.getByRole("dialog", { name: "별빛 카드" });
      await expect(preview).toBeVisible();
      await expect(dialog).toHaveCount(0);
      const card = preview.locator(".starlight-share-card");
      await expect(card).toBeVisible();
      const bounds = await card.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.height / bounds!.width).toBeCloseTo(1.25, 1);
      const art = card.locator("[data-constellation-stage='1']");
      await expect(art).toBeVisible();
      const artBounds = await art.boundingBox();
      expect(artBounds).not.toBeNull();
      // The approved portrait Stage image remains intact, and occupies
      // at least half the card's width rather than the former 44%-of-sky.
      expect(artBounds!.height / artBounds!.width).toBeCloseTo(1.5, 1);
      expect(artBounds!.width / bounds!.width).toBeGreaterThan(0.48);
      await expect(art.locator("img")).toHaveCSS("object-fit", "contain");
      await expect(card).toHaveCSS("aspect-ratio", "4 / 5");
      await expect(card).toContainText("현재 단계");
      await expect(card).toContainText("Stage 1");
      await expect(card.getByText("Stage 1", { exact: true })).toHaveCount(1);
      await expect(card.getByText("별하루", { exact: true })).toHaveCount(1);
      await expect(card.getByText("BYEOLHARU", { exact: true })).toHaveCount(1);
      await expect(card).not.toContainText("MY STARLIGHT");
      await expect(preview.locator(".starlight-preview-footnote")).toHaveCount(0);
      await expect(card).toContainText("누적 실천");
      await expect(card).toContainText("연속 실천");
      await expect(preview.getByRole("button", { name: /저장|공유/ })).toHaveCount(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "나의 별자리" })).toBeVisible();
      await expect(entry).toBeFocused();
      await expect(preview).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(opener).toBeFocused();
    });
  }
}

test("V5 returning from preview reveals the restored focus on a short viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  const dialog = page.getByRole("dialog", { name: "나의 별자리" });
  const entry = dialog.getByRole("button", { name: "별빛 카드 만들기" });
  await entry.scrollIntoViewIfNeeded();
  await entry.click();
  const preview = page.getByRole("dialog", { name: "별빛 카드" });
  await expect(preview).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(entry).toBeFocused();
  await expect(entry).toBeInViewport();
});

test("V5 preview always uses the current earned stage, not a browsed earlier stage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
  await seedConstellationPoints(page, 20);
  const opener = page.getByRole("button", { name: /나의 별자리 STAGE 3/ });
  await opener.click();
  const detail = page.getByRole("dialog", { name: "나의 별자리" });
  await detail.getByRole("button", { name: /Stage 1 첫 번째 별빛/ }).click();
  await expect(detail.getByRole("heading", { name: "첫 번째 별빛" })).toBeVisible();
  await detail.getByRole("button", { name: "별빛 카드 만들기" }).click();
  const preview = page.getByRole("dialog", { name: "별빛 카드" });
  const card = preview.locator(".starlight-share-card");
  await expect(card.locator("[data-constellation-stage='3']")).toBeVisible();
  await expect(card).toContainText("Stage 3");
  await expect(card).toContainText("20회");
  await expect(card).not.toContainText("Stage 1");
  await preview.getByRole("button", { name: "별자리 성장으로 돌아가기" }).click();
  await expect(detail.getByRole("heading", { name: "첫 번째 별빛" })).toBeVisible();
  await expect(detail.getByRole("button", { name: "별빛 카드 만들기" })).toBeFocused();
  await detail.getByRole("button", { name: "닫기" }).click();
  await expect(opener).toBeFocused();
});

test("V5 approved artwork stays intact at Stage 6 with a single current Stage label", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
  await seedConstellationPoints(page, 200);
  await page.getByRole("button", { name: /나의 별자리 STAGE 6/ }).click();
  await page.getByRole("dialog", { name: "나의 별자리" })
    .getByRole("button", { name: "별빛 카드 만들기" }).click();
  const card = page.getByRole("dialog", { name: "별빛 카드" }).locator(".starlight-share-card");
  const art = card.locator("[data-constellation-stage='6']");
  await expect(art).toBeVisible();
  const image = art.locator("img");
  await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(await image.evaluate((element) => {
    const img = element as HTMLImageElement;
    return img.naturalHeight / img.naturalWidth;
  })).toBeCloseTo(1.5, 1);
  await expect(image).toHaveCSS("object-fit", "contain");
  await expect(card.getByText("Stage 6", { exact: true })).toHaveCount(1);
  await expect(card.getByText("빛나는 은하", { exact: true })).toHaveCount(1);
  await expect(card.getByText("BYEOLHARU", { exact: true })).toHaveCount(1);
  const dimensions = await card.boundingBox();
  expect(dimensions!.height / dimensions!.width).toBeCloseTo(1.25, 1);
});
