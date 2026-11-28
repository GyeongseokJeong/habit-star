import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

test("calendar intensity reflects scheduled habits, not only recorded ratings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.setFixedTime(new Date("2026-11-28T09:00:00+09:00"));
  await page.addInitScript(() => {
    const records = (count: number, done: number, repeatDays?: number[]) =>
      Array.from({ length: count }, (_, i) => ({
        id: `habit-${i}`, title: `습관 ${i + 1}`, icon: "⭐", timeGroup: "morning",
        alarmEnabled: false, completed: i < done, rating: i < done ? 5 : 0, memo: "", repeatDays,
      }));
    localStorage.setItem("byeolharu_v1_day", "2026-11-28");
    localStorage.setItem("byeolharu_v1_habits", JSON.stringify(records(8, 1)));
    localStorage.setItem("byeolharu_v1_history", JSON.stringify({
      "2026-11-24": records(8, 8),
      "2026-11-25": records(8, 4),
      "2026-11-26": records(8, 0, [6]),
    }));
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "달력", exact: true }).click();
  const today = page.getByRole("button", { name: /11월 28일 오늘, 1\/8 실천, 평균 5\.0점, 하루 별빛 12\.5%/ });
  await expect(today).toHaveClass(/tier-1/);
  await expect(page.getByRole("button", { name: /11월 25일, 4\/8 실천.*하루 별빛 50%/ })).toHaveClass(/tier-3/);
  await expect(page.getByRole("button", { name: /11월 24일, 8\/8 실천.*하루 별빛 100%/ })).toHaveClass(/tier-5/);
  await expect(page.getByRole("button", { name: /11월 26일, 예정된 습관 없음/ })).toHaveClass(/tier-0/);
  await expect(page.getByRole("button", { name: /11월 27일, 기록 없음/ })).toHaveClass(/tier-0/);
  await expect(page.getByRole("button", { name: /11월 29일, 미래 날짜/ })).toBeDisabled();
  await today.click();
  await expect(page.getByRole("heading", { name: "1/8 실천 · 하루 별빛 12.5%" })).toBeVisible();
  await expect(page.getByText("기록한 별점 평균 5.0★")).toBeVisible();
});
