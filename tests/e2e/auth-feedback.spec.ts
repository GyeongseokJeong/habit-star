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
  await page.getByRole("button", { name: "로그인", exact: true }).click();
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
  await page.getByRole("button", { name: "로그인", exact: true }).click();
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

test("implicit mobile recovery callback redirects to the browser reset page without exposing tokens in query parameters", async ({ request }) => {
  const response = await request.get("/auth/confirm?next=%2Fauth%2Freset", {maxRedirects: 0});
  expect(response.status()).toBe(307);
  expect(response.headers().location).toBe("http://localhost:3000/auth/reset");
  expect(response.headers()["cache-control"]).toBe("private, no-store");
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

test("Android callback redirects to trusted local return pages", async ({request}) => {
  const signup=await request.get("/auth/confirm?from=android",{maxRedirects:0});
  expect(signup.status()).toBe(307);
  expect(signup.headers().location).toBe("http://localhost:3000/auth/android-return");
  const reset=await request.get("/auth/confirm?from=android&next=%2Fauth%2Freset",{maxRedirects:0});
  expect(reset.headers().location).toBe("http://localhost:3000/auth/reset?from=android");
  const malicious=await request.get("/auth/confirm?from=android&next=https%3A%2F%2Fevil.example",{maxRedirects:0});
  expect(malicious.headers().location).toBe("http://localhost:3000/auth/android-return");
});
const androidReturnIntent =
  "intent://auth/return#Intent;scheme=byeolharu-return;package=io.github.gyeongseokjeong.byeolharu.packagedgueststep9;end";

test("Android return strips credentials and opens only the trusted app intent", async ({ page }) => {
  await page.goto("/auth/android-return#access_token=fake&refresh_token=fake&type=signup");
  const link = page.getByRole("link", { name: "별하루 앱으로 돌아가기" });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", androidReturnIntent);
  await expect(page).toHaveURL("http://localhost:3000/auth/android-return");
  await expect(page.getByRole("heading", { name: "나의 별하루로 돌아가기" })).toBeVisible();
});

test("Android return shows expired-link error and removes its fragment", async ({ page }) => {
  await page.goto("/auth/android-return#error=access_denied&error_code=otp_expired");
  await expect(page.getByRole("heading", { name: "인증 링크를 다시 확인해주세요" })).toBeVisible();
  await expect(page).toHaveURL("http://localhost:3000/auth/android-return?error=1");
  await expect(page.getByRole("link", { name: "별하루 앱으로 돌아가기" }))
    .toHaveAttribute("href", androidReturnIntent);
});

test("Android return handles another email opened in the same page", async ({ page }) => {
  await page.goto("/auth/android-return");
  await expect(page.getByRole("heading", { name: "나의 별하루로 돌아가기" })).toBeVisible();
  await page.evaluate(() => {
    location.hash = "error=access_denied&error_code=otp_expired";
  });
  await expect(page.getByRole("heading", { name: "인증 링크를 다시 확인해주세요" })).toBeVisible();
  await expect(page).toHaveURL("http://localhost:3000/auth/android-return?error=1");
});
