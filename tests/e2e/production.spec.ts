import { test, expect } from "@playwright/test";
test("production fonts are self-hosted and the cached shell preserves offline edits after reload", async ({
  page,
  context,
}) => {
  const externalFonts: string[] = [],
    localFonts: string[] = [],
    errors: string[] = [];
  context.on("request", (request) => {
    const u = new URL(request.url());
    if (/fonts\.(googleapis|gstatic)\.com/.test(u.hostname))
      externalFonts.push(u.hostname);
    if (u.pathname.endsWith(".woff2")) localFonts.push(u.hostname);
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "새 습관 추가", exact: true }).click();
  await page
    .getByPlaceholder("예: 하루 10분 책 읽기")
    .fill("오프라인 생산 빌드");
  await page
    .getByRole("button", { name: "새 습관 추가하기", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "오프라인 생산 빌드", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await expect.poll(() => localFonts.length).toBeGreaterThan(0);
  expect(externalFonts).toEqual([]);
  expect(localFonts.every((h) => h === "localhost")).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("heading", { name: "오프라인 생산 빌드", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "오프라인 생산 빌드 4점", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "오프라인 생산 빌드 4점", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await context.setOffline(false);
  await page.reload();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("button", { name: "오프라인 생산 빌드 4점", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
