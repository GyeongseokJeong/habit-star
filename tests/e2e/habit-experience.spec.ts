import { expect, test } from "@playwright/test";

const templates = [
  { title: "물 마시기", icon: "💧", group: "아침" },
  { title: "가벼운 운동", icon: "🏃", group: "아침" },
  { title: "10분 산책", icon: "🚶", group: "낮" },
  { title: "집중 25분", icon: "💻", group: "낮" },
  { title: "독서 20분", icon: "📚", group: "밤" },
  { title: "하루 기록하기", icon: "✍️", group: "밤" },
];

for (const width of [320, 390, 430]) {
  test(`templates stay editable and compact at ${width}px`, async ({
    page,
  }) => {
    // This test switches to weekdays-only. Keep it on a Thursday so
    // the new habit is scheduled and visible regardless of the runner date.
    await page.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
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
    const options = dialog.getByRole("button", { name: / 템플릿$/ });
    await expect(options).toHaveText(["📚독서 20분", "💧물 마시기", "🚶10분 산책"]);
    await dialog.getByRole("button", { name: "더 많은 템플릿 보기" }).click();
    await expect(options).toHaveCount(20);
    for (const title of ["스트레칭", "일찍 잠들기"]) {
      await dialog.getByRole("button", { name: title + " 템플릿", exact: true }).click();
      await expect(name).toHaveValue(title);
    }
    await dialog.getByRole("group", { name: "추천 템플릿" }).getByRole("button", { name: "접기" }).click();
    await expect(options).toHaveCount(3);
    await dialog.getByRole("button", { name: "더 많은 템플릿 보기" }).click();
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
    await expect(dialog.getByRole("switch", { name: "루틴 알림" })).toHaveCount(0);
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
    await expect(edit.getByRole("switch", { name: "루틴 알림" })).toHaveCount(0);
    await edit.getByRole("button", { name: "매일", exact: true }).click();
    await edit.getByRole("button", { name: "수정 완료" }).click();
    await expect(edit).not.toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    await page.getByRole("button", { name: "나만의 하루 기록 수정" }).click();
    await expect(
      page.getByRole("button", { name: "매일", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
}

test("templates are keyboard accessible in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/");
  // The mode stored on the device is restored asynchronously. Do not click
  // before hydration finishes, or a late restore can revert the dark toggle.
  await expect(page.locator("html")).toHaveAttribute("data-byeolharu-theme", /^(light|dark)$/);
  const dark = page.getByRole("button", { name: "다크 모드로 전환" });
  await expect(dark).toBeEnabled();
  await dark.click();
  await expect(page.locator(".byeolharu")).toHaveClass(/\bdark\b/);
  await expect(page.locator("html")).toHaveAttribute("data-byeolharu-theme", "dark");
  await page.getByRole("button", { name: "새 습관 추가" }).click();
  const template = page.getByRole("button", { name: "독서 20분 템플릿" });
  await template.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(template).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Space");
  await expect(template).toHaveAttribute("aria-pressed", "true");
  await expect(template).toHaveCSS("background-color", "rgb(105, 90, 133)");
  await expect(page.getByRole("switch", { name: "루틴 알림" })).toHaveCount(0);
});

test("settings and reflection preserve each other's fields offline", async ({
  page,
  context,
}) => {
  // The edited habit becomes weekdays-only; keep this test independent
  // of weekends, holidays, and the machine's wall-clock date.
  await page.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "새 습관 추가", exact: true }),
  ).toBeEnabled();
  await context.setOffline(true);
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const create = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await create.getByPlaceholder("예: 하루 10분 책 읽기").fill("분리 기록");
  await create.getByLabel("예정 시간").fill("08:00");
  await create.getByRole("button", { name: "새 습관 추가하기" }).click();
  const card = page
    .locator(".habit-card")
    .filter({ has: page.getByRole("heading", { name: "분리 기록" }) });
  await card.getByRole("button", { name: "분리 기록 2점" }).click();
  await expect(
    card.getByRole("button", { name: "분리 기록 2점" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.locator(".normal-done-toggle").click();
  await card.getByRole("heading", { name: "분리 기록" }).click();
  let detail = page.getByRole("dialog", { name: "오늘의 실천 기록" });
  await expect(detail.getByLabel("예정 시간")).toHaveCount(0);
  await expect(detail.getByRole("switch", { name: "루틴 알림" })).toHaveCount(
    0,
  );
  for (const rating of [1, 2, 3, 4, 5, 4]) {
    await detail.getByRole("button", { name: `상세 ${rating}점` }).click();
    await expect(
      detail.getByRole("button", { name: `상세 ${rating}점` }),
    ).toHaveAttribute("aria-pressed", "true");
  }
  await detail
    .getByRole("textbox", { name: "나에게 남기는 한 줄" })
    .fill("오늘의 뿌듯함");
  await detail.getByRole("button", { name: "+ 뿌듯함" }).click();
  await expect(
    detail.getByRole("textbox", { name: "나에게 남기는 한 줄" }),
  ).toHaveValue("오늘의 뿌듯함 · 뿌듯함");
  await detail.getByRole("button", { name: "별점 저장" }).click();
  await expect(
    card.getByRole("button", { name: "분리 기록 4점" }),
  ).toHaveAttribute("aria-pressed", "true");
  await card.getByRole("button", { name: "분리 기록 수정" }).click();
  let edit = page.getByRole("dialog", { name: "습관 수정하기" });
  await expect(edit.getByText("오늘의 별점")).toHaveCount(0);
  await expect(edit.getByText("짧은 기록")).toHaveCount(0);
  await edit.getByPlaceholder("예: 하루 10분 책 읽기").fill("분리 기록 수정");
  await edit.getByRole("button", { name: "🌱 아이콘" }).click();
  await edit.getByRole("button", { name: "낮", exact: true }).click();
  await edit.getByRole("button", { name: "평일", exact: true }).click();
  await edit.getByLabel("예정 시간").fill("13:30");
  await expect(edit.getByRole("switch", { name: "루틴 알림" })).toHaveCount(0);
  await edit.getByRole("button", { name: "수정 완료" }).click();
  const updated = page
    .locator(".habit-card")
    .filter({ has: page.getByRole("heading", { name: "분리 기록 수정" }) });
  await expect(
    updated.getByRole("button", { name: "분리 기록 수정 4점" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(updated).toContainText("오늘의 뿌듯함");
  await updated.getByRole("heading", { name: "분리 기록 수정" }).click();
  detail = page.getByRole("dialog", { name: "오늘의 실천 기록" });
  await expect(
    detail.getByRole("textbox", { name: "나에게 남기는 한 줄" }),
  ).toHaveValue("오늘의 뿌듯함 · 뿌듯함");
  await detail
    .getByRole("textbox", { name: "나에게 남기는 한 줄" })
    .fill("오늘의 뿌듯함 수정");
  await detail.getByRole("button", { name: "상세 4점" }).click();
  await expect(
    detail.getByRole("button", { name: "상세 4점" }),
  ).toHaveAttribute("aria-pressed", "false");
  await detail.getByRole("button", { name: "단순 체크만 하기" }).click();
  await expect(updated).toContainText("실천 완료");
  await expect(
    updated.getByRole("button", { name: "분리 기록 수정 4점" }),
  ).toHaveAttribute("aria-pressed", "false");
  await context.setOffline(false);
  await page.reload();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  const persisted = page
    .locator(".habit-card")
    .filter({ has: page.getByRole("heading", { name: "분리 기록 수정" }) });
  await expect(persisted).toContainText("오늘의 뿌듯함 수정");
  await expect(persisted).toContainText("13:30");
  await expect(persisted).toContainText("실천 완료");
  await persisted.getByRole("button", { name: "분리 기록 수정 수정" }).click();
  edit = page.getByRole("dialog", { name: "습관 수정하기" });
  await expect(edit.getByRole("switch", { name: "루틴 알림" })).toHaveCount(0);
  await expect(
    edit.getByRole("button", { name: "평일", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(edit.getByRole("button", { name: "🌱 아이콘" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    edit.getByRole("button", { name: "낮", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(edit.getByLabel("예정 시간")).toHaveValue("13:30");
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
  const completion = page.locator(".completion-metric .metric-value");
  const initialCompletion = await completion.innerText();
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
  expect(await completion.innerText()).not.toBe(initialCompletion);
  await card.getByRole("button", { name: `${title} 5점` }).click();
  await expect(card).toContainText("미기록");
  await expect(card.locator(".status-pill")).toHaveCount(0);
  // Cancelling via the same star must clear *visible* gold fill too, even
  // while the clicked button retains keyboard focus on mobile browsers.
  await expect(card.locator(".star.filled")).toHaveCount(0);
  await card.getByRole("button", { name: `${title} 5점` }).focus();
  await expect(card.locator(".star.filled")).toHaveCount(0);
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
  // Completed cards now leave the pending grid and move into a collapsed group.
  await expect(page.locator(".normal-done-toggle")).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect(page.getByText(/기록 완료!|별점 기록을 취소했어요/)).toHaveCount(
    0,
  );
  await context.setOffline(false);
  await page.reload();
  await page.locator(".normal-done-toggle").click();
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

test.describe("mobile touch stars", () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test("touching an already rated star clears its fill and completion state", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    await page.locator(".normal-done-toggle").click();
    const card = page.locator(".habit-card").filter({
      has: page.getByRole("heading", { name: "미온수 한 잔 & 영양제" }),
    });
    const star = card.getByRole("button", { name: "미온수 한 잔 & 영양제 3점" });
    await star.tap();
    await expect(card.locator(".star.filled")).toHaveCount(3);
    await expect(star).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await star.tap();
    await expect(card.locator(".status-pill")).toHaveCount(0);
    await expect(card.locator(".star.filled")).toHaveCount(0);
    await expect(star).toHaveAttribute("aria-pressed", "false");
    // Samsung Internet can keep :hover after a tap. The CSS background
    // must stay transparent regardless of selected/focused/hovered state.
    await expect(star).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(card.locator(".status-pill")).toHaveCount(0);
  });
});

test("keyboard star focus stays accessible without a filled background tile", async ({ page }) => {
  await page.goto("/");
  // Wait for the hydrated guest snapshot and initial time-based tab selection.
  // Otherwise startup effects can move the completed card out of the active tab
  // after focus, making subsequent accessibility assertions lose their target.
  // An entirely completed time-period hides cards behind the completed-group toggle.
  // Either an unfinished card or the collapsed toggle proves the guest habits are hydrated.
  await expect(page.locator(".habit-card:visible, .normal-done-toggle:visible").first()).toBeVisible();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  const completedToggle = page.locator(".normal-done-toggle");
  await expect(completedToggle).toBeVisible();
  await completedToggle.click();
  await expect(completedToggle).toHaveAttribute("aria-expanded", "true");
  const star = page.getByRole("button", { name: "미온수 한 잔 & 영양제 3점" });
  await expect(star).toBeVisible();
  await star.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(star).toBeFocused();
  await expect(star).toHaveCSS("outline-style", "solid");
  await expect(star).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});


test("guest storage failure clears after a successful retry without losing the record", async ({ page }) => {
  await page.goto("/");
  // Resolve the initial guest snapshot and time-based tab before manual navigation.
  // Otherwise an async startup tab selection can hide the target card mid-test.
  // An entirely completed time-period hides cards behind the completed-group toggle.
  // Either an unfinished card or the collapsed toggle proves the guest habits are hydrated.
  await expect(page.locator(".habit-card:visible, .normal-done-toggle:visible").first()).toBeVisible();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  const readyCard = page.locator(".habit-card").filter({
    has: page.getByRole("heading", { name: "미온수 한 잔 & 영양제" }),
  });
  await expect(readyCard.getByRole("button", { name: "미온수 한 잔 & 영양제 2점" })).toBeVisible();

  // Fail exactly one IndexedDB scopes write; leave existing data intact.
  await page.evaluate(() => {
    const originalPut = IDBObjectStore.prototype.put;
    let failed = false;
    Object.defineProperty(IDBObjectStore.prototype, "put", {
      configurable: true,
      value: function (...args: Parameters<IDBObjectStore["put"]>) {
        // Only fail the intended 2-star record write. Failing an unrelated
        // ensureDay/initialization write would hide the entire guest habit list.
        const state = args[0] as {
          entities?: Record<string, {
            kind?: string;
            data?: { title?: string; rating?: number };
          }>;
        } | undefined;
        const isTargetWrite = Object.values(state?.entities ?? {}).some(
          (entry) =>
            entry.kind === "habit_entries" &&
            entry.data?.title === "미온수 한 잔 & 영양제" &&
            entry.data.rating === 2,
        );
        if (!failed && this.name === "scopes" && isTargetWrite) {
          failed = true;
          throw new DOMException("Simulated quota failure", "QuotaExceededError");
        }
        return Reflect.apply(originalPut, this, args);
      },
    });
  });

  const card = page.locator(".habit-card").filter({
    has: page.getByRole("heading", { name: "미온수 한 잔 & 영양제" }),
  });
  const star = card.getByRole("button", { name: "미온수 한 잔 & 영양제 2점" });
  await star.click();
  await expect(page.locator(".sync-notice[role=\"alert\"]")).toContainText("기록 저장을 확인해 주세요");
  await expect(star).toHaveAttribute("aria-pressed", "false");

  // The retry commits successfully; a stale error must not remain visible.
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".sync-notice")).toHaveCount(0);

  // Confirm persistence, not only the optimistic star fill.
  await expect.poll(async () => {
    return page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("byeolharu-v2");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      try {
        const request = db.transaction("scopes", "readonly").objectStore("scopes").get("guest");
        const state = await new Promise<{ entities: Record<string, { kind: string; data: { title?: string; rating?: number } }> }>((resolve, reject) => {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        return Object.values(state.entities)
          .filter((entry) => entry.kind === "habit_entries")
          .find((entry) => entry.data.title === "미온수 한 잔 & 영양제")?.data.rating;
      } finally {
        db.close();
      }
    });
  }).toBe(2);
  await page.reload();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.locator(".normal-done-toggle").click();
  await expect(page.getByRole("button", { name: "미온수 한 잔 & 영양제 2점" }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".sync-notice")).toHaveCount(0);
});


test("the scheduled time stays aligned with the selected routine period", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const editor=page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  const time=editor.getByLabel("예정 시간");
  // Optional time is not silently enabled by changing routine group.
  await expect(time).toHaveValue("");
  await editor.getByRole("button", { name: "밤", exact: true }).click();
  await expect(time).toHaveValue("");

  // Choosing a clock time switches to its true period, including the night wrap.
  await time.fill("16:48");
  await expect(editor.getByRole("button", { name: "낮", exact: true })).toHaveAttribute("aria-pressed","true");
  await editor.getByRole("button", { name: "밤", exact: true }).click();
  await expect(time).toHaveValue("21:00");
  await time.fill("02:30");
  await expect(editor.getByRole("button", { name: "밤", exact: true })).toHaveAttribute("aria-pressed","true");

  // Focus remains visible but contained inside the picker border.
  await time.focus();
  await expect(time).toHaveCSS("outline-offset","-2px");
  await expect(time).toHaveCSS("min-height","48px");
});


test("habit deletion uses a separate confirmation that preserves the editor on cancel", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-19T12:00:00Z") });
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await editor.getByPlaceholder("예: 하루 10분 책 읽기").fill("삭제 테스트 습관");
  await editor.getByRole("button", { name: "새 습관 추가하기" }).click();
  await page.getByRole("button", { name: "삭제 테스트 습관 수정" }).click();

  const edit = page.getByRole("dialog", { name: "습관 수정하기" });
  const originalName = edit.getByPlaceholder("예: 하루 10분 책 읽기");
  await expect(originalName).toHaveValue("삭제 테스트 습관");
  await edit.getByRole("button", { name: "이 습관 삭제하기" }).click();

  const confirmation = page.getByRole("dialog", { name: "이 습관을 삭제할까요?" });
  await expect(confirmation).toBeVisible();
  await expect(edit).toBeVisible();
  const before = await edit.evaluate(element => {
    const field = element.querySelector<HTMLInputElement>('input[placeholder="예: 하루 10분 책 읽기"]');
    return { top: element.getBoundingClientRect().top, name: field?.value };
  });
  await confirmation.getByRole("button", { name: "유지하기" }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(originalName).toHaveValue(before.name ?? "");
  await edit.getByRole("button", { name: "이 습관 삭제하기" }).click();
  await page.keyboard.press("Escape");
  await expect(confirmation).not.toBeVisible();
  await expect(edit).toBeVisible();
  await edit.getByRole("button", { name: "이 습관 삭제하기" }).click();
  await confirmation.getByRole("button", { name: "삭제하기" }).click();
  await expect(edit).not.toBeVisible();
  await expect(page.getByRole("button", { name: "삭제 테스트 습관 수정" })).toHaveCount(0);
});
