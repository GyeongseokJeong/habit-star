import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { MemberRepository } from "../../lib/habits/repository";
import { SyncEngine, SupabaseTransport, type CloudTransport } from "../../lib/habits/sync";
import { buildWidgetActionProjection } from "../../lib/habits/widget-summary";
import { newWidgetCommandGeneration, recoverableWidgetProjection } from "../../lib/habits/widget-command-recovery";
import { writeWidgetCommandGeneration } from "../../mobile/packaged-guest/widget-command-generation";
import { runColdWidgetPractice } from "../../mobile/packaged-guest/widget-cold-practice";
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
  const advanced = page.getByText("기록 이전 · 고급 관리", { exact: true });
  const importAction = page.getByRole("button", { name: "이 기기의 비회원 기록 확인" });
  await expect(advanced).toBeVisible();
  if (!(await importAction.isVisible())) await advanced.click();
  await expect(importAction).toBeVisible();
  await importAction.click();
}
// Completed habits remain accessible in normal view, but are collapsed by default.
 // Open the group before asserting or editing an already-completed cloud record.
async function expandNormalCompleted(page: Page) {
  const toggle = page.locator(".normal-done-toggle");
  await expect(toggle).toBeVisible({ timeout: 30000 });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
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
  // Opening the withdrawal page does not submit or delete anything.
  await page.getByRole("button", { name: "계정 관리", exact: true }).click();
  await page.getByRole("button", { name: "회원 탈퇴", exact: true }).click();
  const withdrawal = page.getByRole("dialog", { name: "회원 탈퇴" });
  await expect(withdrawal.getByRole("button", { name: "회원 탈퇴하기" })).toBeDisabled();
  await page.getByRole("button", { name: "계정 관리로" }).click();
  await page.getByRole("button", { name: "내 계정으로" }).click();
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
    await expandNormalCompleted(page);
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
    await expandNormalCompleted(second);
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
    await expandNormalCompleted(second);
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
    await expandNormalCompleted(page);
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
    await expandNormalCompleted(second);
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
  browser,
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
  await logout(page);
  await expect(page.getByText("비회원으로 사용 중")).toBeVisible();
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page
    .getByRole("button", { name: "비밀번호 찾기", exact: true })
    .click();
  await page.getByLabel("이메일", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "재설정 메일 보내기", exact: true })
    .click();
  await expect(
    page.getByText("요청을 처리했습니다. 가입한 이메일의 메일함을 확인해주세요."),
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
  // The recovery callback signs this browser in asynchronously.
  // Wait for the verified member identity before signing out: an immediate
  // isVisible() can observe the initial guest render and skip logout.
  await expect(page.getByText(email, { exact: true })).toBeVisible({ timeout: 15000 });
  await logout(page);
  await expect(
    page.getByText("비회원으로 사용 중"),
  ).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).click();
  // Verify changed credentials in a fresh session. The recovery link can
  // maintain its own browser auth state after navigating back to the app.
  const freshContext = await browser.newContext();
  try {
    const freshPage = await freshContext.newPage();
    await login(freshPage, email, nextPassword);
  } finally {
    await freshContext.close();
  }
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
  await expandNormalCompleted(page);
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
  await expandNormalCompleted(page);
  await expect(
    page.getByRole("heading", { name: "비회원에서 바꾼 같은 ID", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expandNormalCompleted(page);
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


// STEP 4C: actual local Supabase/Auth/RLS and the production repository/sync
// code, with a fake IndexedDB device and request-bound native guard stub.
// Browser observer has independent storage/session. This is NOT an Android
// WebView, process-death, OS network or physical-device test.
const coldOrigin = "https://localhost";
const androidAuth = "byeolharu_android_auth_v1";
const verifiedUser = "byeolharu_verified_user";

function localWidgetClient() {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!["localhost", "127.0.0.1"].includes(url.hostname) ||
      url.protocol !== "http:" || url.port !== "54321")
    throw Error("widget cloud tests require CLI-managed local Supabase");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw Error("local publishable key required");
  return createClient(url.origin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function memberSession(client: SupabaseClient, credentials: { email: string; password: string }) {
  const { data, error } = await client.auth.signInWithPassword(credentials);
  if (error || !data.session) throw Error("test member login failed");
  const verified = await client.auth.getUser(data.session.access_token);
  if (verified.error || verified.data.user?.id !== data.session.user.id ||
      !verified.data.user.email_confirmed_at) throw Error("test member not verified");
  return data.session;
}

function memberStorage(session: Session) {
  const values: Record<string, string> = {
    [androidAuth]: JSON.stringify(session),
    [verifiedUser]: session.user.id,
  };
  return { values, getItem: (key: string) => values[key] ?? null };
}

async function setupWidgetMember(client: SupabaseClient, session: Session) {
  // idb needs the IndexedDB class globals as well as a per-test factory.
  globalThis.indexedDB = new IDBFactory();
  const repo = new MemberRepository(session.user.id);
  const cloud = new SupabaseTransport(client, session.user.id);
  const habit = { id: crypto.randomUUID(), title: "위젯 클라우드 독서", icon: "📚",
    timeGroup: "night" as const, alarmEnabled: false, completed: false, rating: 0, memo: "" };
  try {
    await repo.initialize();
    await new SyncEngine(repo, cloud).run();
    await repo.ensureDay();
    await repo.create(habit);
    await repo.update(habit.id, { memo: "기존 메모 보존" });
    await new SyncEngine(repo, cloud).run();
    const snapshot = await repo.load();
    expect(snapshot.state.hydrated).toBe(true);
    expect(snapshot.state.outbox).toEqual([]);
    expect(snapshot.habits.find(h => h.id === habit.id)).toMatchObject({
      completed: false, rating: 0, memo: "기존 메모 보존",
    });
    return { repo, cloud, habit, day: snapshot.day };
  } catch (error) {
    repo.close();
    throw error;
  }
}

async function publishWidgetHandle(repo: MemberRepository, id: string, title: string) {
  const projected = buildWidgetActionProjection(await repo.load(), id);
  if (!projected.summary) throw Error("widget source not hydrated");
  const generation = newWidgetCommandGeneration(projected.summary);
  const recovered = await recoverableWidgetProjection(projected, generation);
  const handle = recovered.summary?.rows.find(row => row.title === title)?.actionKey;
  if (!handle) throw Error("widget action unavailable");
  await writeWidgetCommandGeneration(coldOrigin, generation);
  return handle;
}

async function offlineWidget(handle: string, storage: ReturnType<typeof memberStorage>) {
  // Fail any attempt to use fetch in the cold command. Native network blocking
  // itself is independently tested/verified on Android, not in this harness.
  const fetchBefore = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async () => { attempts++; throw Error("offline"); };
  try {
    const result = await runColdWidgetPractice({
      origin: coldOrigin, actionKey: handle, deadline: Date.now() + 7500,
      storage, nativeAllowed: () => true,
    });
    expect(attempts).toBe(0);
    return result;
  } finally { globalThis.fetch = fetchBefore; }
}

async function serverEntry(client: SupabaseClient, id: string, day: string) {
  const { data, error } = await client.from("habit_entries")
    .select("habit_id,local_date,data,version,deleted").eq("habit_id", id).eq("local_date", day);
  expect(error).toBeNull();
  if (data?.length !== 1) throw Error("expected exactly one owned daily entry");
  return data[0];
}

async function serverRevision(client: SupabaseClient) {
  const { data, error } = await client.from("sync_state").select("revision").single();
  expect(error).toBeNull();
  if (!data) throw Error("owner revision unavailable");
  return data.revision;
}

async function operationReceipt(client: SupabaseClient, id: string) {
  const { data, error } = await client.from("sync_operations")
    .select("operation_id,request,result").eq("operation_id", id);
  expect(error).toBeNull();
  return data ?? [];
}

async function browserWidgetState(page: Page, title: string, completed: boolean) {
  await page.reload();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(page.locator(".saved-label")).toContainText("동기화 완료", { timeout: 30000 });
  if (completed) await expandNormalCompleted(page);
  await expect(page.getByRole("button", { name: title + " 5점", exact: true }))
    .toHaveAttribute("aria-pressed", String(completed), { timeout: 30000 });
  await expect(page.locator(".habit-card").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  })).toContainText("기존 메모 보존");
}

test("member cold widget completion and undo reach actual cloud and independent browser after durable retry", async ({ page, request }) => {
  test.setTimeout(150000);
  const credentials = await register(page, request);
  const client = localWidgetClient();
  const session = await memberSession(client, credentials);
  const storage = memberStorage(session);
  const { repo, cloud, habit, day } = await setupWidgetMember(client, session);
  let resumed: MemberRepository | undefined;
  let repoOpen = true;
  try {
    const baseline = await serverEntry(client, habit.id, day);
    const handle = await publishWidgetHandle(repo, session.user.id, habit.title);
    repo.close();
    repoOpen = false;
    const saved = await offlineWidget(handle, storage);
    expect(saved.status).toBe("saved");
    expect(saved.summary?.rows.find(r => r.title === habit.title)?.completed).toBe(true);
    resumed = new MemberRepository(session.user.id);
    await resumed.initialize();
    const pending = await resumed.load();
    expect(pending.habits.find(h => h.id === habit.id)).toMatchObject({
      completed: true, rating: 5, memo: "기존 메모 보존",
    });
    expect(pending.state.outbox).toHaveLength(1);
    const op = pending.state.outbox[0];
    expect(op.changes).toHaveLength(1);
    expect(op.changes[0]).toMatchObject({
      kind: "habit_entries", id: habit.id, day, base: { version: baseline.version },
    });
    expect((await offlineWidget(handle, storage)).status).not.toBe("saved");
    expect(await resumed.state()).toEqual(pending.state);
    expect(await serverEntry(client, habit.id, day)).toEqual(baseline);
    expect(await operationReceipt(client, op.id)).toEqual([]);
    await browserWidgetState(page, habit.title, false);

    // Lose only the acknowledgement AFTER the actual SQL operation commits.
    const attempted: string[] = [];
    const lostAck: CloudTransport = {
      prepare: () => cloud.prepare(), pull: cursor => cloud.pull(cursor),
      apply: async operation => {
        attempted.push(operation.id);
        await cloud.apply(operation);
        throw Error("network_unavailable");
      },
    };
    await expect(new SyncEngine(resumed, lostAck).run()).rejects.toThrow("network_unavailable");
    expect(attempted).toEqual([op.id]);
    expect((await resumed.state()).outbox).toEqual([op]);
    const committed = await serverEntry(client, habit.id, day);
    const receipts = await operationReceipt(client, op.id);
    const committedRevision = await serverRevision(client);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].result).toMatchObject({ status: "applied", revision: committedRevision });
    expect(receipts[0].request).toEqual(JSON.parse(JSON.stringify(op)));
    expect(committed.version).toBe(committedRevision);
    expect(committed.version).toBeGreaterThan(baseline.version);
    expect(committed.data).toMatchObject({ completed: true, rating: 5, memo: "기존 메모 보존" });
    const retry: CloudTransport = {
      prepare: () => cloud.prepare(), pull: cursor => cloud.pull(cursor),
      apply: async operation => {
        attempted.push(operation.id);
        expect(operation).toEqual(op);
        return cloud.apply(operation);
      },
    };
    await new SyncEngine(resumed, retry).run();
    expect(attempted).toEqual([op.id, op.id]);
    expect((await resumed.state()).outbox).toEqual([]);
    expect((await resumed.state()).sync?.phase).toBe("succeeded");
    expect(await serverEntry(client, habit.id, day)).toEqual(committed);
    expect(await operationReceipt(client, op.id)).toEqual(receipts);
    expect(await serverRevision(client)).toBe(committedRevision);
    await browserWidgetState(page, habit.title, true);

    const undoHandle = await publishWidgetHandle(resumed, session.user.id, habit.title);
    resumed.close();
    resumed = undefined;
    expect((await offlineWidget(undoHandle, storage)).status).toBe("saved");
    resumed = new MemberRepository(session.user.id);
    await resumed.initialize();
    const undone = await resumed.load();
    expect(undone.habits.find(h => h.id === habit.id)).toMatchObject({
      completed: false, rating: 0, memo: "기존 메모 보존",
    });
    expect(undone.state.outbox).toHaveLength(1);
    const undo = undone.state.outbox[0];
    expect(undo.id).not.toBe(op.id);
    expect(await serverEntry(client, habit.id, day)).toEqual(committed);
    await browserWidgetState(page, habit.title, true);
    await new SyncEngine(resumed, cloud).run();
    expect((await resumed.state()).outbox).toEqual([]);
    expect((await resumed.state()).sync?.phase).toBe("succeeded");
    const remote = await serverEntry(client, habit.id, day);
    expect(remote.version).toBe(await serverRevision(client));
    expect(remote.version).toBeGreaterThan(committed.version);
    expect(remote.data).toMatchObject({ completed: false, rating: 0, memo: "기존 메모 보존" });
    expect(await operationReceipt(client, undo.id)).toHaveLength(1);
    await browserWidgetState(page, habit.title, false);
  } finally {
    if (repoOpen) repo.close();
    resumed?.close();
    await writeWidgetCommandGeneration(coldOrigin, null);
  }
});

