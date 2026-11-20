import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

for (const theme of ["light", "dark"] as const) {
  test(`habits keep chronological order in ${theme} even after scheduled time passes`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime(new Date("2026-11-20T22:00:00+09:00"));
    await page.addInitScript(() => {
      const routine = (
        id: string,
        title: string,
        timeGroup: "morning" | "day" | "night",
        scheduledTime?: string,
        completed = false,
        rating = 0,
      ) => ({
        id, title, icon: "⭐", timeGroup, scheduledTime,
        completed, rating, alarmEnabled: false, memo: "",
      });
      const habits = [
        routine("late", "밤 23시 30분", "night", "23:30"),
        routine("free", "밤 자유롭게", "night"),
        routine("early", "밤 21시", "night", "21:00"),
        routine("same", "밤 같은 21시", "night", "21:00"),
        routine("completed-late", "완료 밤 22시 30분", "night", "22:30", true, 4),
        routine("completed-free", "완료 밤 자유", "night", undefined, true, 0),
        routine("completed-early", "완료 밤 20시", "night", "20:00", true, 5),
        routine("day-late", "낮 16시", "day", "16:00"),
        routine("day-free", "낮 자유", "day"),
        routine("day-early", "낮 12시", "day", "12:00"),
      ];
      localStorage.setItem("byeolharu_v1_day", "2026-11-20");
      localStorage.setItem("byeolharu_v1_habits", JSON.stringify(habits));
    });
    await page.goto("/");
    await expect(page.getByRole("tab", { name: "전체", exact: true })).toBeVisible();
    if (theme === "dark") {
      const toggle = page.getByRole("button", { name: "다크 모드로 전환" });
      if (await toggle.isVisible()) await toggle.click();
    }
    await page.getByRole("tab", { name: "밤", exact: true }).click();
    const pending = page.locator(".normal-pending-list .habit-card h3");
    await expect(pending).toHaveText([
      "밤 21시", "밤 같은 21시", "밤 23시 30분", "밤 자유롭게",
    ]);
    const completedToggle = page.locator(".normal-done-toggle");
    await expect(completedToggle).toContainText("3개");
    await completedToggle.click();
    const completed = page.locator(".normal-completed-list .habit-card h3");
    await expect(completed).toHaveText([
      "완료 밤 20시", "완료 밤 22시 30분", "완료 밤 자유",
    ]);

    // The first two 21:00 habits retain registration order, and the 21:00
    // passed time is never demoted behind the future 23:30 habit.
    await page.getByRole("tab", { name: "전체", exact: true }).click();
    await expect(page.locator(".normal-pending-list .habit-card h3")).toHaveText([
      "낮 12시", "낮 16시",
      "밤 21시", "밤 같은 21시", "밤 23시 30분",
      "밤 자유롭게", "낮 자유",
    ]);

    // Next-period preview also honors configured times and places "자유롭게" last.
    await page.getByRole("tab", { name: "아침", exact: true }).click();
    await expect(page.locator(".upcoming-heading + .habit-grid .habit-card h3")).toHaveText([
      "낮 12시", "낮 16시", "낮 자유",
    ]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
