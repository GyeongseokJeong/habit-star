import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1365, height: 1000 },
]) {
  test(`emoji pixels, picker and responsive themes at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "미온수 한 잔 & 영양제", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("별하루를 더 가까이", { exact: true }),
    ).toHaveCount(0);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      await expect(page.locator(`.byeolharu.${theme}`)).toBeVisible();
      const result = await page.evaluate(async () => {
        await document.fonts.ready;
        const icons = [
          ...document.querySelectorAll<HTMLElement>(".habit-emoji"),
        ];
        const pixels = icons.map((icon) => {
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 80;
          const context = canvas.getContext("2d")!;
          context.font = `40px ${getComputedStyle(icon).fontFamily}`;
          context.fillText(icon.textContent!, 0, 50);
          return [...context.getImageData(0, 0, 80, 80).data].filter(
            (v, i) => i % 4 === 3 && v > 0,
          ).length;
        });
        return {
          pixels,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(result.overflow).toBe(false);
      expect(result.pixels).toHaveLength(5);
      expect(result.pixels.every((count) => count > 100)).toBe(true);
    }
    await page
      .getByRole("button", { name: "새 습관 추가", exact: true })
      .click();
    await expect(page.locator(".emoji-picker button")).toHaveCount(12);
    await page.getByRole("button", { name: "🌱 아이콘", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "🌱 아이콘", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page
      .getByPlaceholder("예: 하루 10분 책 읽기")
      .fill("아이콘 보존 확인");
    await page
      .getByRole("button", { name: "새 습관 추가하기", exact: true })
      .click();
    const card = page.locator(".habit-card").filter({
      has: page.getByRole("heading", {
        name: "아이콘 보존 확인",
        exact: true,
      }),
    });
    await expect(card.locator(".habit-emoji")).toHaveText("🌱");
    await page.reload();
    await expect(card.locator(".habit-emoji")).toHaveText("🌱");
  });
}

test("the hero star brightens with each completed habit and dims when undone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 395, height: 595 });
  await page.goto("/");
  const hero = page.getByRole("region", { name: "오늘의 별빛" });
  await expect(hero).toContainText("3 / 5");
  await expect(hero.locator(".starlit-star")).toHaveCSS("opacity", "0.712");

  await page
    .getByRole("button", { name: "독서 30분 & TOP 50 책장 1점" })
    .click();
  await expect(hero).toContainText("4 / 5");
  await expect(hero.locator(".starlit-star")).toHaveCSS("opacity", "0.856");

  await page.getByRole("button", { name: "취침 전 스트레칭 10분 1점" }).click();
  await expect(hero).toContainText("5 / 5");
  await expect(hero).toContainText("오늘의 모든 별이 환하게 빛나요");
  await expect(hero.locator(".starlit-star")).toHaveCSS("opacity", "1");

  await page
    .getByRole("button", { name: "독서 30분 & TOP 50 책장 1점" })
    .click();
  await expect(hero).toContainText("4 / 5");
  await expect(hero.locator(".starlit-star")).toHaveCSS("opacity", "0.856");

  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("새로운 작은 습관");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await expect(hero).toContainText("4 / 6");
  await expect(hero.locator(".starlit-star")).toHaveCSS("opacity", "0.76");
  await expect
    .poll(async () =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});

test("legacy custom emoji remains selected without changing the original", async ({
  page,
}) => {
  const raw = JSON.stringify([
    {
      id: "legacy-icon",
      title: "나만의 이모지",
      icon: "🦉",
      timeGroup: "night",
      completed: false,
      rating: 0,
      memo: "남겨둔 메모",
      alarmEnabled: false,
    },
  ]);
  await page.addInitScript((raw) => {
    localStorage.setItem("byeolharu_v1_habits", raw);
    localStorage.setItem("byeolharu_v1_day", "2026-01-01");
  }, raw);
  await page.goto("/");
  await page
    .getByRole("button", { name: "나만의 이모지 수정", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "🦉 아이콘", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "수정 완료", exact: true }).click();
  await expect(page.locator(".habit-emoji").first()).toHaveText("🦉");
  expect(
    await page.evaluate(() => localStorage.getItem("byeolharu_v1_habits")),
  ).toBe(raw);
});

test("install action is only in settings when a real prompt is available", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "미온수 한 잔 & 영양제", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.assign(event, {
      prompt: async () => {
        document.body.dataset.installPrompt = "opened";
      },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(event);
  });
  await expect(
    page.getByRole("button", { name: "별하루 앱 설치" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page
    .getByRole("button", { name: "별하루 앱 설치", exact: true })
    .click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-install-prompt",
    "opened",
  );
  await expect(
    page.getByRole("button", { name: "별하루 앱 설치", exact: true }),
  ).toHaveCount(0);
});

test("auth tabs, password visibility, resend cooldown and reset preserve existing endpoints", async ({
  page,
}) => {
  let resends = 0;
  await page.route("**/auth/v1/resend**", (route) => {
    resends++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "{}",
    });
  });
  await page.route("**/auth/v1/recover**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "회원가입", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute(
    "autocomplete",
    "new-password",
  );
  await page
    .getByRole("button", { name: "비밀번호 표시", exact: true })
    .click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page
    .getByLabel("이메일", { exact: true })
    .fill("ui-check@example.test");
  await page
    .getByRole("button", { name: "인증 메일이 오지 않았나요?" })
    .click();
  await expect(page.getByLabel("인증받을 이메일")).toHaveValue(
    "ui-check@example.test",
  );
  await page
    .getByRole("button", { name: "인증 메일 다시 보내기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /초 후 재발송 가능/ }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("이메일을 확인해주세요");
  expect(resends).toBe(1);
  await page
    .getByRole("button", { name: "비밀번호 찾기", exact: true })
    .click();
  await expect(page.getByLabel("비밀번호", { exact: true })).toHaveCount(0);
  await page
    .getByRole("button", { name: "재설정 메일 보내기", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("이메일을 확인해주세요");
});
