import { expect, test, type Locator } from "@playwright/test";
import { ACCOUNT_DELETION_MAILTO, SUPPORT_EMAIL } from "../../lib/privacy-contact";

const preparationCopy = /검토용|초안|정식\s*시행\s*전|출시\s*전|정책\s*확정|추후\s*고지/;

async function expectAccountDesign(scope: Locator, theme: "light" | "dark") {
  const heading = scope.locator(".account-ui-section-title").first();
  await expect(heading).toHaveCSS("font-size", "14px");
  await expect(heading).toHaveCSS("margin-top", "24px");
  await expect(heading).toHaveCSS("margin-bottom", "10px");
  const action = scope.locator(".account-primary-action").first();
  await expect(action).toHaveCSS("border-radius", "10px");
  await expect(action).toHaveCSS("background-color", theme === "dark" ? "rgb(105, 90, 133)" : "rgb(98, 84, 126)");
  expect(await action.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
  const card = scope.locator(".legal-contact");
  if (await card.count()) {
    await expect(card).toHaveClass(/account-ui-card/);
    await expect(card).toHaveCSS("border-radius", "14px");
    await expect(card).toHaveCSS("background-color", theme === "dark" ? "rgb(23, 29, 41)" : "rgb(255, 255, 255)");
    const secondary = card.locator(".account-secondary-action");
    await expect(secondary).toHaveCSS("border-radius", "10px");
    expect(await secondary.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(48);
  }
  expect(await scope.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
}


test("public policy and deletion request are discoverable without sign-in", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  expect((await page.goto("/privacy"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "개인정보처리방침", exact: true })).toBeVisible();
  await expect(page.locator(".legal-copy")).not.toContainText(preparationCopy);
  await expect(page.getByRole("heading", { name: "2. 개인정보의 보유 및 파기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "3. 개인정보의 제공 및 처리 위탁" })).toBeVisible();
  await expect(page.locator(".legal-copy")).toContainText("본 방침은 게시일부터 적용됩니다.");
  await expect(page.getByRole("link", { name: SUPPORT_EMAIL })).toHaveAttribute("href", `mailto:${SUPPORT_EMAIL}`);
  await page.getByRole("link", { name: "계정 삭제 요청 안내", exact: true }).click();
  await expect(page).toHaveURL(/\/account-deletion$/);
  await expect(page.getByRole("heading", { name: "계정 삭제 요청", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "삭제 요청 메일 작성" })).toHaveAttribute("href", ACCOUNT_DELETION_MAILTO);
  await expect(page.getByText(SUPPORT_EMAIL, { exact: true })).toBeVisible();
  await expect(page.locator(".legal-copy")).not.toContainText(preparationCopy);
  await expect(page.getByText("본인 확인 후 계정과 관련 기록을 삭제하고 결과를 이메일로 안내합니다.")).toBeVisible();
  await expect(page.getByText("삭제한 기록은 복구할 수 없습니다.", { exact: false })).toBeVisible();
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
  await expect(policy.getByRole("heading", { name: "1. 개인정보의 처리 항목 및 목적", level: 3 })).toBeVisible();
  await expectAccountDesign(policy.locator(".legal-copy"), "dark");
  await expect(policy.locator(".legal-copy")).not.toContainText(preparationCopy);
  await expect(page.locator(".byeolharu")).toHaveClass(/dark/);
  await policy.getByRole("button", { name: "계정 삭제 요청 안내" }).click();
  const request = page.getByRole("dialog", { name: "계정 삭제 요청" });
  await expect(request).toBeVisible();
  await expect(request.getByRole("heading", { name: "삭제 요청 방법", level: 3 })).toBeVisible();
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    await expectAccountDesign(request.locator(".legal-copy"), "dark");
  }
  await expect(request.locator(".legal-copy")).not.toContainText(preparationCopy);
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


test("public policy surfaces share account typography, action styles and theme tokens", async ({ page }) => {
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    for (const path of ["/privacy", "/account-deletion"]) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-byeolharu-theme", theme);
      await expect(page.locator(".legal-copy").getByRole("heading", { level: 2 }).first()).toBeVisible();
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        await expectAccountDesign(page.locator(".legal-copy"), theme);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
    }
  }
});
