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

test("data management has one heading and a non-interactive status in the hub", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await expect(page.getByRole("button", { name: "데이터 관리", exact: true })).toHaveCount(1);
  await expect(page.locator(".account-status-line")).toBeVisible();
  await expect(page.locator("button.account-status-card")).toHaveCount(0);
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "데이터 관리", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "내 계정으로" })).toBeVisible();
  await expect(page.locator(".account-sync-overview")).toBeVisible();
  await expect(page.getByText("백업 및 복원", { exact: true })).toBeVisible();
  await expect(page.locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth)).resolves.toBe(true);
});


test("mobile account and every detail use a fixed full-height viewport without a sheet handle", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  const dialog = page.getByRole("dialog", { name: "내 계정" });
  const getGeometry = async () => page.locator("dialog.account-screen").evaluate((element) => {
    const dialogRect = element.getBoundingClientRect();
    const headerRect = element.querySelector(".modal-top")!.getBoundingClientRect();
    const contentRect = element.querySelector(".account-screen-body")!.getBoundingClientRect();
    return {
      top: Math.round(dialogRect.top),
      height: Math.round(dialogRect.height),
      width: Math.round(dialogRect.width),
      headerTop: Math.round(headerRect.top),
      contentTop: Math.round(contentRect.top),
      handle: getComputedStyle(element, "::before").content,
      scrollable: getComputedStyle(element.querySelector(".account-screen-body")!).overflowY,
    };
  });
  await expect(dialog).toBeVisible();
  const original = await getGeometry();
  expect(original).toMatchObject({ top: 0, height: 844, width: 390, scrollable: "auto" });
  expect(original.handle).toBe("none");
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  await expect(page.getByRole("heading", { name: "데이터 관리", exact: true })).toBeFocused();
  const records = await getGeometry();
  expect(records.top).toBe(original.top);
  expect(records.height).toBe(original.height);
  expect(records.headerTop).toBe(original.headerTop);
  expect(records.contentTop).toBe(original.contentTop);
  await page.getByRole("button", { name: "내 계정으로" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  await expect(page.getByRole("heading", { name: "앱 설정", exact: true })).toBeFocused();
  expect((await getGeometry()).headerTop).toBe(original.headerTop);
  await page.getByRole("button", { name: "내 계정으로" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("mobile account header stays visible while only its content scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "데이터 관리", exact: true }).click();
  const scroll = page.locator(".account-screen-body");
  await scroll.evaluate((element) => {
    const spacer = document.createElement("div");
    spacer.style.height = "1100px";
    spacer.setAttribute("data-test-scroll", "true");
    element.appendChild(spacer);
    element.scrollTop = 800;
  });
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "데이터 관리", exact: true })).toBeInViewport();
  await page.getByRole("button", { name: "내 계정으로" }).click();
  await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByRole("heading", { name: "내 계정", exact: true })).toBeInViewport();
});

test("desktop account dialog remains centered rather than taking over the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  const geometry = await page.locator("dialog.account-screen").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { width: rect.width, top: rect.top, height: rect.height };
  });
  expect(geometry.width).toBeLessThan(600);
  expect(geometry.height).toBeLessThan(900);
  expect(geometry.top).toBeGreaterThan(0);
});

test("approved compact usage guide stays within account navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "사용 안내", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "사용 안내" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "작은 실천이 별빛이 되는 곳" })).toBeVisible();
  for (const name of ["오늘의 실천", "별자리 성장", "기록 보관과 동기화"]) {
    await expect(dialog.getByRole("heading", { name, exact: true })).toBeVisible();
  }
  await expect(dialog.locator(".account-help-group")).toHaveCount(3);
  await expect(dialog.getByRole("heading", { name: "습관 만들기" })).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "Android 습관 알림" })).toHaveCount(0);
  await expect(dialog.locator(".account-help-copy p > span")).toHaveCount(7);
  await expect(dialog.getByRole("button", { name: "기록 저장에 문제가 있나요?" })).toBeVisible();
  await dialog.getByRole("button", { name: "기록 저장에 문제가 있나요?" }).click();
  await expect(page.getByRole("dialog", { name: "데이터 관리" })).toBeVisible();
  await page.getByRole("button", { name: "내 계정으로" }).click();
  await expect(page.getByRole("button", { name: "사용 안내", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "사용 안내", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "내 계정" })).toBeVisible();
});