test("member cold widget rejects expired cache and account changes; real auth protects queued operation", async ({ page, browser, request }) => {
  test.setTimeout(150000);
  const a = await register(page, request);
  const bContext = await browser.newContext();
  let b: Awaited<ReturnType<typeof register>>;
  try { b = await register(await bContext.newPage(), request); }
  finally { await bContext.close(); }
  const client = localWidgetClient();
  const session = await memberSession(client, a);
  const storage = memberStorage(session);
  const { repo, cloud, habit, day } = await setupWidgetMember(client, session);
  try {
    const handle = await publishWidgetHandle(repo, session.user.id, habit.title);
    const before = await repo.state();
    // Real session with simulated expired local metadata: NOT a server JWT expiry.
    storage.values[androidAuth] = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) - 1 });
    expect((await offlineWidget(handle, storage)).status).toBe("not-ready");
    expect(await repo.state()).toEqual(before);
    storage.values[androidAuth] = JSON.stringify({ ...session, expires_at: Math.floor(Date.now() / 1000) + 5 });
    expect((await offlineWidget(handle, storage)).status).toBe("not-ready");
    expect(await repo.state()).toEqual(before);
    storage.values[androidAuth] = JSON.stringify(session);
    delete storage.values[verifiedUser];
    expect((await offlineWidget(handle, storage)).status).toBe("not-ready");
    expect(await repo.state()).toEqual(before);
    storage.values[verifiedUser] = session.user.id;
    expect((await offlineWidget(handle, storage)).status).toBe("saved");
    const pending = await repo.state();
    expect(pending.outbox).toHaveLength(1);
    const op = pending.outbox[0];
    const freshAHandle = await publishWidgetHandle(repo, session.user.id, habit.title);
    const baseline = await serverEntry(client, habit.id, day);
    // Real SDK session absence, then an independently confirmed account.
    const signedOut = await client.auth.signOut({ scope: "local" });
    expect(signedOut.error).toBeNull();
    await expect(new SyncEngine(repo, cloud).run()).rejects.toThrow("auth_required");
    expect((await repo.state()).outbox).toEqual([op]);
    expect((await repo.state()).sync?.phase).toBe("auth_required");
    const sessionB = await memberSession(client, b);
    const bStorage = memberStorage(sessionB);
    const bRepo = new MemberRepository(sessionB.user.id);
    try {
      await bRepo.initialize();
      const cloudB = new SupabaseTransport(client, sessionB.user.id);
      await new SyncEngine(bRepo, cloudB).run();
      await bRepo.ensureDay();
      await bRepo.create({ ...habit, id: crypto.randomUUID(), title: "B 계정의 별도 습관" });
      await new SyncEngine(bRepo, cloudB).run();
      const beforeB = await bRepo.state();
      const revisionB = await serverRevision(client);
      const beforeA = await repo.state();
      const changingStorage = memberStorage(session);
      let guards = 0;
      const switched = await runColdWidgetPractice({
        origin: coldOrigin, actionKey: freshAHandle, deadline: Date.now() + 7500,
        storage: changingStorage,
        nativeAllowed: () => {
          if (++guards === 2) Object.assign(changingStorage.values, bStorage.values);
          return true;
        },
      });
      expect(guards).toBeGreaterThanOrEqual(2);
      expect(switched.status).not.toBe("saved");
      expect(switched.summary).toBeUndefined();
      expect(await repo.state()).toEqual(beforeA);
      expect(await bRepo.state()).toEqual(beforeB);
      const rejected = await offlineWidget(freshAHandle, bStorage);
      expect(rejected.status).not.toBe("saved");
      expect(rejected.summary).toBeUndefined();
      expect(await repo.state()).toEqual(beforeA);
      expect(await bRepo.state()).toEqual(beforeB);
      await expect(new SyncEngine(repo, cloud).run()).rejects.toThrow("auth_required");
      const protectedA = await repo.state();
      expect(protectedA.outbox).toEqual([op]);
      expect(protectedA.entities).toEqual(pending.entities);
      expect(protectedA.cursor).toBe(pending.cursor);
      expect(await bRepo.state()).toEqual(beforeB);
      expect(await serverRevision(client)).toBe(revisionB);
      const denied = await client.from("habit_entries").select("habit_id").eq("habit_id", habit.id);
      expect(denied.error).toBeNull();
      expect(denied.data).toEqual([]);
      expect(await operationReceipt(client, op.id)).toEqual([]);
      // Direct client writes stay forbidden even for a confirmed member.
      const direct = await client.from("habit_entries").update({ deleted: true }).eq("habit_id", habit.id);
      expect(direct.error !== null).toBe(true);
      const anonymous = await localWidgetClient().rpc("apply_operation", { p_operation: op });
      expect(anonymous.error !== null).toBe(true);
    } finally { bRepo.close(); }
    await memberSession(client, a);
    expect(await serverEntry(client, habit.id, day)).toEqual(baseline);
    await new SyncEngine(repo, cloud).run();
    expect((await repo.state()).outbox).toEqual([]);
    expect((await repo.state()).sync?.phase).toBe("succeeded");
    expect((await serverEntry(client, habit.id, day)).data).toMatchObject({
      completed: true, rating: 5, memo: "기존 메모 보존",
    });
    expect(await operationReceipt(client, op.id)).toHaveLength(1);
  } finally {
    repo.close();
    await writeWidgetCommandGeneration(coldOrigin, null);
  }
});

