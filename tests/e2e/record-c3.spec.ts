import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

async function createHabit(page: import("@playwright/test").Page, title: string) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await modal.getByPlaceholder("예: 하루 10분 책 읽기").fill(title);
  await modal.getByRole("button", { name: "새 습관 추가하기" }).click();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
}

test("C3 detail keeps its original layout and avoids duplicate memo keywords", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createHabit(page, "C3 메모 확인");
  await page.locator(".habit-card").filter({ hasText: "C3 메모 확인" }).locator(".card-content").click();
  const dialog = page.getByRole("dialog", { name: "오늘의 실천 기록" });
  const save = dialog.getByRole("button", { name: "별점 저장" });
  await expect(save).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "오늘 실천 기록 취소" })).toHaveCount(0);
  const memo = dialog.getByPlaceholder("오늘의 느낌을 가볍게 남겨보세요.");
  await memo.fill("내가 쓴 뿌듯함의 기록");
  const keyword = dialog.getByRole("button", { name: /뿌듯함/ });
  await keyword.click();
  await expect(keyword).toHaveAttribute("aria-pressed", "true");
  await expect(memo).toHaveValue("내가 쓴 뿌듯함의 기록 · 뿌듯함");
  await keyword.click();
  await expect(keyword).toHaveAttribute("aria-pressed", "false");
  await expect(memo).toHaveValue("내가 쓴 뿌듯함의 기록");
  await dialog.getByRole("button", { name: "상세 4점" }).click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog).toHaveCount(0);
  await page.locator(".normal-done-toggle").click();
  await page.locator(".normal-completed-list .habit-card").filter({ hasText: "C3 메모 확인" }).locator(".card-content").click();
  const reopened = page.getByRole("dialog", { name: "오늘의 실천 기록" });
  await expect(reopened.getByRole("button", { name: "오늘 실천 기록 취소" })).toBeVisible();
  await expect(reopened.getByPlaceholder("오늘의 느낌을 가볍게 남겨보세요.")).toHaveValue("내가 쓴 뿌듯함의 기록");
  await reopened.getByRole("button", { name: "오늘 실천 기록 취소" }).click();
  await expect(reopened).toHaveCount(0);
  await expect(page.locator(".normal-pending-list .habit-card").filter({ hasText: "C3 메모 확인" })).toBeVisible();
});

test("C3 reflection entry for insufficient history returns directly to today's all tab", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "달력", exact: true }).click();
  await page.getByRole("button", { name: "최근 7일 돌아보기" }).click();
  await expect(page.getByText("조금 더 기록이 쌓이면 알려드릴게요.")).toBeVisible();
  await page.getByRole("button", { name: "오늘의 습관 보기" }).click();
  await expect(page.getByRole("heading", { name: "최근 7일 돌아보기" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "전체", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".metrics")).toBeVisible();
});
