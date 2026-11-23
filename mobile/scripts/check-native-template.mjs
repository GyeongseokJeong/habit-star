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
assert.match(java, /moveTaskToBack\\(true\\)/);
assert.match(java, /BACK_EXIT_WINDOW_MS = 2000L/);
assert.match(java, /SystemClock\\.uptimeMillis\\(\\)/);
assert.match(java, /lastRootBackAt = 0L/);
assert.match(java, /Toast\\.makeText\\(this, "한 번 더 누르면 앱을 종료해요"/);
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

function runBack({ dialog = null, reflection = null, selected = null, interacted = false } = {}) {
  const clicks = [];
  const all = { click: () => clicks.push("all") };
  const guard = { __byeolharuBackInteraction: interacted };
  const document = {
    querySelector: selector => {
      if (selector === "dialog[open]") return dialog;
      if (selector === ".byeolharu.reflection-layout") return reflection;
      if (selector === "[role=tab][aria-selected=true]") return selected;
      return null;
    },
    getElementById: id => id === "tab-all" ? all : null,
    addEventListener: () => {},
  };
  const result = runInNewContext(backScript, { document, window: guard });
  return { result, clicks, interacted: guard.__byeolharuBackInteraction };
}
assert.equal(runBack().result, "root", "No intermediate screen means the native root-exit guard");
assert.equal(runBack({ interacted: true }).result, "root-changed",
  "Interactions must invalidate the previous exit confirmation");
assert.equal(runBack({ selected: { id: "tab-all" } }).result, "root",
  "All habits is the only root routine tab");
for (const tab of ["tab-morning", "tab-day", "tab-night", "tab-matrix"]) {
  const result = runBack({ selected: { id: tab } });
  assert.equal(result.result, "handled", `Back from ${tab} must return to all habits`);
  assert.deepEqual(result.clicks, ["all"]);
}
const fromReflection = { querySelector: selector => selector === "#weekly-reflection-back"
  ? { click: () => { fromReflection.clicks++; } } : null, clicks: 0 };
assert.equal(runBack({ reflection: fromReflection, selected: { id: "tab-matrix" } }).result, "handled");
assert.equal(fromReflection.clicks, 1);
assert.equal(runBack({ reflection: { querySelector: () => null } }).result, "handled",
  "Never exit when a reflection is open even if its return button is missing");
const dialogClicks = [];
const modal = {
  querySelector: selector => {
    if (selector === "button.modal-back") return { click: () => dialogClicks.push("back") };
    if (selector === ".modal-top button:last-child") return { click: () => dialogClicks.push("close") };
    return null;
  },
};
assert.equal(runBack({ dialog: modal, reflection: fromReflection }).result, "handled");
assert.deepEqual(dialogClicks, ["back"], "Account detail must return to its parent first");
assert.equal(fromReflection.clicks, 1, "Dialog takes priority over reflection");
assert.equal(runBack({ dialog: { querySelector: selector => selector === ".modal-top button:last-child"
  ? { click: () => dialogClicks.push("close") } : null } }).result, "handled");
assert.deepEqual(dialogClicks, ["back", "close"]);
assert.equal(runBack({ dialog: { querySelector: () => null } }).result, "handled",
  "Missing modal controls must never fall through to exit");
assert.ok(backScript.indexOf("dialog[open]") < backScript.indexOf(".byeolharu.reflection-layout"));
assert.ok(backScript.indexOf(".byeolharu.reflection-layout") < backScript.indexOf("[role=tab][aria-selected=true]"));
assert.ok(java.indexOf("if (view.canGoBack())") < java.indexOf("handleRootBack();", java.indexOf("if (view.canGoBack())")),
  "WebView history must be resolved before the root double-back guard");
assert.match(java, /"\\\"handled\\\"".equals\\(result\\)/);
assert.match(java, /void handleRootBack\\(\\)/);
assert.match(java, /lastRootBackAt = 0L;\\s*foreground = false;/);

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
console.log("Native back: dialog > reflection > routine tab > history > 2-second root exit, theme OK (not a device test)");
