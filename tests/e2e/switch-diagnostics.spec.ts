import { expect, test, type Page } from "@playwright/test";

const sample = (page: Page, variant: "A" | "B" | "C") =>
  page.locator(`[data-variant="${variant}"]`);

async function colors(page: Page) {
  return page.locator("[data-switch-diagnostics]").evaluate((root) => {
    const reference = getComputedStyle(
      root.querySelector("[data-selected-time]")!,
    );
    const results = Object.fromEntries(
      (["A", "B", "C"] as const).map((name) => {
        const track = root.querySelector(
          `[data-variant="${name}"] [data-track]`,
        )!;
        const thumb = track.querySelector("[data-thumb]");
        const rect =
          name === "A"
            ? root
                .querySelector(`[data-variant="${name}"] .toggle-input`)!
                .getBoundingClientRect()
            : track.getBoundingClientRect();
        return [
          name,
          {
            background: getComputedStyle(track).backgroundColor,
            thumb: getComputedStyle(
              thumb ?? track,
              thumb ? undefined : "::after",
            ).backgroundColor,
            target: [rect.width, rect.height],
          },
        ];
      }),
    );
    return { reference: reference.backgroundColor, results };
  });
}

test("dev-only comparison matches selection tokens in both app themes and OS modes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 395, height: 595 });
  await page.goto("/diagnostics/switch");
  await expect(
    page.getByRole("heading", { name: "브라우저 색상 A/B/B2 비교" }),
  ).toBeVisible();
  await expect(page.locator('[data-variant="A"] input')).toHaveCSS(
    "color-scheme",
    "light only",
  );

  for (const appTheme of ["light", "dark"] as const) {
    for (const osTheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: osTheme });
      await page
        .getByRole("button", { name: "OS 설정 변경 후 다시 측정" })
        .click();
      await expect
        .poll(
          async () =>
            JSON.parse(
              (await page.locator("[data-diagnostic-report]").innerText()) ||
                "null",
            )?.environment?.osDark,
        )
        .toBe(osTheme === "dark");
      const off = await colors(page);
      for (const name of ["A", "B", "C"] as const) {
        expect(off.results[name].target).toEqual([56, 44]);
        expect(off.results[name].thumb).toBe("rgb(255, 255, 255)");
        expect(off.results[name].background).toBe(
          appTheme === "light" ? "rgb(133, 139, 149)" : "rgb(102, 113, 131)",
        );
      }
      for (const name of ["A", "B", "C"] as const) {
        const control =
          name === "A"
            ? sample(page, name).getByRole("checkbox", { name: "루틴 알림 A" })
            : sample(page, name).getByRole("switch", {
                name: `루틴 알림 ${name}`,
              });
        await control.click();
      }
      await expect
        .poll(async () => (await colors(page)).results.C.background)
        .toBe(off.reference);
      const on = await colors(page);
      for (const name of ["A", "B", "C"] as const) {
        expect(on.results[name].background).toBe(on.reference);
        expect(on.results[name].thumb).toBe("rgb(255, 255, 255)");
      }
      expect(
        JSON.parse(
          (await page.locator("[data-diagnostic-report]").innerText()) ||
            "null",
        )?.environment?.appTheme,
      ).toBe(appTheme);
      for (const name of ["A", "B", "C"] as const) {
        const control =
          name === "A"
            ? sample(page, name).getByRole("checkbox", { name: "루틴 알림 A" })
            : sample(page, name).getByRole("switch", {
                name: `루틴 알림 ${name}`,
              });
        await control.click();
      }
      await expect
        .poll(async () => (await colors(page)).results.C.background)
        .toBe(off.results.C.background);
    }
    if (appTheme === "light") {
      await page.getByRole("button", { name: "앱 다크 모드로 전환" }).click();
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("diagnostic palette reports matrix, modal and controls independently of OS theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 395, height: 595 });
  await page.goto("/diagnostics/switch");
  for (const appTheme of ["light", "dark"] as const) {
    for (const osTheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: osTheme });
      await page
        .getByRole("button", { name: "OS 설정 변경 후 다시 측정" })
        .click();
      const report = page.locator("[data-diagnostic-report]");
      await expect
        .poll(
          async () =>
            JSON.parse((await report.innerText()) || "null")?.environment
              ?.osDark,
        )
        .toBe(osTheme === "dark");
      const data = JSON.parse(await report.innerText());
      expect(data.environment.appTheme).toBe(appTheme);
      expect(data.environment.documentScheme).toBe("light");
      expect(data.environment.appScheme).toBe(appTheme);
      expect(data.environment.themeColor).toMatch(/#f7f6f2/i);
      expect(data.samples.page.background).toBe(
        appTheme === "light" ? "rgb(247, 246, 242)" : "rgb(12, 17, 27)",
      );
      expect(data.samples.surface.background).toBe(
        appTheme === "light" ? "rgb(255, 255, 255)" : "rgb(23, 29, 41)",
      );
      expect(data.samples.modal.background).toBe(
        data.samples.surface.background,
      );
      expect(data.samples["disabled-date"].opacity).toBe("0.55");
      expect(data.samples["disabled-button"].opacity).toBe("0.5");
      expect(data.samples.gradient.backgroundImage).toContain(
        "linear-gradient",
      );
      expect(data.samples.artwork.filter).toBe("none");
      await expect(
        page.getByAltText("승인된 6단계 별자리: 금빛 뿔의 별빛 사슴"),
      ).toBeVisible();
      expect(data.samples["modal-input"].colorScheme).toBe(appTheme);
      expect(data.samples["primary-button"].background).toBe(
        appTheme === "light" ? "rgb(82, 111, 101)" : "rgb(164, 193, 178)",
      );
      expect(data.selectedTime.background).toBe(
        appTheme === "light" ? "rgb(98, 84, 126)" : "rgb(105, 90, 133)",
      );
      expect(Object.keys(data.matrix)).toEqual(
        Array.from({ length: 6 }, (_, tier) => `tier-${tier}`),
      );
      expect(data.matrix["tier-0"].background).toBe(
        appTheme === "light" ? "rgb(240, 241, 236)" : "rgb(29, 38, 51)",
      );
      expect(data.matrix["tier-5"].background).toBe(
        appTheme === "light" ? "rgb(167, 128, 69)" : "rgb(197, 163, 108)",
      );
      expect(data.matrix["tier-5"].foreground).toBe(
        appTheme === "light" ? "rgb(255, 255, 255)" : "rgb(23, 28, 26)",
      );
    }
    if (appTheme === "light")
      await page.getByRole("button", { name: "앱 다크 모드로 전환" }).click();
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("button variants support Space, Enter, focus and forced colors", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/diagnostics/switch");
  const first = sample(page, "B").getByRole("switch", { name: "루틴 알림 B" });
  const second = sample(page, "C").getByRole("switch", { name: "루틴 알림 C" });
  await expect(first).toHaveAttribute("aria-checked", "false");
  const off = await colors(page);
  expect(off.results.A.background).toBe(off.results.B.background);
  expect(off.results.B.background).toBe(off.results.C.background);
  const original = sample(page, "A").getByRole("checkbox", {
    name: "루틴 알림 A",
  });
  await original.check();
  await original.focus();
  await page.keyboard.press("Tab");
  await expect(first).toBeFocused();
  await expect(first).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Space");
  await expect(first).toHaveAttribute("aria-checked", "true");
  await second.focus();
  await page.keyboard.press("Enter");
  await expect(second).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await page.locator("[data-diagnostic-report]").innerText()) ||
            "null",
        )?.environment?.forcedColors,
    )
    .toBe(true);
  const on = await colors(page);
  for (const name of ["A", "B", "C"] as const) {
    expect(on.results[name].target).toEqual([56, 44]);
  }
  expect(on.results.A.background).toBe(on.results.B.background);
  expect(on.results.B.background).toBe(on.results.C.background);
  expect(on.results.A.thumb).toBe(on.results.B.thumb);
  expect(on.results.B.thumb).toBe(on.results.C.thumb);
});


