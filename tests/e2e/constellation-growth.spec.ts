import { expect, test } from "@playwright/test";
import { seedConstellationPoints } from "./fixtures/constellation-points";

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
      await seedConstellationPoints(page, 200);
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

for (const { width, height } of [
  { width: 320, height: 640 },
  { width: 390, height: 720 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 1280, height: 900 },
]) {
  for (const theme of ["light", "dark"] as const) {
    test(`growth layout, artwork and zoom at ${width}×${height} in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
      if (theme === "dark") await page.getByRole("button", { name: "다크 모드로 전환" }).click();

      for (const { stage, points } of [
        { stage: 1, points: 0 }, { stage: 2, points: 7 },
        { stage: 3, points: 20 }, { stage: 4, points: 50 },
        { stage: 5, points: 100 }, { stage: 6, points: 200 },
      ]) {
        if (points) await seedConstellationPoints(page, points);
        const opener = page.getByRole("button", { name: new RegExp(`나의 별자리 STAGE ${stage}`) });
        await expect(opener).toBeVisible();
        await opener.click();
        const dialog = page.getByRole("dialog", { name: "나의 별자리" });
        const artwork = dialog.locator(`[data-constellation-stage='${stage}']`);
        const image = artwork.locator("img");
        await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
        await expect(image).toHaveCSS("object-fit", "contain");
        expect(decodeURIComponent(await image.getAttribute("src") ?? "")).toContain(`stage-0${stage}.webp`);
        const geometry = await artwork.evaluate((element) => {
          const image = element.querySelector("img") as HTMLImageElement;
          const rect = element.getBoundingClientRect();
          return { ratio: rect.height / rect.width, intrinsic: image.naturalHeight / image.naturalWidth, height: rect.height };
        });
        expect(geometry.ratio).toBeCloseTo(1.5, 1);
        expect(geometry.intrinsic).toBeCloseTo(1.5, 1);
        if (width < 620) {
          expect(geometry.height).toBeGreaterThanOrEqual(296);
          expect(geometry.height).toBeLessThanOrEqual(383);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        if (width === 390 && height === 844) {
          expect(await dialog.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(2);
        }
        if (width === 320 && height === 640) {
          await dialog.locator(".constellation-growth-summary").scrollIntoViewIfNeeded();
          await expect(dialog.locator(".constellation-growth-summary")).toBeInViewport();
        }
        if (stage === 2 || stage === 6) {
          const trigger = dialog.getByRole("button", { name: `${stage === 2 ? "별이 모이는 밤" : "빛나는 은하"} 원화 크게 보기` });
          await trigger.click();
          const zoom = page.getByRole("dialog", { name: /원화 확대 감상/ });
          await expect(zoom).toBeVisible();
          await expect(zoom.locator("img")).toHaveCSS("object-fit", "contain");
          if (width === 390 && height === 844 && theme === "light") {
            await zoom.getByRole("button", { name: "확대 감상 닫기" }).click();
            await expect(trigger).toBeFocused();
            await page.screenshot({ path: `/tmp/v0-workspace/browser/screenshots/growth-after-stage-0${stage}-390x844.png`, animations: "disabled" });
          } else {
            await page.keyboard.press("Escape");
            await expect(trigger).toBeFocused();
          }
          await expect(dialog).toBeVisible();
          await expect(zoom).toHaveCount(0);
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(opener).toBeFocused();
      }
    });
  }
}

test("earned Stage 2 appears once, then undo and reload do not celebrate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
  await seedConstellationPoints(page, 6);
  await expect(page.locator(".constellation-stage-celebration")).toHaveCount(0);
  await page.getByRole("heading", { name: "독서 30분 & TOP 50 책장", exact: true }).click();
  await page.getByRole("button", { name: "단순 체크만 하기", exact: true }).click();
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 2/ })).toBeVisible();
  await expect(page.locator(".constellation-stage-celebration")).toHaveText(/별자리가 한층 밝아졌어요 · STAGE 2/);
  await expect(page.locator(".starlit-card")).toHaveClass(/starlit-card-celebrating/);
  await page.reload();
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 2/ })).toBeVisible();
  await expect(page.locator(".constellation-stage-celebration")).toHaveCount(0);
  await page.getByRole("heading", { name: "독서 30분 & TOP 50 책장", exact: true }).click();
  await page.getByRole("button", { name: "별점 저장", exact: true }).click();
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
  await expect(page.locator(".constellation-stage-celebration")).toHaveCount(0);
});

test("Stage 6 afterglow grows deterministically without changing the approved image", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: /나의 별자리 STAGE 1/ })).toBeVisible();
  await seedConstellationPoints(page, 200);
  await page.getByRole("button", { name: /나의 별자리 STAGE 6/ }).click();
  const card = page.locator(".constellation-card");
  const base = await card.evaluate((el) => getComputedStyle(el.querySelector(".constellation-afterglow span")!).opacity);
  const image = await card.locator("img").getAttribute("src");
  await page.keyboard.press("Escape");
  await seedConstellationPoints(page, 500);
  await page.getByRole("button", { name: /나의 별자리 STAGE 6/ }).click();
  const enriched = await card.evaluate((el) => getComputedStyle(el.querySelector(".constellation-afterglow span")!).opacity);
  expect(Number(enriched)).toBeGreaterThan(Number(base));
  expect(await card.locator("img").getAttribute("src")).toBe(image);
  await page.screenshot({ path: "/tmp/v0-workspace/browser/screenshots/growth-stage-06-500-390x844.png", animations: "disabled" });
  await page.reload();
  await page.getByRole("button", { name: /나의 별자리 STAGE 6/ }).click();
  expect(await card.evaluate((el) => getComputedStyle(el.querySelector(".constellation-afterglow span")!).opacity)).toBe(enriched);
});

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

test("constellation stays readable in dark theme without changing the home completion metric", async ({ page }) => {
  await page.setViewportSize({ width: 395, height: 844 });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "나의 별자리 미리보기" });
  const completion = page.locator(".completion-metric .metric-value");
  await expect(hero).toContainText("첫 번째 별빛");
  await expect(completion).toHaveText("3/ 5");
  await page.getByRole("button", { name: "다크 모드로 전환" }).click();
  await page.getByRole("button", { name: /나의 별자리 STAGE 1/ }).click();
  const dialog = page.getByRole("dialog", { name: "나의 별자리" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("작은 별빛 하나가 태어나,")).toBeVisible();
  await expect(dialog.getByRole("progressbar", { name: /Stage 2/ })).toHaveAttribute("aria-valuenow", "0");
  await page.keyboard.press("Escape");
  await expect(hero).toContainText("첫 번째 별빛");
  await expect(completion).toHaveText("3/ 5");
});

for (const width of [320, 360, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`approved home teaser preserves all six stages at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 720 });
      await page.goto("/");
      if (theme === "dark") await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      for (const { stage, points, title } of [
        { stage: 1, points: 0, title: "첫 번째 별빛" },
        { stage: 2, points: 7, title: "별이 모이는 밤" },
        { stage: 3, points: 20, title: "별빛의 연결" },
        { stage: 4, points: 50, title: "나의 작은 별자리" },
        { stage: 5, points: 100, title: "찬란한 별자리" },
        { stage: 6, points: 200, title: "빛나는 은하" },
      ]) {
        if (points) await seedConstellationPoints(page, points);
        const card = page.getByRole("button", { name: `나의 별자리 STAGE ${stage} ${title} 열기` });
        await expect(card).toBeVisible();
        await expect(card.locator(".starlit-copy")).toHaveText(`STAGE ${stage}${title}`);
        const image = card.locator("img");
        await expect(image).toHaveAttribute("src", `/assets/home-constellation/stage-${String(stage).padStart(2, "0")}.webp`);
        await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).naturalWidth)).toBe(1950);
        const geometry = await card.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const art = element.querySelector("img")!.getBoundingClientRect();
          const title = element.querySelector(".starlit-title")!.getBoundingClientRect();
          const arrow = element.querySelector(".starlit-arrow")!.getBoundingClientRect();
          return {
            width: rect.width, height: rect.height, artWidth: art.width, artHeight: art.height,
            titleRight: title.right, arrowLeft: arrow.left, arrowTop: arrow.top, titleBottom: title.bottom,
          };
        });
        expect(geometry.height / geometry.width).toBeCloseTo(17 / 39, 2);
        expect(geometry.artWidth).toBeCloseTo(geometry.width - 2, 0);
        expect(geometry.artHeight).toBeCloseTo(geometry.height - 2, 0);
        expect(geometry.arrowTop).toBeGreaterThanOrEqual(geometry.titleBottom);
        expect(geometry.titleRight).toBeLessThan(geometry.width * 0.6 + (width - geometry.width) / 2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await expect(image).toHaveCSS("object-fit", "contain");
      }
    });
  }
}

test("home teaser remains readable without artwork and opens by keyboard", async ({ page }) => {
  await page.route("**/assets/home-constellation/stage-01.webp", (route) => route.abort());
  await page.goto("/");
  const card = page.getByRole("button", { name: "나의 별자리 STAGE 1 첫 번째 별빛 열기" });
  await expect(card).toContainText("첫 번째 별빛");
  await card.focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("dialog", { name: "나의 별자리" })).toBeVisible();
});
