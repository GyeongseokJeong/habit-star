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

test("reminder switch remains visible in forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const toggle = page.getByRole("switch", { name: "루틴 알림" });
  const track = toggle;
  const thumb = track.locator(".reminder-switch-thumb");
  await expect(track).toHaveCSS("border-top-width", "2px");
  await expect(thumb).toBeVisible();
  const colors = await track.evaluate((element) => {
    const thumb = element.querySelector(".reminder-switch-thumb")!;
    const probe = document.createElement("span");
    document.body.append(probe);
    const systemColor = (keyword: string) => {
      probe.style.color = keyword;
      return getComputedStyle(probe).color;
    };
    const result = {
      forcedColors: matchMedia("(forced-colors: active)").matches,
      offTrack: getComputedStyle(element).backgroundColor,
      offThumb: getComputedStyle(thumb.querySelector("circle")!).fill,
      canvas: systemColor("Canvas"),
      canvasText: systemColor("CanvasText"),
      highlight: systemColor("Highlight"),
      highlightText: systemColor("HighlightText"),
    };
    probe.remove();
    return result;
  });
  expect(colors.forcedColors).toBe(true);
  expect(colors.offTrack).toBe(colors.canvas);
  expect(colors.offThumb).toBe(colors.canvasText);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(track).toHaveCSS("background-color", colors.highlight);
  await expect(thumb.locator("circle")).toHaveCSS("fill", colors.highlightText);
  await expect
    .poll(() =>
      thumb.evaluate(
        (element) =>
          new DOMMatrixReadOnly(getComputedStyle(element).transform).m41,
      ),
    )
    .toBe(24);
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

for (const theme of ["light", "dark"] as const) {
  for (const width of [320, 395]) {
    test(`alarm switch geometry, motion and saved state in ${theme} at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 549 });
      await page.emulateMedia({
        colorScheme: theme === "light" ? "dark" : "light",
      });
      await page.goto("/");
      await expect(
        page.getByRole("button", { name: "새 습관 추가", exact: true }),
      ).toBeEnabled();
      if (theme === "dark") {
        await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      }
      await page
        .getByRole("button", { name: "새 습관 추가", exact: true })
        .click();
      const switchInput = page
        .getByRole("dialog", { name: "나를 위한 새로운 습관" })
        .getByRole("switch", { name: "루틴 알림" });
      const geometry = async () =>
        switchInput.evaluate((button) => {
          const box = button.getBoundingClientRect();
          const track = getComputedStyle(button);
          const thumbElement = button.querySelector(".reminder-switch-thumb")!;
          const thumb = getComputedStyle(thumbElement);
          const thumbBox = thumbElement.getBoundingClientRect();
          return {
            checked: button.getAttribute("aria-checked"),
            target: [box.width, box.height],
            border: track.borderTopWidth,
            clip: track.backgroundClip,
            radius: track.borderTopLeftRadius,
            boxSizing: track.boxSizing,
            colorScheme: track.colorScheme,
            track: [track.width, track.height, track.backgroundColor],
            thumb: [
              thumb.width,
              thumb.height,
              thumb.left,
              thumb.top,
              thumb.backgroundColor,
              getComputedStyle(thumbElement.querySelector("circle")!).fill,
            ],
            travel: new DOMMatrixReadOnly(thumb.transform).m41,
            thumbOffset: [thumbBox.left - box.left, thumbBox.top - box.top],
            duration: thumb.transitionDuration,
            overflow: document.documentElement.scrollWidth > innerWidth,
          };
        });
      await expect(switchInput).toHaveAttribute("aria-checked", "false");
      const off = await geometry();
      expect(off.target).toEqual([56, 44]);
      expect(off.border).toBe("6px");
      expect(off.clip).toBe("padding-box");
      expect(off.radius).toBe("22px");
      expect(off.boxSizing).toBe("border-box");
      expect(off.colorScheme).toBe(theme);
      expect(off.track).toEqual([
        "56px",
        "44px",
        theme === "light" ? "rgb(133, 139, 149)" : "rgb(102, 113, 131)",
      ]);
      expect(off.thumb).toEqual([
        "24px",
        "24px",
        "4px",
        "4px",
        "rgba(0, 0, 0, 0)",
        "rgb(255, 255, 255)",
      ]);
      expect(off.travel).toBe(0);
      expect(off.thumbOffset).toEqual([4, 10]);
      expect(off.duration).toBe("0.18s");
      expect(off.overflow).toBe(false);

      await switchInput.click();
      await expect(switchInput).toHaveAttribute("aria-checked", "true");
      await expect.poll(async () => (await geometry()).travel).toBe(24);
      expect((await geometry()).thumbOffset).toEqual([28, 10]);
      expect((await geometry()).thumb[5]).toBe("rgb(255, 255, 255)");
      expect((await geometry()).clip).toBe("padding-box");
      expect((await geometry()).border).toBe("6px");
      expect((await geometry()).track[2]).toBe(
        theme === "light" ? "rgb(98, 84, 126)" : "rgb(105, 90, 133)",
      );
      await switchInput.focus();
      await page.keyboard.press("Space");
      await expect(switchInput).toHaveAttribute("aria-checked", "false");
      await expect.poll(async () => (await geometry()).travel).toBe(0);
      await expect(switchInput).toHaveCSS("outline-style", "solid");
      await page.keyboard.press("Enter");
      await expect(switchInput).toHaveAttribute("aria-checked", "true");

      await page.emulateMedia({ reducedMotion: "reduce" });
      await switchInput.click();
      await expect(switchInput).toHaveAttribute("aria-checked", "false");
      await switchInput.click();
      await expect(switchInput).toHaveAttribute("aria-checked", "true");
      expect((await geometry()).travel).toBe(24);
      expect((await geometry()).duration).toBe("0s");
      await page
        .getByPlaceholder("예: 하루 10분 책 읽기")
        .fill(`알림 스위치 ${theme} ${width}`);
      await page
        .getByRole("button", { name: "새 습관 추가하기", exact: true })
        .click();
      const editSavedHabit = page.getByRole("button", {
        name: `알림 스위치 ${theme} ${width} 수정`,
        exact: true,
      });
      await expect(editSavedHabit).toBeVisible();
      await page.reload();
      await editSavedHabit.click();
      await expect(
        page.getByRole("dialog", { name: "나를 위한 새로운 습관" }),
      ).not.toBeVisible();
      await expect(
        page.getByRole("button", {
          name: `알림 스위치 ${theme} ${width} 수정`,
          exact: true,
        }),
      ).toBeVisible();
      await page.reload();
      await page
        .getByRole("button", {
          name: `알림 스위치 ${theme} ${width} 수정`,
          exact: true,
        })
        .click();
      await expect(
        page.getByRole("switch", { name: "루틴 알림" }),
      ).toHaveAttribute("aria-checked", "true");
      await expect
        .poll(() =>
          page
            .getByRole("dialog", { name: "습관 수정하기" })
            .getByRole("switch", { name: "루틴 알림" })
            .evaluate(
              (button) =>
                new DOMMatrixReadOnly(
                  getComputedStyle(
                    button.querySelector(".reminder-switch-thumb")!,
                  ).transform,
                ).m41,
            ),
        )
        .toBe(24);
      await page
        .getByRole("dialog", { name: "습관 수정하기" })
        .getByRole("button", { name: "닫기" })
        .click();
      await page
        .getByRole("heading", { name: `알림 스위치 ${theme} ${width}` })
        .click();
      const detailSwitch = page
        .getByRole("dialog", { name: "오늘의 실천 기록" })
        .getByRole("switch", { name: "루틴 알림" });
      await expect(detailSwitch).toHaveAttribute("aria-checked", "true");
      await expect(
        page.locator("dialog .reminder-switch .reminder-switch-thumb"),
      ).toBeVisible();
      await detailSwitch.click();
      await expect(detailSwitch).toHaveAttribute("aria-checked", "false");
    });
  }
}
