import { expect, test } from "@playwright/test";

for (const width of [320, 390, 430]) {
  test(`weekday picker stays on one row with stable icon positions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 760 });
    await page.goto("/");
    await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
    const days = dialog.getByRole("group", { name: "반복할 요일" });
    const dayButtons = days.getByRole("button");
    await expect(dayButtons).toHaveCount(7);

    const dimensions = await dayButtons.evaluateAll((buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
      }),
    );
    expect(Math.max(...dimensions.map((day) => day.top)) - Math.min(...dimensions.map((day) => day.top))).toBeLessThan(2);
    expect(dimensions.every((day) => day.height >= 44 && day.width >= 44)).toBe(true);
    expect(dimensions.every((day, index) => index === 0 || day.left > dimensions[index - 1].left)).toBe(true);
    expect(await days.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);

    await days.getByRole("button", { name: "수요일" }).click();
    await expect(days.getByRole("button", { name: "수요일" })).toHaveAttribute("aria-pressed", "false");
    await expect(days.getByRole("button", { name: "월요일" })).toHaveAttribute("aria-pressed", "true");

    const palette = dialog.locator("#habit-editor-icons");
    await expect(palette.locator("button")).toHaveCount(5);
    await dialog.getByRole("button", { name: "아이콘 더 보기" }).click();
    const positionsBefore = await palette.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
    await palette.getByRole("button", { name: "💻 아이콘" }).click();
    await expect(palette.getByRole("button", { name: "💻 아이콘" })).toHaveAttribute("aria-pressed", "true");
    const positionsAfter = await palette.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
    expect(positionsAfter).toEqual(positionsBefore);
    await palette.getByRole("button", { name: "🌱 아이콘" }).click();
    const positionsAfterSecondPick = await palette.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
    expect(positionsAfterSecondPick).toEqual(positionsBefore);

    await expect(dialog.locator(".habit-editor-icons").getByRole("button", { name: "접기" })).toBeVisible();
    const expandedPalette = await palette.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
    expect(expandedPalette.slice(0, positionsBefore.length)).toEqual(positionsBefore);
    await palette.getByRole("button", { name: "💊 아이콘" }).click();
    const afterExtraSelection = await palette.locator("button").evaluateAll((buttons) =>
      buttons.map((button) => button.getAttribute("aria-label")),
    );
    expect(afterExtraSelection).toEqual(expandedPalette);
    await expect(palette.getByRole("button", { name: "💊 아이콘" })).toHaveAttribute("aria-pressed", "true");
  });
}

test("choosing an extra-icon template reveals it in its fixed position", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await dialog.getByRole("button", { name: "더 많은 템플릿 보기" }).click();
  await dialog.getByRole("button", { name: "영양제 챙기기 템플릿" }).click();
  await expect(dialog.getByRole("button", { name: "💊 아이콘" })).toHaveAttribute("aria-pressed", "true");
  const icons = await dialog.locator("#habit-editor-icons button").evaluateAll((buttons) =>
    buttons.map((button) => button.getAttribute("aria-label")),
  );
  expect(icons.indexOf("💊 아이콘")).toBe(12);
  expect(icons[0]).toBe("💧 아이콘");
});
