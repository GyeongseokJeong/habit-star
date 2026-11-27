/**
 * Render the real shared AccountPanel with a held native reminder operation.
 * The mock owns only bridge results, never the widget, permission or scheduler
 * itself. A genuine browser must prove layout stability while work is pending.
 */
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const fixture = `
  import React, { useState } from "react";
  import { createRoot } from "react-dom/client";
  import { AccountPanel } from "@/components/account/account-panel";
  const theme = new URLSearchParams(location.search).get("theme") || "dark";
  const app = { user: null, snapshot: null, busy: false, status: "", error: null };
  let finish;
  let calls = [];
  let display = "granted";
  window.wrapupTest = {
    calls: () => calls,
    complete: result => { finish(result); finish = undefined; },
    setDisplay: value => { display = value; },
  };
  function Fixture() {
    const [busy, setBusy] = useState(false);
    const [wrapupSettings, setSettings] = useState({
      morning: { enabled: false, time: "10:30" },
      day: { enabled: true, time: "16:30" },
      night: { enabled: true, time: "22:00" },
    });
    const nativeReminders = {
      permissionState: "granted", exactPermission: "granted", enabled: true,
      busy, status: "", wrapupSettings,
      onCheckPermissions: async () => ({ permissionState: display, exactPermission: "granted" }),
      onDismissPermissionOffer: () => {},
      onRequestPermission: async () => { throw Error("unexpected permission request"); },
      onWrapupChange: async (group, patch) => {
        calls.push({ group, patch });
        setBusy(true);
        const accepted = await new Promise(resolve => { finish = resolve; });
        if (accepted) setSettings(previous => ({
          ...previous, [group]: { ...previous[group], ...patch },
        }));
        setBusy(false);
        return accepted;
      },
    };
    return <div className={"byeolharu " + theme}><div className="account-panel">
      <AccountPanel app={app} page="settings" onNavigate={() => {}} theme="system"
        onThemeChange={() => {}} compactView={false} onCompactViewChange={() => {}}
        nativeReminders={nativeReminders} />
    </div></div>;
  }
  createRoot(document.getElementById("root")).render(<Fixture />);
`;

async function geometry(page) {
  return page.evaluate(() => {
    const card = document.querySelector(".android-wrapup-settings");
    const next = [...document.querySelectorAll(".account-settings-group-title")]
      .find(el => el.textContent === "화면");
    const round = value => Math.round(value * 100) / 100;
    return {
      cardHeight: round(card.getBoundingClientRect().height),
      nextTop: round(next.getBoundingClientRect().top),
      states: [...card.querySelectorAll(".android-wrapup-period")].map(row => {
        const button = row.querySelector("button");
        const select = row.querySelector("select");
        return {
          checked: button.getAttribute("aria-checked"),
          buttonOpacity: getComputedStyle(button).opacity,
          track: getComputedStyle(button.querySelector(".compact-switch-track")).backgroundColor,
          selectOpacity: getComputedStyle(select).opacity,
        };
      }),
    };
  });
}

export async function assertWrapupSettingsStable(browser, origin) {
  const bundle = await build({
    stdin: { contents: fixture, resolveDir: root, loader: "tsx" },
    bundle: true, platform: "browser", write: false,
    tsconfig: resolve(root, "tsconfig.json"),
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_CLOUD_ENABLED": '"false"', "process.env": "{}" },
  });
  for (const width of [320, 390, 430]) for (const theme of ["light", "dark"]) {
    const page = await browser.newPage({ viewport: { width, height: 852 } });
    try {
      await page.goto(origin + "/__wrapup_fixture__?theme=" + theme);
      await page.addStyleTag({ url: origin + "/app.css" });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      const card = page.getByLabel("시간대 마무리 알림");
      const morning = card.getByRole("switch", { name: "아침 마무리 알림" });
      const day = card.getByRole("switch", { name: "낮 마무리 알림" });
      const time = card.getByLabel("아침 마무리 알림 시간");
      await morning.waitFor();
      await page.evaluate(async () => { await document.fonts.ready; });
      const waitUnlocked = () => page.waitForFunction(() =>
        [...document.querySelectorAll(".android-wrapup-toggle")].every(button => !button.disabled));
      const pending = async (control, start, expectedCallCount) => {
        // Wait until initial transition completes so computed styles are stable.
        await page.waitForTimeout(200);
        const before = await geometry(page);
        await start();
        await page.waitForFunction(n => window.wrapupTest.calls().length === n, expectedCallCount);
        await page.waitForFunction(() => document.querySelector(".android-wrapup-settings [aria-busy=true]"));
        assert.equal(await control.getAttribute("aria-busy"), "true");
        assert.deepEqual(await geometry(page), before, `${theme}/${width}: layout and colors unchanged during pending work`);
        assert.ok(await day.isDisabled(), "Other rows remain actually locked");
        const live = card.getByRole("status");
        assert.match(await live.textContent(), /알림 설정을 확인/);
        assert.ok(await live.evaluate(el => el.getBoundingClientRect().height <= 1), "Live status is visually hidden");
        await day.evaluate(button => button.click()); // disabled clicks cannot enter the native operation
        assert.equal(await page.evaluate(() => window.wrapupTest.calls().length), expectedCallCount);
        return before;
      };
      const complete = async success => {
        await page.evaluate(value => window.wrapupTest.complete(value), success);
        await waitUnlocked();
      };
      const first = await pending(morning, () => morning.click(), 1);
      assert.equal(first.states[0].checked, "false");
      assert.equal(first.states[0].selectOpacity, "0.55");
      await complete(true);
      assert.equal(await morning.getAttribute("aria-checked"), "true");
      assert.equal(await time.isDisabled(), false);
      const after = await geometry(page);
      assert.equal(after.cardHeight, first.cardHeight);
      assert.equal(after.nextTop, first.nextTop);

      const beforeTime = await pending(time, () => time.selectOption("09:30"), 2);
      await complete(true);
      assert.equal(await time.inputValue(), "09:30");
      assert.equal((await geometry(page)).nextTop, beforeTime.nextTop);

      const beforeOff = await pending(morning, async () => {
        await morning.focus();
        await page.keyboard.press("Space");
      }, 3);
      await complete(true);
      assert.equal(await morning.getAttribute("aria-checked"), "false");
      assert.equal(await time.isDisabled(), true);
      assert.equal((await geometry(page)).nextTop, beforeOff.nextTop);

      await pending(morning, () => morning.click(), 4);
      await complete(false);
      assert.equal(await morning.getAttribute("aria-checked"), "false");
      assert.match(await page.getByRole("alert").textContent(), /알림 설정을 저장하지 못했어요/);

      // Permission recovery remains deliberate: dismissing does not save ON.
      await page.evaluate(() => window.wrapupTest.setDisplay("denied"));
      await morning.click();
      const dialog = page.getByRole("dialog", { name: "습관 알림을 설정할까요?" });
      await dialog.getByRole("button", { name: "나중에" }).click();
      await waitUnlocked();
      assert.equal(await morning.getAttribute("aria-checked"), "false");
      assert.equal(await page.evaluate(() => window.wrapupTest.calls().length), 4);
      assert.equal(await page.evaluate(() => document.body.scrollWidth <= innerWidth), true);
      console.log(`PASS: wrap-up settings stable at ${width}px / ${theme}, ON/OFF/time/failure/permission dismissal`);
    } finally {
      await page.close();
    }
  }
}
