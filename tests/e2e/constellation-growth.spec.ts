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
    // Next/Image may deliver a responsive optimized width: verify aspect, not a fixed decoded width.
    await expect.poll(async () => art.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const intrinsicRatio = await art.evaluate((el) => {
      const image = el as HTMLImageElement;
      return image.naturalHeight / image.naturalWidth;
    });
    expect(intrinsicRatio).toBeCloseTo(1.5, 1);
    const widths = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.body).toBeLessThanOrEqual(widths.viewport);
    expect(await dialog.locator(".constellation-scene").evaluate((el) =>
      Math.round(el.getBoundingClientRect().height / el.getBoundingClientRect().width * 100),
    )).toBe(150);
    if (process.env.V0_CAPTURE_CONSTELLATION_SCREENSHOTS === "1" && width === 390) {
      await page.screenshot({ path: "/tmp/v0-workspace/browser/screenshots/constellation-stage-01-reviewed.png" });
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(button).toBeFocused();
  });
}

for (const width of [320, 390, 430, 1280]) {
  for (const theme of ["light", "dark"] as const) {
    test(`Stage 6 preserves its approved portrait 2:3 artwork at ${width}px in ${theme} theme`, async ({ page }) => {
      await page.setViewportSize({ width, height: 820 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
      await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("byeolharu-v2");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const tx = db.transaction("scopes", "readwrite");
        const store = tx.objectStore("scopes");
        const state = await new Promise<{ entities: Record<string, unknown> }>((resolve, reject) => {
          const request = store.get("guest");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        for (let offset = 1; offset <= 200; offset += 1) {
          const day = new Date(Date.UTC(2026, 10, 17 - offset)).toISOString().slice(0, 10);
          const id = `stage-six-${offset}`;
          state.entities[`days:${day}:${day}`] = {
            key: `days:${day}:${day}`, kind: "days", id: day, day,
            data: { timezone: "UTC" }, version: 1, deleted: false,
          };
          state.entities[`habit_entries:${day}:${id}`] = {
            key: `habit_entries:${day}:${id}`, kind: "habit_entries", id, day,
            data: { title: "별빛 기록", icon: "", timeGroup: "day", alarmEnabled: false,
              position: 0, completed: true, rating: 0, memo: "" },
            version: 1, deleted: false,
          };
        }
        store.put(state, "guest");
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      });
      await page.reload();
      if (theme === "dark") await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      await page.getByRole("button", { name: /나의 별자리 STAGE 6/ }).click();
      const dialog = page.getByRole("dialog", { name: "나의 별자리" });
      await expect(dialog.getByRole("heading", { name: "빛나는 은하" })).toBeVisible();
      await expect(dialog.getByText("200점", { exact: true })).toBeVisible();
      await expect(dialog.locator(".constellation-growth-complete")).toHaveText("별빛은 앞으로도 조금씩 더 풍성해져요.");
      const artwork = dialog.locator("[data-constellation-stage='6']");
      const image = artwork.locator("img");
      await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
      const ratio = await artwork.evaluate((element) => element.getBoundingClientRect().height / element.getBoundingClientRect().width);
      expect(ratio).toBeCloseTo(1.5, 1);
      await expect(image).toHaveCSS("object-fit", "contain");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      if (process.env.V0_CAPTURE_CONSTELLATION_SCREENSHOTS === "1" && width === 390 && theme === "light") {
        await page.screenshot({ path: "/tmp/v0-workspace/browser/screenshots/constellation-stage-06-reviewed.png" });
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: /나의 별자리 STAGE 6/ })).toBeFocused();
    });
  }
}

test("artwork failure retains an accessible stage label", async ({ page }) => {
  await page.route(/(?:\/_next\/image|stage-01\.webp)/, (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  await expect(page.getByRole("img", { name: /첫 번째 별빛 별자리 아트를 불러올 수 없습니다/ })).toBeVisible();
});

test("reduced motion keeps the artwork and removes panel animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  const dialog = page.getByRole("dialog", { name: "나의 별자리" });
  await expect(dialog.locator("img")).toBeVisible();
  await expect(dialog).toHaveCSS("animation-name", "none");
});

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
