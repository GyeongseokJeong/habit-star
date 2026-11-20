import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

async function seedSaturdayHabit(page: import("@playwright/test").Page, compact: boolean) {
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
  await page.addInitScript(({ compact }) => {
    localStorage.setItem("byeolharu_v1_day", "2026-01-01");
    localStorage.setItem("byeolharu_v1_habits", JSON.stringify([{
      id: "saturday-reading", title: "토요일 독서", icon: "📚",
      timeGroup: "night", repeatDays: [6],
      alarmEnabled: false, completed: false, rating: 0, memo: "",
    }]));
    if (compact) localStorage.setItem("byeolharu_compact_view_v1", "1");
  }, { compact });
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
}

test("rest-day normal view preserves saved routine and removes misleading first-habit CTA", async ({ page }) => {
  await seedSaturdayHabit(page, false);
  await expect(page.getByRole("heading", { name: "오늘은 루틴 쉬는 날이에요" })).toBeVisible();
  await expect(page.getByText("등록한 습관은 선택한 반복 요일에 다시 나타나요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "첫 습관 추가하기" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "오늘 쉬는 습관" }).getByRole("button", { name: "토요일 독서 반복 요일 수정" })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.getByRole("heading", { name: "오늘은 루틴 쉬는 날이에요" })).toBeVisible();
});

for (const width of [320, 390, 430]) {
  test(`rest-day compact view shows editable collapsed routines without horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 820 });
    await seedSaturdayHabit(page, true);
    const rest = page.locator(".compact-resting-group");
    await expect(page.locator(".compact-all-done")).toContainText("오늘은 루틴 쉬는 날이에요");
    await expect(rest.locator("summary")).toContainText("오늘 쉬는 습관 1개");
    await expect(rest.locator(".compact-resting-list")).toBeHidden();
    await rest.locator("summary").click();
    await expect(rest.getByRole("button", { name: "토요일 독서 반복 요일 수정" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await rest.getByRole("button", { name: "토요일 독서 반복 요일 수정" }).click();
    await expect(page.getByRole("dialog", { name: "습관 수정하기" })).toBeVisible();
    await page.getByRole("button", { name: "닫기", exact: true }).click();
  });
}

test("the same habit reappears on its scheduled day without creating a duplicate", async ({ page }) => {
  await seedSaturdayHabit(page, true);
  await expect(page.locator(".compact-resting-group")).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-11-21T20:00:00+09:00"));
  await page.reload();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".compact-habit-row").filter({ hasText: "토요일 독서" })).toBeVisible();
  await expect(page.locator(".compact-resting-group")).toHaveCount(0);
  await expect(page.locator(".compact-habit-row").filter({ hasText: "토요일 독서" })).toHaveCount(1);
});

test("a time-group-only empty state offers the existing All tab, not a first habit", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-21T09:00:00+09:00"));
  await page.addInitScript(() => {
    localStorage.setItem("byeolharu_v1_day", "2026-01-01");
    localStorage.setItem("byeolharu_v1_habits", JSON.stringify([{
      id: "night-reading", title: "밤 독서", icon: "📚", timeGroup: "night",
      repeatDays: [6], alarmEnabled: false, completed: false, rating: 0, memo: "",
    }]));
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "아침", exact: true }).click();
  await expect(page.getByRole("heading", { name: "이 시간대에 예정된 습관이 없어요" })).toBeVisible();
  await expect(page.getByRole("button", { name: "첫 습관 추가하기" })).toHaveCount(0);
  await page.getByRole("button", { name: "전체에서 보기" }).click();
  await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "밤 독서" })).toBeVisible();
});