test("A/B/B2 palette candidates are isolated to diagnostics and dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/diagnostics/switch");
  const a = page.locator('[data-palette-preview="current"]');
  const b = page.locator('[data-palette-preview="refined"]');
  const b2 = page.locator('[data-palette-preview="refined2"]');
  await expect(a).toBeVisible();
  await expect(b).toBeVisible();
  await expect(b2).toBeVisible();

  const report = page.locator("[data-diagnostic-report]");
  const option = (value: "current" | "refined" | "refined2") =>
    page.locator(`[data-palette-option="${value}"]`);
  await expect(option("current")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "앱 다크 모드로 전환" }).click();

  await option("refined").click();
  await expect(option("refined")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () =>
    JSON.parse((await report.innerText()) || "null")?.matrix?.["tier-0"]?.background,
  ).toBe("rgb(39, 50, 67)");

  await option("refined2").click();
  await expect(option("refined2")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () =>
    JSON.parse((await report.innerText()) || "null")?.environment?.palette,
  ).toBe("refined2");
  await expect.poll(async () =>
    JSON.parse((await report.innerText()) || "null")?.matrix?.["tier-0"]?.background,
  ).toBe("rgb(46, 60, 79)");
  await expect.poll(async () =>
    JSON.parse((await report.innerText()) || "null")?.matrix?.["tier-3"]?.background,
  ).toBe("rgb(128, 104, 71)");
  await expect.poll(async () =>
    JSON.parse((await report.innerText()) || "null")?.samples?.["disabled-date"]?.opacity,
  ).toBe("1");

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole("button", { name: "앱 라이트 모드로 전환" }).click();
  await expect.poll(async () =>
    JSON.parse((await report.innerText()) || "null")?.samples?.page?.background,
  ).toBe("rgb(247, 246, 242)");

  await page.getByRole("button", { name: "앱 다크 모드로 전환" }).click();
  await option("current").click();
  await expect(option("current")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () =>
    JSON.parse((await report.innerText()) || "null")?.matrix?.["tier-0"]?.background,
  ).toBe("rgb(29, 38, 51)");
});
