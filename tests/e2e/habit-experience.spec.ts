import { expect, test } from "@playwright/test";

const templates = [
  { title: "독서 20분", icon: "📚", group: "밤" },
  { title: "가벼운 운동", icon: "🏃", group: "아침" },
  { title: "물 마시기", icon: "💧", group: "아침" },
  { title: "스트레칭", icon: "🧘", group: "밤" },
  { title: "일찍 잠들기", icon: "🌙", group: "밤" },
  { title: "하루 기록하기", icon: "✍️", group: "밤" },
];

for (const width of [320, 390, 430]) {
  test(`templates stay editable and compact at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "새 습관 추가", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "새 습관 추가", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
    const name = dialog.getByPlaceholder("예: 하루 10분 책 읽기");
    for (const template of templates) {
      const option = dialog.getByRole("button", {
        name: `${template.title} 템플릿`,
      });
      await option.click();
      await expect(option).toHaveAttribute("aria-pressed", "true");
      await expect(name).toHaveValue(template.title);
      await expect(
        dialog.getByRole("button", { name: `${template.icon} 아이콘` }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        dialog.getByRole("button", { name: template.group, exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
      await expect(
        dialog.getByRole("button", { name: "매일", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
    }
    await expect(
      page.getByRole("heading", { name: "하루 기록하기", exact: true }),
    ).toHaveCount(0);
    await name.fill("나만의 하루 기록");
    await dialog.getByRole("button", { name: "낮", exact: true }).click();
    await dialog.getByRole("button", { name: "평일", exact: true }).click();
    await dialog.getByLabel("예정 시간").fill("13:30");
    await dialog.getByRole("checkbox", { name: "루틴 알림" }).check();
    await expect(
      dialog.getByRole("button", { name: "하루 기록하기 템플릿" }),
    ).toHaveAttribute("aria-pressed", "false");
    await dialog.getByRole("button", { name: "밤", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "하루 기록하기 템플릿" }),
    ).toHaveAttribute("aria-pressed", "false");
    await dialog.getByRole("button", { name: "낮", exact: true }).click();
    expect(
      await dialog.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await dialog.getByRole("button", { name: "새 습관 추가하기" }).click();
    await page.getByRole("button", { name: "나만의 하루 기록 수정" }).click();
    const edit = page.getByRole("dialog", { name: "습관 수정하기" });
    await expect(edit.getByRole("button", { name: /템플릿/ })).toHaveCount(0);
    await expect(edit.getByPlaceholder("예: 하루 10분 책 읽기")).toHaveValue(
      "나만의 하루 기록",
    );
    await expect(
      edit.getByRole("button", { name: "평일", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      edit.getByRole("checkbox", { name: "루틴 알림" }),
    ).toBeChecked();
    await edit.getByRole("button", { name: "매일", exact: true }).click();
    await edit.getByRole("button", { name: "수정 완료" }).click();
    await expect(edit).not.toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "나만의 하루 기록 수정" }).click();
    await expect(
      page.getByRole("button", { name: "매일", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
}

test("templates are keyboard accessible in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "다크 모드로 전환" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "다크 모드로 전환" }).click();
  await page.getByRole("button", { name: "새 습관 추가" }).click();
  const template = page.getByRole("button", { name: "독서 20분 템플릿" });
  await template.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(template).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Space");
  await expect(template).toHaveAttribute("aria-pressed", "true");
  await expect(template).toHaveCSS("background-color", "rgb(105, 90, 133)");
  await expect(
    page.getByRole("checkbox", { name: "루틴 알림" }),
  ).not.toBeChecked();
});

test("direct entry remains available without selecting a template", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가" }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("직접 만든 습관");
  await page.getByRole("button", { name: "새 습관 추가하기" }).click();
  await expect(
    page.getByRole("heading", { name: "직접 만든 습관" }),
  ).toBeVisible();
});

test("rapid stars update immediately, keep the card steady, and persist the last value offline", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "새 습관 추가", exact: true }),
  ).toBeEnabled();
  const title = "연속 입력 습관";
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill(title);
  await page.getByRole("button", { name: "새 습관 추가하기" }).click();
  const card = page
    .locator(".habit-card")
    .filter({ has: page.getByRole("heading", { name: title }) });
  await expect(card).toBeVisible();
  const hero = page.locator(".starlit-hero .starlit-star");
  const initialOpacity = Number(
    await hero.evaluate((element) => getComputedStyle(element).opacity),
  );
  const beforeIndex = await card.evaluate((element) =>
    Array.from(element.parentElement!.children).indexOf(element),
  );
  await context.setOffline(true);
  for (let rating = 1; rating <= 5; rating++) {
    await card.getByRole("button", { name: `${title} ${rating}점` }).click();
    await expect(
      card.getByRole("button", { name: `${title} ${rating}점` }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  expect(
    Number(await hero.evaluate((element) => getComputedStyle(element).opacity)),
  ).toBeGreaterThan(initialOpacity);
  await card.getByRole("button", { name: `${title} 5점` }).click();
  await expect(card).toContainText("미기록");
  await card.getByRole("button", { name: `${title} 3점` }).click();
  await card.getByRole("button", { name: `${title} 4점` }).click();
  await expect(
    card.getByRole("button", { name: `${title} 4점` }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await card.evaluate((element) =>
      Array.from(element.parentElement!.children).indexOf(element),
    ),
  ).toBe(beforeIndex);
  await expect
    .poll(() =>
      card.evaluate((element) =>
        Array.from(element.parentElement!.children).indexOf(element),
      ),
    )
    .toBeGreaterThan(beforeIndex);
  await expect(page.getByText(/기록 완료!|별점 기록을 취소했어요/)).toHaveCount(
    0,
  );
  await context.setOffline(false);
  await page.reload();
  await expect(
    page.getByRole("button", { name: `${title} 4점` }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: `${title} 4점` }).click();
  await expect(
    page.getByRole("button", { name: `${title} 4점` }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(
    page.getByRole("button", { name: `${title} 4점` }),
  ).toHaveAttribute("aria-pressed", "false");
});
