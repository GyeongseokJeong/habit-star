import { readFile } from "node:fs/promises";
import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
async function confirm(
  page: Page,
  request: APIRequestContext,
  email: string,
  type?: "recovery",
) {
  let link = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(
          "http://localhost:54324/api/v1/messages",
        );
        const body = await response.json();
        const messages = (body.messages ?? []).filter(
          (m: { To: { Address: string }[] }) =>
            m.To.some((to) => to.Address === email),
        );
        for (const message of messages) {
          const detail = await (
            await request.get(
              `http://localhost:54324/api/v1/message/${message.ID}`,
            )
          ).json();
          const candidate = (detail.HTML || detail.Text || "")
            .match(/https?:[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+/)?.[0]
            ?.replaceAll("&amp;", "&");
          if (
            candidate &&
            (!type || new URL(candidate).searchParams.get("type") === type)
          ) {
            link = candidate;
            return true;
          }
        }
        return false;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  await page.goto(link);
  await expect(page).toHaveURL(/^http:\/\/localhost:3000\//, {
    timeout: 10000,
  });
}

async function openRecords(page: Page) {
  const open = page.getByRole("button", { name: "데이터 관리", exact: true });
  if (await open.isVisible()) await open.click();
}
async function openImport(page: Page) {
  await openRecords(page);
  const advanced = page.getByText("고급 데이터 관리", { exact: true });
  const importAction = page.getByRole("button", { name: "이 기기의 비회원 기록 가져오기" });
  await expect(advanced).toBeVisible();
  if (!(await importAction.isVisible())) await advanced.click();
  await expect(importAction).toBeVisible();
  await importAction.click();
}
async function logout(page: Page) {
  const back = page.getByRole("button", { name: "내 계정으로" });
  if (await back.isVisible()) await back.click();
  await page.getByRole("button", { name: "계정 관리", exact: true }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "로그인", exact: true })
    .last()
    .click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
}
test("email confirmation, two-device offline sync, conflict resolution, import and logout isolation", async ({
  page,
  browser,
  request,
}) => {
  const email = `cloud-${crypto.randomUUID()}@example.test`,
    password = `Test-${crypto.randomUUID()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("이전할 로컬 기록");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "이메일로 회원가입", exact: true })
    .click();
  await expect(page.getByText(/이메일의 인증 링크/)).toBeVisible();
  await confirm(page, request, email);
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await openImport(page);
  await page.getByRole("button", { name: "이 계정으로 병합" }).click();
  await expect(
    page.getByRole("button", { name: "이 계정으로 병합" }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "이전할 로컬 기록", exact: true }),
  ).toBeVisible();
  const secondContext = await browser.newContext();
  try {
    const second = await secondContext.newPage();
    await login(second, email, password);
    await second.getByRole("button", { name: "닫기", exact: true }).click();
    await second.getByRole("tab", { name: /전체/ }).click();
    await expect(
      second.getByRole("heading", { name: "이전할 로컬 기록", exact: true }),
    ).toBeVisible();
    await secondContext.setOffline(true);
    await second
      .getByRole("button", { name: "이전할 로컬 기록 5점", exact: true })
      .click();
    await expect(
      second.getByRole("button", { name: "이전할 로컬 기록 5점", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await secondContext.setOffline(false);
    await second.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(second);
    await second.getByRole("button", { name: "지금 동기화" }).click();
    await second.getByRole("button", { name: "닫기", exact: true }).click();
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(page);
    await page.getByRole("button", { name: "지금 동기화" }).click();
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "이전할 로컬 기록 5점", exact: true }),
    ).toHaveAttribute("aria-pressed", "true", { timeout: 30000 });
    // Acknowledged memo edits must reach an independent browser, too.
    await page
      .getByRole("heading", { name: "이전할 로컬 기록", exact: true })
      .click();
    await page
      .getByPlaceholder("오늘의 느낌을 가볍게 남겨보세요.")
      .fill("기기 A에서 쓴 메모");
    await page
      .getByRole("button", { name: "단순 체크만 하기", exact: true })
      .click();
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(page);
    await page.getByRole("button", { name: "지금 동기화" }).click();
    await expect(page.locator(".saved-label")).toContainText("동기화 완료", {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await second.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(second);
    await second.getByRole("button", { name: "지금 동기화" }).click();
    await expect(second.locator(".saved-label")).toContainText("동기화 완료", {
      timeout: 30000,
    });
    await second.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(
      second.locator(".habit-card").filter({
        has: second.getByRole("heading", {
          name: "이전할 로컬 기록",
          exact: true,
        }),
      }),
    ).toContainText("기기 A에서 쓴 메모");
    // Both devices edit the same base offline: neither candidate may disappear.
    await page.context().setOffline(true);
    await secondContext.setOffline(true);
    await page
      .getByRole("button", { name: "이전할 로컬 기록 3점", exact: true })
      .click();
    await second
      .getByRole("button", { name: "이전할 로컬 기록 2점", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "이전할 로컬 기록 3점", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      second.getByRole("button", { name: "이전할 로컬 기록 2점", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.context().setOffline(false);
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(page);
    await page.getByRole("button", { name: "지금 동기화" }).click();
    await expect(page.locator(".saved-label")).toContainText("동기화 완료", {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await secondContext.setOffline(false);
    await second.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(second);
    await second.getByRole("button", { name: "지금 동기화" }).click();
    await expect(
      second.getByRole("heading", { name: "기록 충돌 해결" }),
    ).toBeVisible({ timeout: 30000 });
    await second.getByRole("button", { name: "이 기기 기록 사용" }).click();
    await expect(
      second.getByRole("heading", { name: "기록 충돌 해결" }),
    ).not.toBeVisible({ timeout: 30000 });
    await expect(second.locator(".saved-label")).toContainText("동기화 완료", {
      timeout: 30000,
    });
    await second.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(
      second.getByRole("button", { name: "이전할 로컬 기록 2점", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // Bring both devices to the resolved baseline before another concurrent edit.
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(page);
    await page.getByRole("button", { name: "지금 동기화" }).click();
    await expect(page.locator(".saved-label")).toContainText("동기화 완료", {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    // Definition + today's snapshot are one command; concurrent title edits must not partially apply.
    await page.context().setOffline(true);
    await secondContext.setOffline(true);
    for (const [device, title] of [
      [page, "A 기기의 습관 수정"],
      [second, "B 기기의 습관 수정"],
    ] as const) {
      await device
        .getByRole("button", { name: "이전할 로컬 기록 수정", exact: true })
        .click();
      await device.getByPlaceholder("예: 하루 10분 책 읽기").fill(title);
      await device
        .getByRole("button", { name: "수정 완료", exact: true })
        .click();
      await expect(
        device.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
    }
    await page.context().setOffline(false);
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(page);
    await page.getByRole("button", { name: "지금 동기화" }).click();
    await expect(page.locator(".saved-label")).toContainText("동기화 완료", {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await secondContext.setOffline(false);
    await second.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await openRecords(second);
    await second.getByRole("button", { name: "지금 동기화" }).click();
    await expect(
      second.getByRole("heading", { name: "기록 충돌 해결" }),
    ).toBeVisible({ timeout: 30000 });
    await second.getByRole("button", { name: "클라우드 기록 사용" }).click();
    await expect(
      second.getByRole("heading", { name: "기록 충돌 해결" }),
    ).not.toBeVisible({ timeout: 30000 });
    await second.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(
      second.getByRole("heading", { name: "A 기기의 습관 수정", exact: true }),
    ).toBeVisible();
    await second
      .getByRole("button", { name: "새 습관 추가", exact: true })
      .click();
    await second
      .getByPlaceholder("예: 하루 10분 책 읽기")
      .fill("회원 전용 기록");
    await second
      .getByRole("button", { name: "새 습관 추가하기", exact: true })
      .click();
    await expect(
      second.getByRole("heading", { name: "회원 전용 기록", exact: true }),
    ).toBeVisible();
    await second.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await logout(second);
    await expect(
      second.getByText("비회원으로 사용 중"),
    ).toBeVisible();
    await second.getByRole("button", { name: "닫기", exact: true }).click();
    await second.getByRole("tab", { name: /전체/ }).click();
    await expect(
      second.getByRole("heading", { name: "회원 전용 기록", exact: true }),
    ).not.toBeVisible();
  } finally {
    await secondContext.close();
  }
});

test("email password recovery issues a usable new password", async ({
  page,
  request,
}) => {
  const email = `reset-${crypto.randomUUID()}@example.test`,
    password = `Test-${crypto.randomUUID()}`,
    nextPassword = `Changed-${crypto.randomUUID()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "이메일로 회원가입" }).click();
  await expect(page.getByText(/이메일의 인증 링크/)).toBeVisible();
  await confirm(page, request, email);
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "계정 관리", exact: true }).click();
  await page.getByRole("button", { name: "다시 로그인", exact: true }).click();
  await page
    .getByRole("button", { name: "비밀번호 찾기", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "재설정 메일 보내기", exact: true })
    .click();
  await expect(
    page.getByText("비밀번호 재설정 링크를 보냈습니다. 메일함을 확인해주세요."),
  ).toBeVisible();
  await confirm(page, request, email, "recovery");
  await expect(
    page.getByRole("heading", { name: "비밀번호 재설정" }),
  ).toBeVisible();
  await page.getByLabel("새 비밀번호", { exact: true }).fill(nextPassword);
  await page
    .getByRole("button", { name: "비밀번호 변경", exact: true })
    .click();
  await expect(page.getByText(/비밀번호를 변경했습니다/)).toBeVisible();
  await page.getByRole("link", { name: "별하루로 돌아가기" }).click();
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await logout(page);
  await expect(
    page.getByText("비회원으로 사용 중"),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await login(page, email, nextPassword);
});

