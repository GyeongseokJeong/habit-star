import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul", acceptDownloads: true });

async function openPreview(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  await page.getByRole("dialog", { name: "나의 별자리" })
    .getByRole("button", { name: "별빛 카드 만들기" }).click();
  return page.getByRole("dialog", { name: "별빛 카드" });
}

test("V5 STEP 3 offers a real PNG File through Web Share, without losing transient activation", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    const state = window as Window & {
      __shareCalls?: Array<{ filename: string; type: string; size: number; active: boolean; title: string }>;
      __shareAbort?: boolean;
    };
    state.__shareCalls = [];
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: (data: ShareData) => Boolean(data.files?.length && data.files[0].type === "image/png"),
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: ShareData) => {
        const file = data.files?.[0];
        if (!file) throw new Error("missing shared file");
        state.__shareCalls!.push({
          filename: file.name,
          type: file.type,
          size: file.size,
          title: data.title ?? "",
          active: navigator.userActivation?.isActive ?? false,
        });
        if (state.__shareAbort) throw new DOMException("Share cancelled", "AbortError");
      },
    });
  });
  const preview = await openPreview(page);
  const card = preview.locator(".starlight-share-card");
  await expect(card).toContainText("Stage 1");
  const share = preview.getByRole("button", { name: "이미지 공유" });
  await expect(share).toBeEnabled({ timeout: 90_000 });
  await share.click();
  await expect(preview.getByRole("status")).toContainText("공유 요청을 전달했어요");
  let shares = await page.evaluate(() => (window as Window & {
    __shareCalls?: Array<{ filename: string; type: string; size: number; active: boolean; title: string }>;
  }).__shareCalls ?? []);
  expect(shares).toHaveLength(1);
  expect(shares[0].filename).toBe("byeolharu-starlight-stage-1.png");
  expect(shares[0].type).toBe("image/png");
  expect(shares[0].size).toBeGreaterThan(20_000);
  expect(shares[0].title).toBe("별하루 별빛 카드");
  expect(shares[0].active).toBe(true);

  // User cancellation should be silent and leave both actions available.
  await page.evaluate(() => { (window as Window & { __shareAbort?: boolean }).__shareAbort = true; });
  await share.click();
  await expect(share).toBeEnabled();
  await expect(preview.getByRole("status")).not.toContainText("공유하지 못했어요");
  shares = await page.evaluate(() => (window as Window & { __shareCalls?: unknown[] }).__shareCalls ?? []);
  expect(shares).toHaveLength(2);
  await expect(preview.locator(".starlight-share-card")).toBeVisible();

  // Save fallback remains available even when the share chooser was cancelled.
  const download = page.waitForEvent("download", { timeout: 90_000 });
  await preview.getByRole("button", { name: "이미지 저장" }).click();
  expect((await download).suggestedFilename()).toBe("byeolharu-starlight-stage-1.png");
});

test("V5 STEP 3 keeps save available when native file sharing is not supported", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: undefined });
  });
  const preview = await openPreview(page);
  await expect(preview.getByRole("button", { name: "이미지 공유" })).toHaveCount(0);
  await expect(preview.getByText("이 환경에서는 이미지를 저장한 뒤 공유해 주세요.")).toBeVisible();
  const download = page.waitForEvent("download", { timeout: 90_000 });
  await preview.getByRole("button", { name: "이미지 저장" }).click();
  expect((await download).suggestedFilename()).toBe("byeolharu-starlight-stage-1.png");
});

test("V5 STEP 3 gracefully falls back when Web Share exists but rejects image files", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: async () => undefined });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
  });
  const preview = await openPreview(page);
  await expect(preview.getByRole("button", { name: "이미지 공유" })).toHaveCount(0, { timeout: 90_000 });
  await expect(preview.getByText("이 환경에서는 이미지를 저장한 뒤 공유해 주세요.")).toBeVisible({ timeout: 90_000 });
  await expect(preview.getByRole("button", { name: "이미지 저장" })).toBeEnabled();
});
