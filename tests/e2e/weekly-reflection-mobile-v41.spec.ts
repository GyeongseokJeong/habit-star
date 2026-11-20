import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

async function seedMissedHabit(page: import("@playwright/test").Page) {
  // A visible React button is not proof the asynchronous guest repository
  // initialized. Never open an absent IDB here: opening it first would create
  // an empty v1 database and prevent the app's schema upgrade from running.
  await expect.poll(async () => page.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (!databases.some((entry) => entry.name === "byeolharu-v2")) return false;
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("byeolharu-v2");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      if (!db.objectStoreNames.contains("scopes")) return false;
      const request = db.transaction("scopes", "readonly").objectStore("scopes").get("guest");
      const guest = await new Promise<unknown>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      return Boolean(guest);
    } finally {
      db.close();
    }
  }), { message: "wait for the app to initialize the guest IndexedDB store" }).toBe(true);

  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("byeolharu-v2");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      const tx = db.transaction("scopes", "readwrite");
      const store = tx.objectStore("scopes");
      const state = await new Promise<{ entities: Record<string, unknown> }>((resolve, reject) => {
        const request = store.get("guest");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const id = "v41-fixture-missed-habit";
      const data = {
        title: "V4.1 물 마시기", icon: "💧", timeGroup: "morning",
        repeatDays: [0, 1, 2, 3, 4, 5, 6], alarmEnabled: false,
        position: 999, scheduledTime: null,
      };
      state.entities[`habits::${id}`] = {
        key: `habits::${id}`, kind: "habits", id, day: "", data,
        version: 1, deleted: false,
      };
      for (let dayNumber = 14; dayNumber <= 20; dayNumber++) {
        const day = `2026-11-${dayNumber}`;
        const dayKey = `days:${day}:${day}`;
        state.entities[dayKey] = {
          key: dayKey, kind: "days", id: day, day,
          data: { timezone: "Asia/Seoul" }, version: 1, deleted: false,
        };
        const key = `habit_entries:${day}:${id}`;
        state.entities[key] = {
          key, kind: "habit_entries", id, day,
          data: { ...data, completed: false, rating: 0, memo: "" },
          version: 1, deleted: false,
        };
      }
      store.put(state, "guest");
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  });
  await page.reload();
}

for (const width of [320, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`V4.1 reflection has compact readable cards and reachable 44px CTA at ${width}px in ${theme}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-11-20T12:00:00+09:00"));
      await page.setViewportSize({ width, height: 844 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
      await seedMissedHabit(page);
      if (theme === "dark") {
        const toggle = page.getByRole("button", { name: "다크 모드로 전환" });
        if (await toggle.isVisible()) await toggle.click();
      }
      await page.getByRole("tab", { name: "달력", exact: true }).click();
      await page.getByRole("button", { name: "최근 7일 돌아보기" }).click();

      const main = page.locator(".main-container.reflection-main");
      await expect(main).toBeVisible();
      const topPadding = await main.evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
      expect(topPadding).toBeLessThanOrEqual(12);

      const card = page.locator(".weekly-reflection-card").filter({ hasText: "V4.1 물 마시기" });
      await expect(card).toBeVisible();
      await expect(card).toContainText("확인된 예정일 6일 · 완료 기록 0일");
      await expect(card).toContainText("오늘 예정");
      await expect(card).not.toContainText("오늘 예정된 습관");

      const cta = card.getByRole("button", { name: "오늘 기록하기" });
      await expect(cta).toBeVisible();
      const sizes = await Promise.all([
        cta.evaluate(el => el.getBoundingClientRect().height),
        card.evaluate(el => el.getBoundingClientRect().height),
      ]);
      expect(sizes[0]).toBeGreaterThanOrEqual(44);
      expect(sizes[1]).toBeLessThan(180);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

      await expect(page.locator("footer.closing-footer--reflection .closing-sky-sparks")).toHaveCount(1);
      await cta.click();
      const modal = page.getByRole("dialog", { name: "오늘의 실천 기록" });
      await expect(modal).toBeVisible();
      await expect(modal).toContainText("V4.1 물 마시기");
      await modal.getByRole("button", { name: "닫기" }).click();
      await expect(modal).toHaveCount(0);
    });
  }
}

/* V4.2: The closing message belongs at the screen bottom on short pages.
   On short viewports the footer must instead follow content, without overlay. */
for (const width of [320, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`V4.2 reflection footer reaches viewport bottom at ${width}px in ${theme}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-11-20T12:00:00+09:00"));
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
      if (theme === "dark") await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      await page.getByRole("tab", { name: "달력", exact: true }).click();
      await page.getByRole("button", { name: "최근 7일 돌아보기" }).click();
      const footer = page.locator("footer.closing-footer--reflection");
      await expect(footer).toBeVisible();
      const placement = await page.evaluate(() => ({
        bottom: document.querySelector("footer.closing-footer--reflection")!.getBoundingClientRect().bottom,
        viewport: window.innerHeight,
        document: document.documentElement.scrollHeight,
        container: document.querySelector(".byeolharu")!.classList.contains("reflection-layout"),
      }));
      expect(placement.container).toBe(true);
      // Section includes 16px of intrinsic bottom breathing room, not a large void.
      expect(placement.bottom).toBeGreaterThanOrEqual(placement.viewport - 45);
      expect(placement.bottom).toBeLessThanOrEqual(placement.viewport + 2);
      expect(placement.document).toBeLessThanOrEqual(placement.viewport + 2);

      await page.getByRole("button", { name: "달력으로 돌아가기" }).click();
      await expect(page.locator(".byeolharu")).not.toHaveClass(/reflection-layout/);
      await expect(page.getByRole("tab", { name: "달력", exact: true })).toBeVisible();
    });
  }
}

