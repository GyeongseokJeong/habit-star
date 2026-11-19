import { expect, test, type Page } from "@playwright/test";

const rgb = (value: string) =>
  value
    .match(/[\d.]+/g)!
    .slice(0, 3)
    .map(Number);

function contrast(first: string, second: string) {
  const luminance = (color: string) => {
    const channels = rgb(color).map((value) => {
      const normalized = value / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

async function checkControls(page: Page, theme: "light" | "dark") {
  const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await expect(dialog).toBeVisible();
  const selected = dialog.getByRole("button", { name: "아침", exact: true });
  const unselected = dialog.getByRole("button", { name: "낮", exact: true });
  await expect(selected).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const modal = document.querySelector<HTMLDialogElement>(".modal")!;
        return [
          modal.querySelector(".segmented button.selected"),
          modal.querySelector(".repeat-weekdays button.selected"),
          modal.querySelector(".emoji-picker button.selected"),
        ].map((element) => getComputedStyle(element!).backgroundColor);
      }),
    )
    .toEqual(
      Array(3).fill(
        theme === "light" ? "rgb(98, 84, 126)" : "rgb(105, 90, 133)",
      ),
    );
  const colors = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".byeolharu")!;
    const modal = document.querySelector<HTMLDialogElement>(".modal")!;
    const control = modal.querySelector<HTMLElement>(
      ".segmented button.selected",
    )!;
    const idle = modal.querySelector<HTMLElement>(
      ".segmented button:not(.selected)",
    )!;
    const input = modal.querySelector<HTMLInputElement>('input[type="time"]')!;
    const emoji = modal.querySelector<HTMLElement>(
      ".emoji-picker button.selected",
    )!;
    const weekday = modal.querySelector<HTMLElement>(
      ".repeat-weekdays button.selected",
    )!;
    return {
      scheme: getComputedStyle(modal).colorScheme,
      inputScheme: getComputedStyle(input).colorScheme,
      background: getComputedStyle(modal).backgroundColor,
      foreground: getComputedStyle(modal).color,
      controlBg: getComputedStyle(control).backgroundColor,
      controlFg: getComputedStyle(control).color,
      idleBg: getComputedStyle(idle).backgroundColor,
      idleFg: getComputedStyle(idle).color,
      emojiBg: getComputedStyle(emoji).backgroundColor,
      emojiFont: getComputedStyle(emoji).fontFamily,
      emojiMark: getComputedStyle(emoji, "::after").content,
      weekdayBg: getComputedStyle(weekday).backgroundColor,
      inputBg: getComputedStyle(input).backgroundColor,
      selectedWeight: getComputedStyle(control).fontWeight,
      tokens: {
        selected: getComputedStyle(shell)
          .getPropertyValue("--selection-bg")
          .trim(),
        idle: getComputedStyle(shell).getPropertyValue("--control-bg").trim(),
      },
      targets: [
        ...modal.querySelectorAll<HTMLElement>(
          ".emoji-picker button, .segmented button, .repeat-weekdays button, .reminder-switch",
        ),
      ].map((element) => {
        const rect = element.getBoundingClientRect();
        return [rect.width, rect.height];
      }),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(colors.scheme).toBe(theme);
  expect(colors.inputScheme).toBe(theme);
  expect(colors.background).toBe(
    theme === "light" ? "rgb(255, 255, 255)" : "rgb(23, 29, 41)",
  );
  expect(colors.inputBg).toBe(
    theme === "light" ? "rgb(247, 246, 242)" : "rgb(12, 17, 27)",
  );
  expect(colors.controlBg).toBe(colors.weekdayBg);
  expect(colors.controlBg).toBe(colors.emojiBg);
  expect(colors.controlBg).not.toBe(colors.idleBg);
  expect(colors.emojiFont).toContain("Emoji");
  expect(colors.emojiMark).toContain("✓");
  expect(Number(colors.selectedWeight)).toBeGreaterThanOrEqual(700);
  expect(contrast(colors.controlFg, colors.controlBg)).toBeGreaterThanOrEqual(
    4.5,
  );
  expect(contrast(colors.idleFg, colors.idleBg)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(
    4.5,
  );
  expect(
    colors.targets.every(([width, height]) => width >= 44 && height >= 44),
  ).toBe(true);
  expect(colors.overflow).toBe(false);
  await expect(unselected).toHaveAttribute("aria-pressed", "false");
}

test("hidden reminder affordances do not distract from keyboard-accessible editor controls in forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "알림 메뉴" })).toHaveCount(0);
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await expect(dialog.getByRole("switch", { name: "루틴 알림" })).toHaveCount(0);
  const selection = dialog.getByRole("button", { name: "아침", exact: true });
  await selection.focus();
  await page.keyboard.press("Space");
  await expect(selection).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.getByLabel("예정 시간")).toBeVisible();
});

