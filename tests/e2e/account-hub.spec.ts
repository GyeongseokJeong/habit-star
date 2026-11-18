import { expect, test } from "@playwright/test";

test("guest account hub keeps the primary actions compact and separates settings", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await expect(page.getByText("비회원으로 사용 중")).toBeVisible();
  await expect(page.getByRole("button", { name: "데이터 관리", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "앱 설정", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "계정 관리", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  const themeGroup = page.getByRole("group", { name: "화면 테마" });
  await themeGroup.getByRole("button", { name: "다크" }).click();
  await expect(themeGroup.getByRole("button", { name: "다크" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
  await expect(page.getByText("기기의 시간대를 사용해요")).toBeVisible();
  await page.getByRole("button", { name: "내 계정으로" }).click();
  await expect(page.getByRole("button", { name: "데이터 관리", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("guest record backup and restore remain nested under a compact records page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  await expect(page.getByRole("button", { name: "기록 백업 내려받기" })).toBeVisible();
  await expect(page.getByLabel("백업 복원 (기록이 없는 같은 계정·브라우저)")).toBeHidden();
  await page.getByText("백업 파일 복원", { exact: true }).click();
  await expect(page.getByLabel("백업 복원 (기록이 없는 같은 계정·브라우저)")).toBeEnabled();
  await expect(page.locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);
});

test("Escape from account details returns to hub before closing the sheet", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "앱 설정", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
