import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
test("legacy data survives migration, edits, reload, midnight snapshot and backup", async ({
  page,
}) => {
  const h = {
    id: "old",
    title: "기존 습관",
    icon: "📚",
    timeGroup: "night",
    alarmEnabled: false,
    completed: true,
    rating: 0,
    memo: "소중한 기록",
  };
  const raw = JSON.stringify([h]);
  await page.addInitScript(
    ({ raw }) => {
      if (!localStorage.getItem("fixture")) {
        localStorage.setItem("fixture", "1");
        localStorage.setItem("byeolharu_v1_habits", raw);
        localStorage.setItem("byeolharu_v1_day", "2026-01-01");
        localStorage.setItem("byeolharu_v1_theme", "dark");
        localStorage.setItem(
          "byeolharu_v1_history",
          JSON.stringify({ "2026-01-01": JSON.parse(raw) }),
        );
      }
    },
    { raw },
  );
  await page.goto("/");
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "기존 습관", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("새로운 습관");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "새로운 습관", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "새로운 습관", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("byeolharu_v1_habits")),
  ).toBe(raw);
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "기록 백업 내려받기" }).click();
  const backupFile = await download;
  expect(backupFile.suggestedFilename()).toContain("byeolharu-backup");
  const backup = JSON.parse(await readFile((await backupFile.path())!, "utf8"));
  const past = Object.values(backup.state.entities).find((e: unknown) => {
    const row = e as { kind: string; day: string };
    return row.kind === "habit_entries" && row.day === "2026-01-01";
  });
  expect(past).toMatchObject({
    data: {
      title: "기존 습관",
      completed: true,
      rating: 0,
      memo: "소중한 기록",
    },
  });
  expect(
    await page.evaluate(() =>
      Object.fromEntries(
        ["habits", "history", "day", "theme"].map((k) => [
          k,
          localStorage.getItem(`byeolharu_v1_${k}`),
        ]),
      ),
    ),
  ).toEqual({
    habits: raw,
    history: JSON.stringify({ "2026-01-01": JSON.parse(raw) }),
    day: "2026-01-01",
    theme: "dark",
  });
});
test("malformed legacy data is preserved and recovery is visible", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("byeolharu_v1_habits", "{broken");
    localStorage.setItem("byeolharu_v1_day", "2026-01-01");
  });
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await expect(page.getByText("원본 복구 확인 필요")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("byeolharu_v1_habits")),
  ).toBe("{broken");
});
test("two tabs preserve independent edits", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("탭 테스트");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "탭 테스트", exact: true }),
  ).toBeVisible();
  const second = await context.newPage();
  await second.goto("/");
  await second.getByRole("tab", { name: /전체/ }).click();
  await expect(
    second.getByRole("heading", { name: "탭 테스트", exact: true }),
  ).toBeVisible();
  await second
    .getByRole("button", { name: "탭 테스트 4점", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "탭 테스트 4점", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("backup restores into a new guest browser without overwriting another dataset", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("복원할 습관");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "복원할 습관", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "기록 백업 내려받기" }).click();
  const file = await (await download).path();
  const next = await browser.newContext();
  try {
    const target = await next.newPage();
    await target.goto("/");
    await target.getByRole("button", { name: "계정 및 데이터 관리" }).click();
    await expect(
      target.getByLabel("백업 복원 (기록이 없는 같은 계정·브라우저)"),
    ).toBeEnabled();
    await target
      .getByLabel("백업 복원 (기록이 없는 같은 계정·브라우저)")
      .setInputFiles(file!);
    await expect(target.getByText("백업을 복원했습니다.")).toBeVisible();
    await target.getByRole("button", { name: "닫기", exact: true }).click();
    await target.getByRole("tab", { name: /전체/ }).click();
    await expect(
      target.getByRole("heading", { name: "복원할 습관", exact: true }),
    ).toBeVisible();
  } finally {
    await next.close();
  }
});

test("editing, star cancellation, plain completion, alarms, theme and deletion survive reload", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("기능 회귀 습관");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "기능 회귀 습관 수정", exact: true })
    .click();
  await page.getByPlaceholder("예: 하루 10분 책 읽기").fill("수정된 습관");
  await page.getByLabel("예정 시간", { exact: true }).fill("23:59");
  await page.getByLabel("루틴 알림", { exact: true }).check();
  await page.getByRole("button", { name: "수정 완료", exact: true }).click();
  await page
    .getByRole("button", { name: "수정된 습관 3점", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "수정된 습관 3점", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "수정된 습관 3점", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "수정된 습관 3점", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("heading", { name: "수정된 습관", exact: true }).click();
  await page
    .getByPlaceholder("오늘의 느낌을 가볍게 남겨보세요.")
    .fill("회귀 확인 메모");
  await page
    .getByRole("button", { name: "단순 체크만 하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "다크 모드로 전환", exact: true })
    .click();
  await page.reload();
  await page.getByRole("tab", { name: /전체/ }).click();
  const card = page.locator(".habit-card").filter({
    has: page.getByRole("heading", { name: "수정된 습관", exact: true }),
  });
  await expect(card).toContainText("회귀 확인 메모");
  await expect(card).toContainText("실천 완료");
  await expect(card).toContainText("23:59");
  await expect(
    page.getByRole("button", { name: "라이트 모드로 전환", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "수정된 습관 수정", exact: true })
    .click();
  await expect(page.getByLabel("루틴 알림", { exact: true })).toBeChecked();
  await page
    .getByRole("button", { name: "이 습관 삭제하기", exact: true })
    .click();
  await expect(
    page.getByText("이 습관을 삭제할까요? 이전 날짜의 기록은 그대로 남아요."),
  ).toBeVisible();
  await page.getByRole("button", { name: "삭제 확인", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "습관 수정하기" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "수정된 습관", exact: true }),
  ).not.toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "수정된 습관", exact: true }),
  ).not.toBeVisible();
});
