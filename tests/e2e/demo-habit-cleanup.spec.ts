import { expect, test } from "@playwright/test";

test.use({ timezoneId: "Asia/Seoul" });

test("new guest begins with only two demos and can clear them without touching the UI data model", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "새 습관 추가", exact: true })).toBeEnabled();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".sample-cleanup-strip")).toContainText("예시 습관 2개");
  // One completed example is inside the existing collapsed completed group.
  await expect(page.locator(".habit-sample-badge")).toHaveCount(1);
  await page.locator(".normal-done-toggle").click();
  await expect(page.locator(".habit-sample-badge")).toHaveCount(2);
  await page.locator(".normal-done-toggle").click();

  await page.getByRole("button", { name: "예시 한 번에 정리" }).click();
  const modal = page.getByRole("dialog", { name: "예시 습관 정리" });
  await expect(modal.getByText("직접 만든 습관은 그대로 남아요.", { exact: false })).toBeVisible();
  await modal.getByRole("button", { name: "취소" }).click();
  await expect(page.locator(".sample-cleanup-strip")).toContainText("예시 습관 2개");
  await page.getByRole("button", { name: "예시 한 번에 정리" }).click();
  await modal.getByRole("button", { name: "예시만 정리하기" }).click();
  await expect(modal).toHaveCount(0);
  await expect(page.locator(".sample-cleanup-strip, .habit-sample-badge")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "아직 등록된 습관이 없어요" })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".habit-sample-badge")).toHaveCount(0);
  await expect(page.locator(".sample-cleanup-strip")).toHaveCount(0);
});

test("one-action cleanup deletes demos only, preserving a user-created routine after reload", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  const create = page.getByRole("dialog", { name: "나를 위한 새로운 습관" });
  await create.getByPlaceholder("예: 하루 10분 책 읽기").fill("내가 만든 습관");
  await create.getByRole("button", { name: "새 습관 추가하기" }).click();
  await expect(page.getByRole("heading", { name: "내가 만든 습관" })).toBeVisible();

  await page.getByRole("button", { name: "예시 한 번에 정리" }).click();
  await page.getByRole("dialog", { name: "예시 습관 정리" }).getByRole("button", { name: "예시만 정리하기" }).click();
  await expect(page.getByRole("heading", { name: "내가 만든 습관" })).toBeVisible();
  await expect(page.locator(".sample-cleanup-strip, .habit-sample-badge")).toHaveCount(0);
  await page.reload();
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.getByRole("heading", { name: "내가 만든 습관" })).toBeVisible();
});

test("compact view can clear demos without leaving a phantom completion group", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-20T09:00:00+09:00"));
  await page.addInitScript(() => localStorage.setItem("byeolharu_compact_view_v1", "1"));
  await page.goto("/");
  await page.getByRole("tab", { name: "전체", exact: true }).click();
  await expect(page.locator(".sample-cleanup-strip")).toContainText("예시 습관 2개");
  await expect(page.locator(".compact-sample-badge")).toHaveCount(1);
  await page.locator(".compact-done-toggle").click();
  await expect(page.locator(".compact-sample-badge")).toHaveCount(2);
  await page.locator(".compact-done-toggle").click();
  await page.getByRole("button", { name: "예시 한 번에 정리" }).click();
  await page.getByRole("dialog", { name: "예시 습관 정리" }).getByRole("button", { name: "예시만 정리하기" }).click();
  await expect(page.locator(".compact-sample-badge, .compact-done-toggle")).toHaveCount(0);
  await expect(page.locator(".compact-all-done")).toContainText("아직 등록된 습관이 없어요");
});