async function register(page: Page, request: APIRequestContext) {
  const email = `review-${crypto.randomUUID()}@example.test`,
    password = `Review-${crypto.randomUUID()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await page.getByRole("button", { name: "회원가입", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(password);
  await page.getByRole("button", { name: "이메일로 회원가입" }).click();
  await expect(page.getByText(/이메일의 인증 링크/)).toBeVisible();
  await confirm(page, request, email);
  await expect(page.locator(".saved-label")).toContainText("동기화 완료", {
    timeout: 30000,
  });
  return { email, password };
}
test("same-ID guest import remains resumable on conflict and completes only after verified resolution", async ({
  page,
  request,
}) => {
  const { email, password } = await register(page, request);
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await openImport(page);
  await page.getByRole("button", { name: "이 계정으로 병합" }).click();
  await expect(
    page.getByText("가져오기 완료 · 서버와 로컬 기록을 확인했습니다."),
  ).toBeVisible();
  await logout(page);
  await expect(
    page.getByText("비회원으로 사용 중"),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("tab", { name: /전체/ }).click();
  await page
    .getByRole("button", { name: "미온수 한 잔 & 영양제 수정", exact: true })
    .click();
  await page
    .getByPlaceholder("예: 하루 10분 책 읽기")
    .fill("비회원에서 바꾼 같은 ID");
  await page.getByRole("button", { name: "수정 완료", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "비회원에서 바꾼 같은 ID", exact: true }),
  ).toBeVisible();
  await login(page, email, password);
  await openImport(page);
  await page.getByRole("button", { name: "이 계정으로 병합" }).click();
  await expect(
    page.getByRole("heading", { name: "가져오기 충돌", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("가져오기 완료 · 서버와 로컬 기록을 확인했습니다."),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "이 기기 기록 사용" }).click();
  await expect(
    page.getByText("가져오기 완료 · 서버와 로컬 기록을 확인했습니다."),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("heading", { name: "가져오기 충돌", exact: true }),
  ).not.toBeVisible();
  // Resolving a conflict resumes the import automatically; do not offer
  // a second merge after the receipt confirms completion.
  await expect(page.getByRole("heading", { name: "기록 이전 확인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "이 계정으로 병합" })).toHaveCount(0);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "비회원에서 바꾼 같은 ID", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "비회원에서 바꾼 같은 ID", exact: true }),
  ).toBeVisible();
});
test("refresh cannot mask a server failure and auth-expired import keeps a resumable journal", async ({
  page,
  request,
}) => {
  await register(page, request);
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/rest/v1/rpc/pull_changes", async (route) => {
    await gate;
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "XX000", message: "test_server_error" }),
    });
  });
  await openRecords(page);
    await page.getByRole("button", { name: "지금 동기화" }).click();
  await expect(page.locator(".saved-label")).toContainText(
    "클라우드 동기화 중",
  );
  release();
  await expect(page.locator(".saved-label")).toContainText("동기화 실패");
  await page.reload();
  await expect(page.locator(".saved-label")).toContainText("동기화 실패", {
    timeout: 30000,
  });
  await page.unroute("**/rest/v1/rpc/pull_changes");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await openRecords(page);
    await page.getByRole("button", { name: "지금 동기화" }).click();
  await expect(page.locator(".saved-label")).toContainText("동기화 완료");
  await page.route("**/rest/v1/rpc/commit_import", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ code: "42501", message: "auth_required" }),
    }),
  );
  await openImport(page);
  await page.getByRole("button", { name: "이 계정으로 병합" }).click();
  await expect(
    page.getByRole("heading", { name: "가져오기 인증 만료", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".saved-label")).toContainText("인증 만료");
  await expect(
    page.getByText("가져오기 완료 · 서버와 로컬 기록을 확인했습니다."),
  ).not.toBeVisible();
  await page.unroute("**/rest/v1/rpc/commit_import");
  await page
    .getByRole("button", { name: "가져오기 재개", exact: true })
    .click();
  await expect(
    page.getByText("가져오기 완료 · 서버와 로컬 기록을 확인했습니다."),
  ).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("heading", { name: "기록 이전 확인" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "이 계정으로 병합" })).toHaveCount(0);
});

test("switching between two authenticated accounts never reuses the prior account cache", async ({
  page,
  request,
}) => {
  const a = await register(page, request);
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page
    .getByPlaceholder("예: 하루 10분 책 읽기")
    .fill("A 계정의 개인 기록");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await expect(page.locator(".saved-label")).toContainText("동기화 완료", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await logout(page);
  await expect(
    page.getByText("비회원으로 사용 중"),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await register(page, request);
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "A 계정의 개인 기록", exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page
    .getByPlaceholder("예: 하루 10분 책 읽기")
    .fill("B 계정의 개인 기록");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await expect(page.locator(".saved-label")).toContainText("동기화 완료", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await logout(page);
  await expect(
    page.getByText("비회원으로 사용 중"),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await login(page, a.email, a.password);
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "A 계정의 개인 기록", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "B 계정의 개인 기록", exact: true }),
  ).not.toBeVisible();
});

test("incorrect password is rejected and a confirmed session survives reload", async ({
  page,
  request,
}) => {
  const { email, password } = await register(page, request);
  await page.reload();
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await logout(page);
  await expect(
    page.getByText("비회원으로 사용 중"),
  ).toBeVisible();
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page.getByLabel("비밀번호", { exact: true }).fill(`${password}-wrong`);
  await page
    .getByRole("button", { name: "로그인", exact: true })
    .last()
    .click();
  await expect(page.getByRole("status")).toContainText(
    "요청을 처리하지 못했습니다.",
  );
  await expect(page.getByText(email, { exact: true })).not.toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await login(page, email, password);
});

test("v1 settings and historical ratings/memos survive consented, repeatable cloud import", async ({
  page,
  request,
}) => {
  const habit = {
    id: "v1-step02",
    title: "v1 보존 검증",
    icon: "📚",
    timeGroup: "night",
    alarmEnabled: true,
    scheduledTime: "21:30",
    completed: true,
    rating: 4,
    memo: "과거의 소중한 메모",
  };
  const raw = {
    habits: JSON.stringify([habit]),
    history: JSON.stringify({ "2026-01-01": [habit] }),
    day: "2026-01-01",
    theme: "dark",
  };
  await page.addInitScript((raw) => {
    if (localStorage.getItem("step02-fixture")) return;
    for (const [key, value] of Object.entries(raw))
      localStorage.setItem(`byeolharu_v1_${key}`, value);
    localStorage.setItem("step02-fixture", "1");
  }, raw);
  await register(page, request);
  await page.getByRole("tab", { name: /전체/ }).click();
  // Signup and confirmation never implicitly copy the guest data.
  await expect(
    page.getByRole("heading", { name: habit.title, exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  for (let attempt = 0; attempt < 2; attempt++) {
    await openImport(page);
    await expect(
      page.getByRole("heading", { name: "기록 이전 확인" }),
    ).toBeVisible();
    await expect(page.getByText(/현재 습관 1개 · 날짜/)).toBeVisible();
    await page.getByRole("button", { name: "이 계정으로 병합" }).click();
    // A prior receipt may remain visible during a retry; wait for this attempt's ACK.
    await expect(
      page.getByRole("button", { name: "이 계정으로 병합" }),
    ).not.toBeVisible();
    await expect(
      page.getByText("가져오기 완료 · 서버와 로컬 기록을 확인했습니다."),
    ).toBeVisible();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "기록 백업 내려받기" }).click();
    const file = await downloaded;
    const backup = JSON.parse(await readFile((await file.path())!, "utf8"));
    const entities = Object.values(backup.state.entities) as {
      kind: string;
      day: string;
      data: unknown;
    }[];
    const past = entities.filter(
      (row) => row.kind === "habit_entries" && row.day === "2026-01-01",
    );
    expect(past).toHaveLength(1);
    expect(past[0].data).toMatchObject({
      title: habit.title,
      rating: 4,
      completed: true,
      memo: habit.memo,
      timeGroup: "night",
      alarmEnabled: true,
      scheduledTime: "21:30",
    });
    expect(entities.filter((row) => row.kind === "habits")).toHaveLength(1);
    expect(
      await page.evaluate(() =>
        Object.fromEntries(
          ["habits", "history", "day", "theme"].map((key) => [
            key,
            localStorage.getItem(`byeolharu_v1_${key}`),
          ]),
        ),
      ),
    ).toEqual(raw);
  }
});

test("fresh member resolves startup tab only after cloud hydration, unless manually navigated", async ({
  browser,
  request,
}) => {
  const now = new Date();
  const localHour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now));
  const currentPeriod = localHour >= 5 && localHour < 11
    ? "아침" : localHour >= 11 && localHour < 17 ? "낮" : "밤";
  const oppositePeriod = currentPeriod === "밤" ? "morning" : "night";
  const title = "회원 첫 동기화 시간대 루틴";
  const owner = await browser.newContext({ timezoneId: "Asia/Seoul" });
  try {
    const first = await owner.newPage();
    await first.clock.setFixedTime(now);
    const { email, password } = await register(first, request);
    await first.getByRole("button", { name: "새 습관 추가", exact: true }).click();
    await first.getByPlaceholder("예: 하루 10분 책 읽기").fill(title);
    await first.getByRole("dialog", { name: "나를 위한 새로운 습관" })
      .getByRole("button", { name: currentPeriod, exact: true }).click();
    await first.getByRole("button", { name: "새 습관 추가하기", exact: true }).click();
    await expect(first.locator(".saved-label")).toContainText("동기화 완료", {
      timeout: 30000,
    });

    // Each device has no member cache. Its guest data only contains an off-period habit,
    // so pre-hydration fallback is visibly different from the server-selected tab.
    for (const manuallyNavigate of [false, true]) {
      const context = await browser.newContext({ timezoneId: "Asia/Seoul" });
      try {
        const second = await context.newPage();
        await second.clock.setFixedTime(now);
        await second.addInitScript((group) => {
          if (localStorage.getItem("first-hydration-fixture")) return;
          localStorage.setItem("first-hydration-fixture", "1");
          localStorage.setItem("byeolharu_v1_habits", JSON.stringify([{
            id: "guest-off-period", title: "다른 시간대 비회원 루틴",
            icon: "📚", timeGroup: group,
            completed: false, rating: 0, memo: "", alarmEnabled: false,
          }]));
          localStorage.setItem("byeolharu_v1_day", "2026-01-01");
        }, oppositePeriod);
        await second.goto("/");
        await expect(second.getByRole("tab", { name: "전체", exact: true }))
          .toHaveAttribute("aria-selected", "true");
        if (manuallyNavigate) {
          await second.getByRole("tab", { name: "달력" }).click();
        }

        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        let intercepted!: () => void;
        const pulling = new Promise<void>((resolve) => { intercepted = resolve; });
        await second.route("**/rest/v1/rpc/pull_changes", async (route) => {
          intercepted();
          await gate;
          await route.continue();
        });
        try {
          await second.getByRole("button", { name: "계정 및 데이터 관리" }).click();
          await second.getByRole("button", { name: "로그인", exact: true }).click();
          await second.getByLabel("이메일", { exact: true }).fill(email);
          await second.getByLabel("비밀번호", { exact: true }).fill(password);
          await second.getByRole("button", { name: "로그인", exact: true }).last().click();
          await expect(second.getByText(email, { exact: true })).toBeVisible();
          await pulling;
          await second.getByRole("button", { name: "닫기", exact: true }).click();
          await expect(second.getByRole("tab", {
            name: manuallyNavigate ? "달력" : "전체", exact: true,
          })).toHaveAttribute("aria-selected", "true");
        } finally {
          release();
        }
        await expect(second.locator(".saved-label")).toContainText("동기화 완료", {
          timeout: 30000,
        });
        await expect(second.getByRole("tab", {
          name: manuallyNavigate ? "달력" : currentPeriod,
          exact: true,
        })).toHaveAttribute("aria-selected", "true");
        if (manuallyNavigate) {
          await second.getByRole("tab", { name: currentPeriod, exact: true }).click();
        }
        await expect(second.getByRole("heading", { name: title, exact: true }))
          .toBeVisible();
      } finally {
        await context.close();
      }
    }
  } finally {
    await owner.close();
  }
});

