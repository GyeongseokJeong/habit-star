import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  test("balanced editor keeps the schedule accessible at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
    await expect(dialog.getByRole("button", { name: /템플릿$/ })).toHaveCount(3);
    await expect(dialog.locator(".emoji-picker button")).toHaveCount(5);
    await expect(dialog.getByRole("heading", { name: "실천 일정" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "매일", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(dialog.getByLabel("예정 시간")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "취소", exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("switch", { name: "루틴 알림" })).toHaveCount(0);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const targetSizes = await dialog.locator(".emoji-picker button, .repeat-weekdays button, .habit-editor-more").evaluateAll((buttons) =>
      buttons.map((element) => {
        const box = element.getBoundingClientRect();
        return [box.width, box.height];
      }),
    );
    // Layout coordinates are fractional CSS pixels; Chromium may report
    // 43.999969 for an actual CSS 44px minimum on some viewport widths.
    // Allow 0.01px measurement precision without accepting a smaller target.
    const minimumTouchTarget = 43.99;
    expect(targetSizes.filter(([w, h]) => w < minimumTouchTarget || h < minimumTouchTarget)).toEqual([]);
    const footer = dialog.locator(".habit-editor-footer");
    await dialog.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await expect(footer.getByRole("button", { name: "새 습관 추가하기" })).toBeVisible();
  });
}

test("expanded templates and icons fill only the requested fields", async ({ page }) => {
  // A weekday-only habit is shown as a card only on an active weekday.
  // Fix the clock so this regression is independent of the runner's date.
  await page.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await dialog.getByRole("button", { name: "더 많은 템플릿 보기" }).click();
  await expect(dialog.getByRole("button", { name: /템플릿$/ })).toHaveCount(20);
  await dialog.getByRole("button", { name: "영양제 챙기기 템플릿" }).click();
  await expect(dialog.getByPlaceholder("예: 하루 10분 책 읽기")).toHaveValue("영양제 챙기기");
  await expect(dialog.getByLabel("예정 시간")).toHaveValue("08:00");
  await dialog.getByRole("button", { name: "평일", exact: true }).click();
  await dialog.getByLabel("예정 시간").fill("08:35");
  await dialog.getByRole("button", { name: "영어 10분 템플릿" }).click();
  await expect(dialog.getByLabel("예정 시간")).toHaveValue("08:35");
  await expect(dialog.getByRole("button", { name: "평일", exact: true })).toHaveAttribute("aria-pressed", "true");
  // A template using an extra icon expands that fixed palette automatically.
  await expect(dialog.getByRole("button", { name: "아이콘 더 보기" })).toHaveCount(0);
  await expect(dialog.locator(".habit-editor-icons").getByRole("button", { name: "접기", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "🧹 아이콘" })).toBeVisible();
  await dialog.getByRole("button", { name: "🧹 아이콘" }).click();
  await dialog.getByRole("button", { name: "새 습관 추가하기" }).click();
  const card = page.locator(".habit-card").filter({ has: page.getByRole("heading", { name: "영어 10분" }) });
  await expect(card.locator(".habit-emoji")).toHaveText("🧹");
  await expect(card).toContainText("08:35");
  await card.getByRole("button", { name: "영어 10분 수정" }).click();
  const edit = page.getByRole("dialog", { name: "습관 수정하기" });
  await expect(edit.getByRole("button", { name: /템플릿$/ })).toHaveCount(0);
  await expect(edit.getByRole("button", { name: "🧹 아이콘" })).toHaveAttribute("aria-pressed", "true");
  await expect(edit.getByLabel("예정 시간")).toHaveValue("08:35");
  await expect(edit.getByRole("button", { name: "평일", exact: true })).toHaveAttribute("aria-pressed", "true");
});


test("B2 creation keeps a manually edited name when another template is chosen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  const title = dialog.getByPlaceholder("예: 하루 10분 책 읽기");

  await dialog.getByRole("button", { name: "독서 20분 템플릿" }).click();
  await expect(title).toHaveValue("독서 20분");
  await title.fill("퇴근 후 소설 읽기");
  await dialog.getByRole("button", { name: "물 마시기 템플릿" }).click();
  await expect(title).toHaveValue("퇴근 후 소설 읽기");
  await expect(dialog.getByRole("status")).toContainText("작성한 이름은 유지");
  await expect(dialog.getByRole("button", { name: "💧 아이콘" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "아침", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByLabel("예정 시간")).toHaveValue("07:00");

  const time = dialog.getByLabel("예정 시간");
  await time.fill("08:15");
  await dialog.getByRole("button", { name: "10분 산책 템플릿" }).click();
  await expect(title).toHaveValue("퇴근 후 소설 읽기");
  await expect(time).toHaveValue("08:15");
  // The custom time belongs to morning. A later template must preserve
  // both the manually selected time and its matching routine period.
  await expect(dialog.getByRole("button", { name: "아침", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByRole("button", { name: "낮", exact: true })).toHaveAttribute("aria-pressed", "false");
  await dialog.getByRole("button", { name: "새 습관 추가하기" }).click();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.getByRole("heading", { name: "퇴근 후 소설 읽기", exact: true })).toBeVisible();
});

test("B2 creation uses compact quick options while existing habit editing is unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  const templates = dialog.locator(".template-picker button");
  await expect(templates).toHaveCount(3);
  await expect(dialog.locator(".emoji-picker button")).toHaveCount(5);
  await expect(dialog.locator(".habit-editor-optional-time")).toBeVisible();
  await expect(dialog.locator(".habit-editor-footer .text-button")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "아이콘 더 보기" })).toBeVisible();
  await dialog.getByRole("button", { name: "아이콘 더 보기" }).click();
  await expect(dialog.locator(".emoji-picker button")).toHaveCount(36);
  await expect(dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).resolves.toBe(true);
});
