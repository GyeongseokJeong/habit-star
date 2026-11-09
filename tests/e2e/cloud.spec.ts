import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
async function confirm(page: Page, request: APIRequestContext, email: string) {
  let link = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(
          "http://localhost:54324/api/v1/messages",
        );
        const body = await response.json();
        const message = body.messages?.find(
          (m: { To: { Address: string }[] }) =>
            m.To.some((to) => to.Address === email),
        );
        if (!message) return false;
        const detail = await (
          await request.get(
            `http://localhost:54324/api/v1/message/${message.ID}`,
          )
        ).json();
        link =
          (detail.HTML || detail.Text || "")
            .match(/https?:[^\s"<>]+\/auth\/v1\/verify[^\s"<>]+/)?.[0]
            ?.replaceAll("&amp;", "&") ?? "";
        return !!link;
      },
      { timeout: 30000 },
    )
    .toBe(true);
  await page.goto(link);
  await page.waitForURL("http://localhost:3000/**", { timeout: 10000 });
}
async function login(page: Page, email: string, password: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
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
  await page
    .getByRole("button", { name: "이 기기의 비회원 기록 가져오기" })
    .click();
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
    await second.getByRole("button", { name: "지금 동기화" }).click();
    await second.getByRole("button", { name: "닫기", exact: true }).click();
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await page.getByRole("button", { name: "지금 동기화" }).click();
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "이전할 로컬 기록 5점", exact: true }),
    ).toHaveAttribute("aria-pressed", "true", { timeout: 30000 });
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
    await page.getByRole("button", { name: "지금 동기화" }).click();
    await expect(page.locator(".saved-label")).toContainText("동기화 완료", {
      timeout: 30000,
    });
    await page.getByRole("button", { name: "닫기", exact: true }).click();
    await secondContext.setOffline(false);
    await second.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await second.getByRole("button", { name: "지금 동기화" }).click();
    await expect(
      second.getByRole("heading", { name: "동시에 변경된 기록" }),
    ).toBeVisible({ timeout: 30000 });
    await second.getByRole("button", { name: "이 기기 기록 사용" }).click();
    await expect(
      second.getByRole("heading", { name: "동시에 변경된 기록" }),
    ).not.toBeVisible({ timeout: 30000 });
    await second.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(
      second.getByRole("button", { name: "이전할 로컬 기록 2점", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
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
    await second.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(
      second.getByText("로그인 없이 이 기기에서 사용할 수 있어요."),
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
  await page.getByRole("button", { name: "다시 로그인", exact: true }).click();
  await page
    .getByRole("button", { name: "비밀번호 찾기", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "재설정 메일 보내기", exact: true })
    .click();
  await expect(
    page.getByText("요청을 처리했습니다. 이메일을 확인해주세요."),
  ).toBeVisible();
  await confirm(page, request, email);
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
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(
    page.getByText("로그인 없이 이 기기에서 사용할 수 있어요."),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  await login(page, email, nextPassword);
});