for (const width of [320, 390, 430]) {
  test(`editor selection and OS/app theme independence at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 820 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "새 습관 추가", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "새 습관 추가", exact: true })
      .click();
    await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("테마 유지");
    await page.getByRole("button", { name: "아침", exact: true }).click();
    for (const osTheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: osTheme });
      for (const appTheme of ["light", "dark"] as const) {
        const current = page.locator(".byeolharu");
        if (
          !(await current.evaluate(
            (element, value) => element.classList.contains(value),
            appTheme,
          ))
        ) {
          await page.evaluate(
            (name) => {
              document
                .querySelector<HTMLButtonElement>(
                  `button[aria-label="${name}"]`,
                )!
                .click();
            },
            appTheme === "dark" ? "다크 모드로 전환" : "라이트 모드로 전환",
          );
        }
        await expect(current).toHaveClass(new RegExp(appTheme));
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
          "content",
          appTheme === "light" ? /#f7f6f2/i : /#0c111b/i,
        );
        await checkControls(page, appTheme);
        await expect(
          page.getByPlaceholder("예: 하루 10분 책 읽기"),
        ).toHaveValue("테마 유지");
      }
    }
    const days = page.getByRole("group", { name: "반복할 요일" });
    await page.getByRole("button", { name: "평일", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "평일", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(days.getByRole("button", { pressed: true })).toHaveCount(5);
    await days.getByRole("button", { name: "토요일" }).focus();
    await page.keyboard.press("Space");
    await expect(days.getByRole("button", { name: "토요일" })).toHaveCSS(
      "outline-style",
      "solid",
    );
    await expect(days.getByRole("button", { name: "토요일" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("button", { name: "평일", exact: true }),
    ).toHaveAttribute("aria-pressed", "false");
    await page.getByRole("button", { name: "주말", exact: true }).click();
    await expect(days.getByRole("button", { pressed: true })).toHaveCount(2);
    await page.getByRole("button", { name: "매일", exact: true }).click();
    await expect(days.getByRole("button", { pressed: true })).toHaveCount(7);
    const emoji = page.getByRole("button", { name: "📚 아이콘" });
    await emoji.click();
    await expect(emoji).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "🌱 아이콘" }),
    ).toHaveAttribute("aria-pressed", "false");
  });
}

// Reminder toggles are deferred, but previously saved alarmEnabled values
// must survive edits, reloads and theme changes for the future notification release.
for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 395]) {
    test(`deferred reminder settings remain saved but hidden at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 549 });
      await page.goto("/");
      if (theme === "dark") await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      await page.getByRole("tab", { name: "전체", exact: true }).click();
      await expect(page.getByRole("button", { name: "알림 메뉴" })).toHaveCount(0);
      const cards = page.locator(".habit-card");
      await expect(cards).toHaveCount(5);
      await expect(cards.first().getByRole("button", { name: /알림/ })).toHaveCount(0);
      const before = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("byeolharu-v2");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const tx = db.transaction("scopes", "readonly");
          const state = await new Promise<{ entities: Record<string, { kind: string; data: { alarmEnabled?: boolean } }> }>((resolve, reject) => {
            const request = tx.objectStore("scopes").get("guest");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          return Object.values(state.entities).filter((entry) => entry.kind === "habits").map((entry) => entry.data.alarmEnabled);
        } finally { db.close(); }
      });
      expect(before).toContain(true);
      await page.getByRole("button", { name: "미온수 한 잔 & 영양제 수정", exact: true }).click();
      const editor = page.getByRole("dialog", { name: "습관 수정하기" });
      await expect(editor.getByRole("switch", { name: "루틴 알림" })).toHaveCount(0);
      await editor.getByLabel("예정 시간").fill("08:30");
      await editor.getByRole("button", { name: "수정 완료" }).click();
      await expect(page.getByRole("button", { name: "미온수 한 잔 & 영양제 수정" })).toBeVisible();
      await expect(page.locator(".habit-card").filter({ has: page.getByRole("heading", { name: "미온수 한 잔 & 영양제" }) })).toContainText("08:30");
      await page.reload();
      await page.getByRole("tab", { name: "전체", exact: true }).click();
      await expect(page.getByRole("button", { name: "알림 메뉴" })).toHaveCount(0);
      const after = await page.evaluate(async () => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("byeolharu-v2");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        try {
          const tx = db.transaction("scopes", "readonly");
          const state = await new Promise<{ entities: Record<string, { kind: string; data: { alarmEnabled?: boolean; title?: string; scheduledTime?: string } }> }>((resolve, reject) => {
            const request = tx.objectStore("scopes").get("guest");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
          return Object.values(state.entities).filter((entry) => entry.kind === "habits").map((entry) => entry.data);
        } finally { db.close(); }
      });
      expect(after.find((item) => item.title === "미온수 한 잔 & 영양제")).toMatchObject({
        alarmEnabled: true, scheduledTime: "08:30",
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const stars = page.getByRole("button", { name: "미온수 한 잔 & 영양제 1점" });
      const target = await stars.boundingBox();
      expect(target!.width).toBeGreaterThanOrEqual(44);
      expect(target!.height).toBeGreaterThanOrEqual(44);
      await stars.focus();
      await expect(stars).toHaveCSS("outline-style", "solid");
    });
  }
}
