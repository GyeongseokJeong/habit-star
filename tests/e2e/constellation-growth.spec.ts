import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  test(`V3.2 constellation viewer preserves image geometry and keyboard access at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/");
    const button = page.getByRole("button", { name: /나의 별자리 STAGE 1/ });
    await expect(button).toBeEnabled();
    await button.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "나의 별자리" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "첫 번째 별빛" })).toBeVisible();
    await expect(dialog.getByText("0 ~ 6점")).toBeVisible();
    await expect(dialog.getByText("0점", { exact: true })).toBeVisible();
    await expect(dialog.getByText("다음 별자리까지")).toContainText("7점");
    const art = dialog.locator("img");
    await expect(art).toBeVisible();
    await expect.poll(async () => art.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(1024);
    const widths = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(await dialog.locator(".constellation-scene").evaluate((el) =>
      Math.round(el.getBoundingClientRect().height / el.getBoundingClientRect().width * 100),
    )).toBe(150);

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });
}

test("growth derives from real check-only completion and survives reload without counting demo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  const dialog = page.getByRole("dialog", { name: "나의 별자리" });
  await expect(dialog.getByText("0점", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();

  await page.getByRole("heading", { name: "독서 30분 & TOP 50 책장", exact: true }).click();
  await page.getByRole("button", { name: "단순 체크만 하기", exact: true }).click();

  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  await expect(dialog.getByText("1점", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  await expect(dialog.getByText("1점", { exact: true })).toBeVisible();
});

test("constellation stays readable in dark theme and does not alter the hero", async ({ page }) => {
  await page.setViewportSize({ width: 395, height: 844 });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "오늘의 별빛" });
  await expect(hero).toContainText("3 / 5");
  await page.getByRole("button", { name: "다크 모드로 전환" }).click();
  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  const dialog = page.getByRole("dialog", { name: "나의 별자리" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("작은 별빛 하나가 태어나,")).toBeVisible();
  await expect(dialog.getByRole("progressbar", { name: /Stage 2/ })).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("Escape");
  await expect(hero).toContainText("3 / 5");
});
