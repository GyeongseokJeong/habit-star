import { expect, test } from "@playwright/test";
import { ACCOUNT_DELETION_MAILTO, SUPPORT_EMAIL } from "../../lib/privacy-contact";

test("public policy and deletion request are discoverable without sign-in", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  expect((await page.goto("/privacy"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "개인정보처리방침", exact: true })).toBeVisible();
  await expect(page.getByText("검토용 초안", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "계정 삭제 요청 안내", exact: true }).click();
  await expect(page).toHaveURL(/\/account-deletion$/);
  await expect(page.getByRole("heading", { name: "계정 삭제 요청", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "삭제 요청 메일 작성" })).toHaveAttribute("href", ACCOUNT_DELETION_MAILTO);
  await expect(page.getByText(SUPPORT_EMAIL, { exact: true })).toBeVisible();
  await expect(page.getByText("메일 작성만으로 계정이 즉시 삭제되지는 않습니다.", { exact: false })).toBeVisible();
  expect(await page.locator("body").evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const href = await page.getByRole("link", { name: "삭제 요청 메일 작성" }).getAttribute("href");
  const url = new URL(href!);
  expect(url.pathname).toBe(SUPPORT_EMAIL);
  expect([...url.searchParams.keys()]).toEqual(["subject"]);
  // The CTA must not send an email, add a user identifier, or call a deletion endpoint.
});

test("guest can reach bundled policy and request guidance, copy the address, and return safely", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "앱 설정", exact: true }).click();
  await page.getByRole("group", { name: "화면 테마" }).getByRole("button", { name: "다크" }).click();
  await page.getByRole("button", { name: "내 계정으로" }).click();
  await page.getByRole("button", { name: "개인정보처리방침", exact: true }).click();
  const policy = page.getByRole("dialog", { name: "개인정보처리방침" });
  await expect(policy).toBeVisible();
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
  await policy.getByRole("button", { name: "계정 삭제 요청 안내" }).click();
  const request = page.getByRole("dialog", { name: "계정 삭제 요청" });
  await expect(request).toBeVisible();
  await expect(request.getByRole("link", { name: "삭제 요청 메일 작성" })).toHaveAttribute("href", ACCOUNT_DELETION_MAILTO);
  await request.getByRole("button", { name: "이메일 주소 복사" }).click();
  await expect(request.getByRole("status").filter({ hasText: "문의 이메일을 복사했어요." })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(SUPPORT_EMAIL);
  expect(await request.getByRole("button", { name: "이메일 주소 복사" }).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "내 계정" })).toBeVisible();
  await expect(page.getByText("비회원으로 사용 중")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("request email stays readable when clipboard is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(Error("unavailable")) },
    });
  });
  await page.goto("/account-deletion");
  await page.getByRole("button", { name: "이메일 주소 복사" }).click();
  await expect(page.getByRole("status")).toContainText("이메일 주소를 선택해 복사");
  await expect(page.getByText(SUPPORT_EMAIL, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "삭제 요청 메일 작성" })).toHaveAttribute("href", ACCOUNT_DELETION_MAILTO);
});
