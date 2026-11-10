import { test, expect } from "@playwright/test";

test("cloud-disabled mode keeps guest records available and callbacks fail closed", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "계정 및 데이터 관리" }).click();
  await expect(
    page.getByText("클라우드 연결이 아직 설정되지 않았습니다."),
  ).toBeVisible();
  await expect(page.getByLabel("이메일", { exact: true })).toHaveCount(0);
  for (const path of ["/auth/confirm", "/auth/callback"]) {
    const response = await request.get(
      `${path}?next=https://attacker.example`,
      {
        maxRedirects: 0,
      },
    );
    expect(response.status()).toBe(503);
    expect(await response.text()).toBe("Application URL is not configured");
    expect(response.headers()["cache-control"]).toBe("private, no-store");
  }
});
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
  expect(
    await page.evaluate(
      async () => !!(await caches.match("/noto-color-emoji-colr.woff2")),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      async () => !!(await caches.match("/starlit-night.png")),
    ),
  ).toBe(true);
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
  const paintedPixels = await page.evaluate(async () => {
    await document.fonts.load('40px "Byeolharu Color Emoji"', "🌱");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 80;
    const context = canvas.getContext("2d")!;
    context.font = '40px "Byeolharu Color Emoji"';
    context.fillText("🌱", 0, 50);
    return [...context.getImageData(0, 0, 80, 80).data].filter(
      (v, i) => i % 4 === 3 && v > 0,
    ).length;
  });
  expect(paintedPixels).toBeGreaterThan(100);
  await context.setOffline(false);
  await page.reload();
  await page.getByRole("tab", { name: /전체/ }).click();
  await expect(
    page.getByRole("button", { name: "오프라인 생산 빌드 4점", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
