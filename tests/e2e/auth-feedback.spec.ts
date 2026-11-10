import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("http://127.0.0.1:54321/**", (route) => route.abort());
});

test("resend rate limits are visible and never reported as success", async ({
  page,
}) => {
  await page.route("**/auth/v1/resend**", (route) =>
    route.fulfill({
      status: 429,
      contentType: "application/json",
      headers: {
        "x-supabase-api-version": "2024-01-01",
        "access-control-expose-headers": "x-supabase-api-version",
      },
      body: JSON.stringify({
        code: "over_email_send_rate_limit",
        msg: "Email rate limit exceeded",
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page
    .getByLabel("이메일", { exact: true })
    .fill("release-check@example.test");
  await page
    .getByRole("button", { name: "인증 메일이 오지 않았나요?" })
    .click();
  await expect(page.getByLabel("인증받을 이메일")).toHaveValue(
    "release-check@example.test",
  );
  await page.getByRole("button", { name: "인증 메일 다시 보내기" }).click();
  await expect(page.getByRole("status")).toContainText("잠시 제한되었습니다");
  await expect(
    page.getByText("요청을 처리했습니다. 이메일을 확인해주세요.", {
      exact: true,
    }),
  ).not.toBeVisible();
});

test("an unconfirmed email receives actionable login feedback", async ({
  page,
}) => {
  await page.route("**/auth/v1/token**", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      headers: {
        "x-supabase-api-version": "2024-01-01",
        "access-control-expose-headers": "x-supabase-api-version",
      },
      body: JSON.stringify({
        code: "email_not_confirmed",
        msg: "Email not confirmed",
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page
    .getByLabel("이메일", { exact: true })
    .fill("release-check@example.test");
  await page
    .getByLabel("비밀번호", { exact: true })
    .fill("Regression-Only-123!");
  await page
    .getByRole("button", { name: "로그인", exact: true })
    .last()
    .click();
  await expect(page.getByRole("status")).toContainText(
    "이메일 인증이 필요합니다",
  );
});

test("cloud-enabled callbacks reject external next destinations without valid credentials", async ({
  request,
}) => {
  for (const path of ["/auth/confirm", "/auth/callback"]) {
    const response = await request.get(
      `${path}?next=https://attacker.example`,
      { maxRedirects: 0 },
    );
    expect(response.status()).toBe(307);
    expect(response.headers().location).toBe(
      "http://localhost:3000/?auth=error",
    );
    expect(response.headers()["cache-control"]).toBe("private, no-store");
  }
});
