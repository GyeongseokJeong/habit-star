import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { seedConstellationPoints } from "./fixtures/constellation-points";

test.use({ timezoneId: "Asia/Seoul", acceptDownloads: true });

async function assertPng(downloadPath: string) {
  const bytes = await readFile(downloadPath);
  expect(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  expect(bytes.toString("ascii", 12, 16)).toBe("IHDR");
  expect(bytes.readUInt32BE(16)).toBe(1080);
  expect(bytes.readUInt32BE(20)).toBe(1350);
  expect(bytes.length).toBeGreaterThan(20_000);
}

for (const size of [320, 390] as const) {
  test(`V5 STEP 2 saves the real Stage 1 1080×1350 PNG on mobile ${size}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: size, height: 820 });
    await page.clock.setFixedTime(new Date("2026-11-20T20:00:00+09:00"));
    await page.goto("/");
    await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
    await page.getByRole("dialog", { name: "나의 별자리" })
      .getByRole("button", { name: "별빛 카드 만들기" }).click();

    const preview = page.getByRole("dialog", { name: "별빛 카드" });
    const card = preview.locator(".starlight-share-card");
    const save = preview.getByRole("button", { name: "이미지 저장" });
    await expect(save).toBeEnabled();
    // Verify that the original Stage art is embedded into the ::before
    // background reference during export, not just into its foreground <img>.
    await page.evaluate(() => {
      const card = document.querySelector<HTMLElement>(".starlight-share-card");
      if (!card) throw new Error("preview card not found");
      const state = window as Window & { __starlightEmbeddedBackground?: boolean };
      state.__starlightEmbeddedBackground = false;
      const observer = new MutationObserver(() => {
        if (card.style.getPropertyValue("--starlight-stage-art").includes("data:image/")) {
          state.__starlightEmbeddedBackground = true;
          observer.disconnect();
        }
      });
      observer.observe(card, { attributes: true, attributeFilter: ["style"] });
    });
    const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
    await save.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("byeolharu-starlight-stage-1.png");
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    await assertPng(downloadPath!);
    expect(await page.evaluate(() =>
      (window as Window & { __starlightEmbeddedBackground?: boolean }).__starlightEmbeddedBackground,
    )).toBe(true);
    await expect(preview.getByRole("status")).toContainText("저장을 요청했어요");
    await expect(card).toContainText("Stage 1");
    await expect(preview.getByRole("button", { name: /공유/ })).toHaveCount(0);
    await expect(preview).toBeVisible();
    // PNG capture must not mutate the preview's size or the backing records.
    const bounds = await card.boundingBox();
    expect(bounds!.height / bounds!.width).toBeCloseTo(1.25, 1);
  });
}

test("V5 STEP 2 exports earned Stage 6 art and works in dark mode", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-11-20T20:00:00+09:00"));
  await page.goto("/");
  await seedConstellationPoints(page, 200);
  await page.getByRole("button", { name: "다크 모드로 전환" }).click();
  await page.getByRole("button", { name: /나의 별자리 STAGE 6/ }).click();
  await page.getByRole("dialog", { name: "나의 별자리" })
    .getByRole("button", { name: "별빛 카드 만들기" }).click();
  const preview = page.getByRole("dialog", { name: "별빛 카드" });
  await expect(preview.locator("[data-constellation-stage='6']")).toBeVisible();

  const promise = page.waitForEvent("download", { timeout: 90_000 });
  await preview.getByRole("button", { name: "이미지 저장" }).click();
  const download = await promise;
  expect(download.suggestedFilename()).toBe("byeolharu-starlight-stage-6.png");
  await assertPng((await download.path())!);
  await expect(preview.locator(".starlight-share-card")).toContainText("Stage 6");
});