test("V4.2 small viewport scrolls to footer after the habit card without overlap", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T12:00:00+09:00"));
  await page.setViewportSize({ width: 320, height: 420 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await seedMissedHabit(page);
  await page.getByRole("tab", { name: "달력", exact: true }).click();
  await page.getByRole("button", { name: "최근 7일 돌아보기" }).click();
  await expect(page.locator(".weekly-reflection-card")).toHaveCount(1);
  const bounds = await page.evaluate(() => ({
    cardBottom: document.querySelector(".weekly-reflection-card")!.getBoundingClientRect().bottom,
    footerTop: document.querySelector("footer.closing-footer--reflection")!.getBoundingClientRect().top,
    viewport: window.innerHeight,
    document: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  // Adjacent blocks may share an exact pixel boundary without overlapping.
  expect(bounds.footerTop).toBeGreaterThanOrEqual(bounds.cardBottom);
  expect(bounds.document).toBeGreaterThan(bounds.viewport);
  expect(bounds.overflowX).toBe(false);

  await page.locator("footer.closing-footer--reflection").scrollIntoViewIfNeeded();
  await expect(page.locator("footer.closing-footer--reflection")).toBeVisible();
  await page.locator(".weekly-reflection-card").getByRole("button", { name: "오늘 기록하기" }).click();
  await expect(page.getByRole("dialog", { name: "오늘의 실천 기록" })).toBeVisible();
});

/* V4.4: the same SVG, dusk palette, and responsive silhouette as home. */
for (const width of [320, 390, 430]) {
  for (const theme of ["light", "dark"] as const) {
    test(`V4.4 reflection shares home sunset and stays 122px at ${width}px in ${theme}`, async ({ page }) => {
      await page.clock.setFixedTime(new Date("2026-11-20T12:00:00+09:00"));
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
      if (theme === "dark") await page.getByRole("button", { name: "다크 모드로 전환" }).click();
      await page.getByRole("tab", { name: "전체", exact: true }).click();
      const home = page.locator("footer.closing-footer:not(.closing-footer--reflection)");
      await expect(home).toBeVisible();
      await expect(home.getByRole("heading", { name: "꾸준함은 완벽함보다 빛나요." })).toBeVisible();
      const homeScene = await home.evaluate(el => ({
        far: el.querySelector(".closing-wave-far")!.getAttribute("d"),
        near: el.querySelector(".closing-wave-near")!.getAttribute("d"),
        farColor: getComputedStyle(el.querySelector(".closing-wave-far-left")!).stopColor,
        glow: !!el.querySelector(".closing-horizon-light"),
      }));
      await page.getByRole("tab", { name: "달력", exact: true }).click();
      await page.getByRole("button", { name: "최근 7일 돌아보기" }).click();
      const closing = page.locator("footer.closing-footer--reflection[aria-label='돌아보기 마무리']");
      await expect(closing).toHaveCount(1);
      await expect(closing).toContainText("다시 시작하는 하루도 충분히 빛나요.");
      await expect(closing.locator(".closing-brand, .closing-copy h2")).toHaveCount(0);
      const scene = await closing.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const landscape = el.querySelector(".closing-landscape")!.getBoundingClientRect();
        return {
          far: el.querySelector(".closing-wave-far")!.getAttribute("d"),
          near: el.querySelector(".closing-wave-near")!.getAttribute("d"),
          farColor: getComputedStyle(el.querySelector(".closing-wave-far-left")!).stopColor,
          glow: !!el.querySelector(".closing-horizon-light"),
          sceneHeight: landscape.height, bottom: rect.bottom,
          viewport: innerHeight,
          overflows: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(scene.far).toBe(homeScene.far);
      expect(scene.near).toBe(homeScene.near);
      expect(scene.farColor).toBe(homeScene.farColor);
      expect(scene.glow).toBe(homeScene.glow);
      expect(scene.sceneHeight).toBeGreaterThanOrEqual(120);
      expect(scene.sceneHeight).toBeLessThanOrEqual(125);
      expect(scene.bottom).toBeGreaterThanOrEqual(scene.viewport - 2);
      expect(scene.bottom).toBeLessThanOrEqual(scene.viewport + 2);
      expect(scene.overflows).toBe(false);
    });
  }
}
