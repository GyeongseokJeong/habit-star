import { expect, test } from "@playwright/test";
import { seedLegacyFiveHabits } from "./fixtures/legacy-five-habits";

for (const width of [320, 390, 430]) {
  test(`compact toggle has a small visual track with 44px+ touch target at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await page.getByRole("button", { name: "앱 설정", exact: true }).click();
    const toggle = page.getByRole("switch", { name: "간편 보기" });
    const track = toggle.locator(".compact-switch-track");
    const thumb = track.locator(".compact-switch-thumb");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    const geometry = await toggle.evaluate((el) => {
      const button = el.getBoundingClientRect();
      const track = el.querySelector(".compact-switch-track")!.getBoundingClientRect();
      const label = el.querySelector(".account-setting-heading")!.getBoundingClientRect();
      return {
        touch: [button.width, button.height],
        track: [track.width, track.height],
        verticallyCentered: Math.abs((track.top + track.height / 2) - (button.top + button.height / 2)) < 1,
        rightAligned: Math.abs(button.right - track.right - 6) < 2,
        labelDoesNotOverlap: label.right <= track.left,
      };
    });
    expect(geometry.touch[0]).toBeGreaterThanOrEqual(44);
    expect(geometry.touch[1]).toBeGreaterThanOrEqual(44);
    expect(geometry.track[0]).toBe(44);
    expect(geometry.track[1]).toBe(26);
    // The whole setting row is now the touch target, with its visual
    // switch vertically centered on the right and text on the left.
    expect(geometry.verticallyCentered).toBe(true);
    expect(geometry.rightAligned).toBe(true);
    expect(geometry.labelDoesNotOverlap).toBe(true);
    const before = await thumb.evaluate((el) => getComputedStyle(el).transform);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => thumb.evaluate((el) => getComputedStyle(el).transform)).not.toBe(before);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("normal and compact views share completed group behavior without changing records", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();

  const pending = page.locator(".normal-pending-list .habit-card").first();
  await expect(pending).toBeVisible();
  const name = (await pending.locator("h3").innerText()).trim();
  await pending.getByRole("button", { name: name + " 4점" }).click();
  const group = page.locator(".normal-completed-group");
  await expect(group).toBeVisible();
  await expect(group.locator(".normal-done-toggle")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".normal-completed-list")).toHaveCount(0);
  await group.locator(".normal-done-toggle").click();
  await expect(group.locator(".normal-completed-list .habit-card").filter({ hasText: name })).toBeVisible();
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "간편 보기" });
  await toggle.click();
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.locator(".compact-done-toggle")).toBeVisible();
  await page.locator(".compact-done-toggle").click();
  const finished = page.locator(".compact-completed-list .compact-habit-card").filter({ hasText: name });
  await expect(finished).toBeVisible();
  await finished.locator(".compact-habit-row").click();
  await finished.getByRole("button", { name: name + " 4점" }).click();
  await expect(page.locator(".compact-habit-group .compact-habit-card").filter({ hasText: name })).toBeVisible({ timeout: 5000 });
});

test("normal-view keyboard rating keeps focus when the completed card moves", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  const pending = page.locator(".normal-pending-list .habit-card").first();
  await expect(pending).toBeVisible();
  const name = (await pending.locator("h3").innerText()).trim();
  const star = pending.getByRole("button", { name: name + " 4점" });
  await star.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".normal-done-toggle")).toBeVisible({ timeout: 5000 });
  await expect.poll(() => page.evaluate(() => ({
    focused: document.activeElement !== document.body,
    connected: document.activeElement?.isConnected === true,
  }))).toEqual({ focused: true, connected: true });
});

test("completed reflection restores focus to the stable tab when its card folds", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "밤", exact: true }).click();
  const opener = page.locator(".normal-pending-list .habit-card .card-content").first();
  await expect(opener).toBeVisible();
  await opener.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "오늘의 실천 기록" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "단순 체크만 하기" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".normal-done-toggle")).toBeVisible();
  await expect(page.getByRole("tab", { name: "밤", exact: true })).toBeFocused();
});

test("keyboard completing the last current-period habit keeps focus on the stable tab", async ({ page }) => {
  await seedLegacyFiveHabits(page);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "낮", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  const completed = page.locator(".normal-completed-list .habit-card").first();
  const title = (await completed.locator("h3").innerText()).trim();
  await completed.getByRole("button", { name: title + " 4점" }).click();
  const pending = page.locator(".normal-pending-list .habit-card");
  await expect(pending).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);
  const star = pending.first().getByRole("button", { name: title + " 4점" });
  await star.focus();
  await page.keyboard.press("Enter");
  await expect(pending).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("tab", { name: "낮", exact: true })).toBeFocused();
  await expect(page.locator(".upcoming-heading")).toHaveCount(0);
});

for (const width of [320, 390, 430]) {
  test(`completed habit status stays with its metadata at ${width}px without stealing title space`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    const pending = page.locator(".normal-pending-list .habit-card").first();
    await expect(pending).toBeVisible();
    const title = (await pending.locator("h3").innerText()).trim();
    await pending.getByRole("button", { name: title + " 4점" }).click();
    await page.locator(".normal-done-toggle").click();
    const completed = page.locator(".normal-completed-list .habit-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(completed).toBeVisible();
    await expect(completed.locator(".card-actions .status-pill")).toHaveCount(0);
    await expect(completed.locator(".card-meta-row .status-pill.done")).toHaveText(/실천 완료/);
    await expect(completed.locator(".card-meta-row .time-badge")).toBeVisible();
    const layout = await completed.evaluate((card) => {
      const title = card.querySelector(".card-content")!.getBoundingClientRect();
      const edit = card.querySelector(".card-actions .icon-button")!.getBoundingClientRect();
      const meta = card.querySelector(".card-meta-row")!.getBoundingClientRect();
      return {
        titleEndsBeforeEdit: title.right <= edit.left + 1,
        metaInCard: meta.right <= card.getBoundingClientRect().right + 1,
      };
    });
    expect(layout.titleEndsBeforeEdit).toBe(true);
    expect(layout.metaInCard).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // focus-visible responds to keyboard modality, not an isolated script focus.
    // Switch input modality before focusing each element, as a keyboard user would.
    await page.keyboard.press("Tab");
    await completed.locator(".card-content").focus();
    await expect(completed.locator(".card-content")).toBeFocused();
    await expect(completed.locator(".card-content")).toHaveCSS("outline-style", "solid");
    await page.keyboard.press("Tab");
    await completed.getByRole("button", { name: title + " 수정" }).focus();
    await expect(completed.getByRole("button", { name: title + " 수정" })).toBeFocused();
    await expect(completed.getByRole("button", { name: title + " 수정" })).toHaveCSS("outline-style", "solid");
  });
}

for (const width of [320, 360, 390, 430]) {
  test(`normal habit cards keep separate 44px stars and aligned starts at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    const card = page.locator(".normal-pending-list .habit-card").first();
    await expect(card).toBeVisible();
    const layout = await card.evaluate((element) => {
      const heading = element.querySelector(".card-content h3")!.getBoundingClientRect();
      const emoji = element.querySelector(".habit-emoji")!.getBoundingClientRect();
      const content = element.querySelector(".card-content")!.getBoundingClientRect();
      const divider = element.querySelector(".card-rating")!.getBoundingClientRect();
      const starButtons = Array.from(element.querySelectorAll(".card-rating .star-tray button"));
      const firstStar = starButtons[0].querySelector("svg")!.getBoundingClientRect();
      const starRects = starButtons.map(button => button.getBoundingClientRect());
      const cardRect = element.getBoundingClientRect();
      return {
        titleStart: heading.left,
        starStart: firstStar.left,
        ratingWidth: divider.width,
        starSizes: starRects.map(rect => [rect.width, rect.height]),
        firstButtonLeft: starRects[0].left,
        lastButtonRight: starRects[4].right,
        ratingRight: divider.right,
        ratingBelowInfo: divider.top >= content.bottom - 1,
        hasDivider: getComputedStyle(element.querySelector(".card-rating")!).borderTopStyle === "solid",
        emojiVerticallyCentered: Math.abs((emoji.top + emoji.height / 2) - (content.top + content.height / 2)) <= 1,
        noHorizontalCardOverflow: element.scrollWidth <= element.clientWidth + 1,
        maxHeadingLines: Math.round(heading.height / parseFloat(getComputedStyle(element.querySelector(".card-content h3")!).lineHeight)),
      };
    });
    expect(layout.starSizes).toHaveLength(5);
    expect(layout.starSizes.every(([w, h]) => w >= 43.99 && h >= 43.99)).toBe(true);
    expect(layout.ratingBelowInfo).toBe(true);
    expect(layout.hasDivider).toBe(true);
    expect(layout.emojiVerticallyCentered).toBe(true);
    expect(layout.noHorizontalCardOverflow).toBe(true);
    expect(layout.lastButtonRight).toBeLessThanOrEqual(layout.ratingRight + 1);
    expect(layout.maxHeadingLines).toBeLessThanOrEqual(2);
    if (width >= 390) {
      expect(Math.abs(layout.starStart - layout.titleStart)).toBeLessThanOrEqual(2);
    } else {
      // A narrow Android viewport may relax perfect alignment before reducing
      // any 44px star target or adding horizontal scrolling.
      expect(layout.starStart).toBeLessThanOrEqual(layout.titleStart + 2);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
