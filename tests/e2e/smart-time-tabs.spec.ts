import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

for (const [localTime, tab] of [
  ["08:30", "아침"],
  // No seeded daytime routine in V5.3; start on All instead.
  ["13:30", "전체"],
  ["20:30", "밤"],
] as const) {
  test(`startup at ${localTime} selects existing ${tab} tab without adding controls`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(`2026-11-19T${localTime}:00+09:00`));
    await page.goto("/");
    await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab")).toHaveCount(5);
    await expect(page.getByRole("region", { name: "나의 별자리 미리보기" })).toBeVisible();
  });
}

test("explicit selection is respected through clock boundary and account panel navigation", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-19T10:59:00+09:00"));
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "아침", exact: true })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "달력" }).click();
  await expect(page.getByRole("tab", { name: "달력" })).toHaveAttribute("aria-selected", "true");

  await page.clock.setFixedTime(new Date("2026-11-19T18:15:00+09:00"));
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("tab", { name: "달력" })).toHaveAttribute("aria-selected", "true");

  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.clock.setFixedTime(new Date("2026-11-20T07:00:00+09:00"));
  await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
});

test("launch falls back to all when there are no habits in the current period", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-19T08:30:00+09:00"));
  await page.addInitScript(() => {
    localStorage.setItem("byeolharu_v1_day", "2026-01-01");
    localStorage.setItem("byeolharu_v1_habits", JSON.stringify([
      {
        id: "night-only", title: "밤에만 기록", icon: "📚", timeGroup: "night",
        alarmEnabled: false, completed: false, rating: 0, memo: "",
      },
    ]));
  });
  await page.goto("/");
  await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "밤에만 기록", exact: true })).toBeVisible();
});
