import type { Page } from "@playwright/test";

/**
 * Preserve the pre-V5.3 five-habit exercise scenario for targeted legacy
 * layout/interaction tests. New users receive just two defaults; these tests
 * deliberately opt into the old five-record fixture to verify compatibility.
 * The in-memory fixture is written only to the isolated test page's v1 input.
 */
export async function seedLegacyFiveHabits(page: Page) {
  const rows = [
    ["11111111-1111-4111-8111-111111111111", "미온수 한 잔 & 영양제", "💧", "morning", "07:00", true, 5],
    ["22222222-2222-4222-8222-222222222222", "아침 가벼운 러닝 20분", "🏃‍♂️", "morning", "07:30", true, 4],
    ["33333333-3333-4333-8333-333333333333", "건강한 점심 & 가벼운 산책", "🥗", "day", "12:30", true, 4],
    ["44444444-4444-4444-8444-444444444444", "독서 30분 & TOP 50 책장", "📚", "night", "21:30", false, 0],
    ["55555555-5555-4555-8555-555555555555", "취침 전 스트레칭 10분", "🧘‍♂️", "night", "22:30", false, 0],
  ] as const;
  await page.addInitScript((oldRows) => {
    const date = new Date();
    const day = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    localStorage.setItem("byeolharu_v1_day", day);
    localStorage.setItem("byeolharu_v1_habits", JSON.stringify(
      oldRows.map(([id, title, icon, timeGroup, scheduledTime, completed, rating]) => ({
        id, title, icon, timeGroup, scheduledTime,
        alarmEnabled: true, completed, rating, memo: "",
      })),
    ));
  }, rows);
}
