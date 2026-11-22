import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const java = readFileSync(resolve(root, "native/MainActivity.java.template"), "utf8");
const patcher = readFileSync(resolve(root, "scripts/patch-android.mjs"), "utf8");
const config = readFileSync(resolve(root, "capacitor.config.ts"), "utf8");
const settingsJava = readFileSync(resolve(root, "native/ByeolharuDeviceSettingsPlugin.java.template"), "utf8");

assert.match(java, /extends BridgeActivity/);
for (const method of ["onResume", "onPause", "onDestroy"]) {
  assert.match(java, new RegExp(`public void ${method}\\(\\)`), `Capacitor BridgeActivity requires public ${method}`);
}
assert.match(java, /getOnBackPressedDispatcher\(\)/);
assert.match(java, /view\.canGoBack\(\)/);
assert.match(java, /view\.goBack\(\)/);
assert.match(java, /finish\(\)/);
assert.match(java, /handler\.removeCallbacks\(themeSync\)/);
assert.match(java, /setAppearanceLightStatusBars\(light\)/);
assert.match(java, /setAppearanceLightNavigationBars\(light\)/);
assert.match(java, /getPackageName\(\)\.endsWith\("\.packagedgueststep9"\)/);
assert.match(java, /WindowCompat\.setDecorFitsSystemWindows\(getWindow\(\), false\)/);
assert.match(java, /ViewCompat\.setOnApplyWindowInsetsListener\(content/);
assert.match(java, /WindowInsetsCompat\.Type\.systemBars\(\)/);
assert.match(java, /WindowInsetsCompat\.Type\.displayCutout\(\)/);
assert.match(java, /content\.setPadding\(bars\.left, bars\.top, bars\.right, bars\.bottom\)/);
assert.match(java, /\.setInsets\(types, Insets\.NONE\)/);
assert.match(config, /plugins:\s*\{\s*SystemBars:\s*\{\s*insetsHandling:\s*"disable"/, "Native and CSS insets must not overlap");

assert.match(patcher, /assert\.equal\(\s*targetPackage,/, "Patcher must verify the exact installed package");
assert.match(java, /__GUEST_SETTINGS_PLUGIN_REGISTER__/);
assert.match(patcher, /"registerPlugin\(ByeolharuDeviceSettingsPlugin\.class\);"/);
assert.ok(java.indexOf("__GUEST_SETTINGS_PLUGIN_REGISTER__") < java.indexOf("super.onCreate(state)"),
  "Capacitor plugin registration placeholder must precede bridge initialization");

assert.match(settingsJava, /@CapacitorPlugin\(name = "ByeolharuDeviceSettings"\)/);
assert.match(settingsJava, /Settings\.ACTION_APP_NOTIFICATION_SETTINGS/);
assert.match(settingsJava, /Settings\.EXTRA_APP_PACKAGE/);
assert.match(settingsJava, /getContext\(\)\.getPackageName\(\)/);
assert.match(settingsJava, /call\.resolve\(\)/);
assert.match(patcher, /"io\.github\.gyeongseokjeong\.byeolharu\.packagedgueststep9"/);
assert.match(patcher, /ByeolharuDeviceSettingsPlugin\.java\.template/);


function javaStringConstant(name) {
  const anchor = `private static final String ${name} =`;
  const start = java.indexOf(anchor);
  assert.ok(start >= 0, `Missing ${name}`);
  const lines = java.slice(start + anchor.length).split("\n");
  const pieces = [];
  for (const line of lines) {
    const piece = line.trim();
    if (!piece) continue;
    const last = piece.endsWith(";");
    const quoted = piece.replace(/\s*\+?;?$/, "");
    pieces.push(JSON.parse(quoted));
    if (last) break;
  }
  return pieces.join("");
}

const backScript = javaStringConstant("HANDLE_IN_APP_BACK_JS");
assert.match(java, /view\.evaluateJavascript\(HANDLE_IN_APP_BACK_JS/, "Android must use the in-app navigation dispatcher");
assert.ok(backScript.indexOf("dialog[open]") < backScript.indexOf(".byeolharu.reflection-layout"),
  "A modal over the reflection must close before navigating to the calendar");
const themeScript = javaStringConstant("READ_THEME_JS");

function runBack(dialog, reflection = null) {
  return runInNewContext(backScript, {
    document: {
      querySelector: selector => selector === "dialog[open]" ? dialog
        : selector === ".byeolharu.reflection-layout" ? reflection : null,
    },
  });
}
assert.equal(runBack(null), false, "At app root, let Android handle WebView history/back");
let reflectionBackClicks = 0;
const reflection = {
  querySelector: selector => selector === "#weekly-reflection-back"
    ? { click: () => { reflectionBackClicks++; } } : null,
};
assert.equal(runBack(null, reflection), true, "Hardware back must leave the 7-day reflection");
assert.equal(reflectionBackClicks, 1, "Use the existing React 달력으로 action, not native WebView.goBack");
assert.equal(runBack(null, { querySelector: () => null }), false,
  "Only a currently visible reflection with its return button handles back");
let click = "";
const modal = {
  querySelector: (selector) => {
    if (selector === "button.modal-back") return { click: () => { click = "account-back"; } };
    if (selector === ".modal-top button:last-child") return { click: () => { click = "close"; } };
    return null;
  },
};
assert.equal(runBack(modal, reflection), true);
assert.equal(click, "account-back", "Open dialog back takes priority over reflection navigation");
assert.equal(reflectionBackClicks, 1, "Modal back must not also leave the reflection");
assert.equal(runBack({ querySelector: (selector) => selector === ".modal-top button:last-child" ? { click: () => { click = "close"; } } : null }), true);
assert.equal(click, "close", "Regular modal should invoke its existing React close control");
assert.equal(runBack({ querySelector: () => null }), false, "Missing controls should not swallow Android back");

function runTheme(value) {
  return runInNewContext(themeScript, {
    document: {
      querySelector: () => value === null ? null : { classList: { contains: () => value === "dark" } },
      documentElement: { dataset: { byeolharuTheme: value === "dark" ? "dark" : "" } },
    },
  });
}
assert.equal(runTheme("dark"), "dark");
assert.equal(runTheme("light"), "light");
assert.equal(runTheme(null), "unknown");
console.log("Native back: modal > reflection > WebView history > root exit; theme checks OK (not a device test)");
