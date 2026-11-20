import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { seedConstellationPoints } from "./fixtures/constellation-points";

test.use({ timezoneId: "Asia/Seoul", acceptDownloads: true });

for (const size of [320, 390] as const) {
  test(`V5 Instagram fallback saves an intact 1080×1350 JPEG at ${size}px without altering normal PNG/share`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: size, height: 820 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
    await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
    await page.getByRole("dialog", { name: "나의 별자리" })
      .getByRole("button", { name: "별빛 카드 만들기" }).click();
    const preview = page.getByRole("dialog", { name: "별빛 카드" });
    const help = preview.locator(".starlight-instagram-help");
    await expect(help).not.toHaveAttribute("open");
    await expect(preview.getByRole("button", { name: "이미지 저장" })).toBeEnabled();
    const card = preview.locator(".starlight-share-card");
    await expect(card).toContainText("Stage 1");

    await help.locator("summary").click();
    await expect(help.getByText(/JPG가 문제 해결을 보장하지는 않습니다/)).toBeVisible();
    const jpegDownload = page.waitForEvent("download", { timeout: 90_000 });
    await help.getByRole("button", { name: "JPG로 저장" }).click();
    const jpeg = await jpegDownload;
    expect(jpeg.suggestedFilename()).toBe("byeolharu-starlight-stage-1.jpg");
    const bytes = await readFile((await jpeg.path())!);
    expect(bytes.length).toBeGreaterThan(15_000);
    expect(bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))).toBe(true);
    await expect(preview.getByRole("status")).toContainText("JPG 이미지 저장을 요청했어요");

    const decoded = await page.evaluate(async (encoded) => {
      const blob = new Blob([new Uint8Array(encoded)], { type: "image/jpeg" });
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas unavailable");
        context.drawImage(bitmap, 0, 0);
        const pixel = context.getImageData(540, 675, 1, 1).data;
        return { width: bitmap.width, height: bitmap.height, alpha: pixel[3] };
      } finally {
        bitmap.close();
      }
    }, Array.from(bytes));
    expect(decoded).toEqual({ width: 1080, height: 1350, alpha: 255 });

    // Confirm the long-standing PNG download flow still works after JPG.
    const pngDownload = page.waitForEvent("download", { timeout: 90_000 });
    await preview.getByRole("button", { name: "이미지 저장" }).click();
    const png = await pngDownload;
    expect(png.suggestedFilename()).toBe("byeolharu-starlight-stage-1.png");
    const pngBytes = await readFile((await png.path())!);
    expect(pngBytes.readUInt32BE(16)).toBe(1080);
    expect(pngBytes.readUInt32BE(20)).toBe(1350);
    await expect(preview.locator(".starlight-share-card")).toBeVisible();
  });
}

test("V5 Instagram fallback uses the earned Stage 6 instead of a gallery-selected stage", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
  await seedConstellationPoints(page, 200);
  await page.getByRole("button", { name: /나의 별자리 STAGE 6/ }).click();
  const detail = page.getByRole("dialog", { name: "나의 별자리" });
  // Stage 6's gallery window displays the nearby Stage 4-6 thumbnails.
  await detail.getByRole("button", { name: /Stage 4 나의 작은 별자리/ }).click();
  await detail.getByRole("button", { name: "별빛 카드 만들기" }).click();
  const preview = page.getByRole("dialog", { name: "별빛 카드" });
  await expect(preview.locator("[data-constellation-stage='6']")).toBeVisible();
  const help = preview.locator(".starlight-instagram-help");
  await help.locator("summary").click();
  const download = page.waitForEvent("download", { timeout: 90_000 });
  await help.getByRole("button", { name: "JPG로 저장" }).click();
  expect((await download).suggestedFilename()).toBe("byeolharu-starlight-stage-6.jpg");
});