// Verify the supported Auth admin hard-delete path on the CLI-managed LOCAL
// Supabase instance, using two disposable identities and a pinned old token.
test("self-service withdrawal removes only the confirmed account and rejects stale sessions", async ({ page }) => {
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.port !== "54321")
    throw Error("account deletion integration is local-only");
  const settings = JSON.parse(execFileSync("pnpm", ["exec", "supabase", "status", "--output", "json"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  }));
  if (new URL(settings.API_URL).origin !== url.origin)
    throw Error("CLI-managed test instance must match the configured API URL");
  const adminKey = settings.SECRET_KEY || settings.SERVICE_ROLE_KEY;
  if (!adminKey) throw Error("local administrator key unavailable");
  const admin = createClient(url.origin, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const created = new Set<string>();
  const createMember = async () => {
    const email = `account-deletion-${crypto.randomUUID()}@example.test`;
    const password = `Test-${crypto.randomUUID()}`;
    const result = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (result.error || !result.data.user) throw Error("synthetic account creation failed");
    created.add(result.data.user.id);
    const client = localWidgetClient();
    const session = await memberSession(client, { email, password });
    expect(session.user.id).toBe(result.data.user.id);
    return { client, session, email, password };
  };
  const habitId = crypto.randomUUID();
  const day = "2026-11-28";
  const operation = () => {
    const data = { title: "synthetic", icon: "x", timeGroup: "day", scheduledTime: null, alarmEnabled: false, position: 0 };
    return { id: crypto.randomUUID(), changes: [
      { key: "habits::" + habitId, kind: "habits", id: habitId, day: "", base: null, data, deleted: false },
      { key: `days:${day}:${day}`, kind: "days", id: day, day, base: null, data: {}, deleted: false },
      { key: `habit_entries:${day}:${habitId}`, kind: "habit_entries", id: habitId, day, base: null,
        data: { ...data, completed: true, rating: 5, memo: "synthetic memo" }, deleted: false },
    ] };
  };
  const seed = async (client: SupabaseClient) => {
    expect((await client.rpc("initialize_profile", { p_timezone: "UTC" })).error).toBeNull();
    const op = operation();
    const applied = await client.rpc("apply_operation", { p_operation: op });
    expect(applied.error).toBeNull();
    expect(applied.data.status).toBe("applied");
    const stage = await client.rpc("begin_import", { p_source: "synthetic", p_hash: "synthetic", p_total: 1 });
    expect(stage.error).toBeNull();
    expect((await client.rpc("stage_import", { p_batch: stage.data, p_chunk: 0, p_items: [op.changes[0]] })).error).toBeNull();
    return op;
  };
  try {
    const a = await createMember();
    const b = await createMember();
    const replay = await seed(a.client);
    const before = await seed(b.client);
    // Both independently own the same application entity ID.
    const bBefore = await b.client.rpc("pull_changes", { p_cursor: -1 });
    expect(bBefore.error).toBeNull();
    expect(bBefore.data.entities).toHaveLength(3);
    const stale = localWidgetClient();
    const token = "Bearer " + a.session.access_token;
    const beforeDelete = await stale.rpc("pull_changes", { p_cursor: -1 }).setHeader("Authorization", token);
    expect(beforeDelete.error).toBeNull();
    expect(beforeDelete.data.entities).toHaveLength(3);
    // A separate browser obtains a real verified session and local member scope.
    await login(page, a.email, a.password);
    await expect(page.getByText(a.email, { exact: true })).toBeVisible();

    // The account page shares the account design system, without making
    // ordinary sign-out look as destructive as permanent deletion.
    for (const [theme, className] of [["라이트", "light"], ["다크", "dark"]] as const) {
      await page.getByRole("button", { name: "앱 설정", exact: true }).click();
      await page.getByRole("group", { name: "화면 테마" }).getByRole("button", { name: theme }).click();
      await expect(page.locator(".byeolharu")).toHaveClass(new RegExp(className));
      await page.getByRole("button", { name: "내 계정으로" }).click();
      await page.getByRole("button", { name: "계정 관리", exact: true }).click();
      const security = page.getByRole("dialog", { name: "계정 관리" });
      const logout = security.getByRole("button", { name: "로그아웃", exact: true });
      const deleteEntry = security.getByRole("button", { name: "회원 탈퇴", exact: true });
      await expect(security.getByRole("heading", { name: "로그인 정보" })).toBeVisible();
      await expect(security.getByRole("heading", { name: "계정 삭제" })).toBeVisible();
      await expect(security.getByText(a.email, { exact: true })).toBeVisible();
      await expect(security.locator(".account-security-identity")).toHaveCSS("border-radius", "14px");
      expect(await logout.evaluate(el => getComputedStyle(el).color)).not.toBe(await deleteEntry.evaluate(el => getComputedStyle(el).color));
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await security.locator(".account-detail").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await security.getByText(a.email, { exact: true }).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await logout.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
        expect(await deleteEntry.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      }
      await deleteEntry.click();
      const screen = page.getByRole("dialog", { name: "회원 탈퇴" });
      await expect(screen.getByText("탈퇴한 계정과 기록은 복구할 수 없어요.")).toBeVisible();
      await expect(screen.getByRole("heading", { name: "본인 확인" })).toBeVisible();
      await expect(screen.getByRole("button", { name: "회원 탈퇴하기" })).toBeDisabled();
      await expect(screen.locator(".account-withdraw-summary")).toHaveCSS("border-radius", "14px");
      for (const width of [320, 390, 430]) {
        await page.setViewportSize({ width, height: 844 });
        expect(await screen.locator(".account-detail").evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        expect(await screen.locator(".account-withdraw-consent").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      }
      await page.getByRole("button", { name: "계정 관리로" }).click();
      await page.getByRole("button", { name: "내 계정으로" }).click();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "계정 관리", exact: true }).click();
    await page.getByRole("button", { name: "회원 탈퇴", exact: true }).click();
    const withdrawal = page.getByRole("dialog", { name: "회원 탈퇴" });
    const submit = withdrawal.getByRole("button", { name: "회원 탈퇴하기" });
    await expect(submit).toBeDisabled();
    await withdrawal.getByLabel("비밀번호", { exact: true }).fill("Incorrect-password");
    await withdrawal.getByRole("checkbox").check();
    await submit.click();
    await expect(withdrawal.getByRole("alert")).toContainText("비밀번호가 일치하지 않아요");
    expect((await admin.auth.admin.getUserById(a.session.user.id)).data.user?.id).toBe(a.session.user.id);
    await withdrawal.getByLabel("비밀번호", { exact: true }).fill(a.password);
    await withdrawal.getByRole("checkbox").check();
    // A concurrent sync may finish before deletion or be rejected after it.
    await Promise.all([
      submit.click(),
      stale.rpc("apply_operation", { p_operation: operation() }).setHeader("Authorization", token),
    ]);
    await expect(page.getByText("회원 탈퇴가 완료되었어요.")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("비회원으로 사용 중")).toBeVisible();
    const memberScope = "member:" + a.session.user.id;
    const cached = await page.evaluate(scope => new Promise<boolean>((resolve, reject) => {
      const request = indexedDB.open("byeolharu-v2", 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const lookup = db.transaction("scopes").objectStore("scopes").get(scope);
        lookup.onsuccess = () => { db.close(); resolve(lookup.result !== undefined); };
        lookup.onerror = () => { db.close(); reject(lookup.error); };
      };
    }), memberScope);
    expect(cached).toBe(false);
    created.delete(a.session.user.id);
    expect((await admin.auth.admin.getUserById(a.session.user.id)).data.user).toBeNull();
    expect((await a.client.auth.getUser(a.session.access_token)).error).toBeTruthy();
    await page.reload();
    await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await expect(page.getByText("비회원으로 사용 중")).toBeVisible();
    await expect(page.getByText(a.email, { exact: true })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => localStorage.getItem("byeolharu_verified_user"))).toBeNull();

    for (const [rpc, args] of [
      ["initialize_profile", { p_timezone: "UTC" }],
      ["pull_changes", { p_cursor: -1 }],
      ["apply_operation", { p_operation: replay }],
      ["apply_operation", { p_operation: operation() }],
      ["begin_import", { p_source: "after", p_hash: "after", p_total: 1 }],
    ] as const) {
      const result = await stale.rpc(rpc, args).setHeader("Authorization", token);
      expect(result.error, "deleted identity cannot use " + rpc).toBeTruthy();
    }
    const bAfter = await b.client.rpc("pull_changes", { p_cursor: -1 });
    expect(bAfter.error).toBeNull();
    expect(bAfter.data).toEqual(bBefore.data);
    const bRetry = await b.client.rpc("apply_operation", { p_operation: before });
    expect(bRetry.error).toBeNull();
    expect(bRetry.data.status).toBe("applied");
  } finally {
    // This only touches identities successfully created by this local test.
    for (const id of created) {
      const result = await admin.auth.admin.deleteUser(id, false);
      if (result.error) throw Error("synthetic account cleanup failed");
    }
  }
});
