import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

async function seedMissedHabit(page: import("@playwright/test").Page) {
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

      await expect(page.locator(".weekly-reflection-glint")).toHaveCount(2);
      await cta.click();
      const modal = page.getByRole("dialog", { name: "오늘의 실천 기록" });
      await expect(modal).toBeVisible();
      await expect(modal).toContainText("V4.1 물 마시기");
      await modal.getByRole("button", { name: "닫기" }).click();
      await expect(modal).toHaveCount(0);
    });
  }
}
