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
assert.match(config, /SystemBars:\\s*\\{\\s*insetsHandling:\\s*"disable"/, "The guest WebView must not add CSS system insets on top of native viewport padding");

assert.match(patcher, /"io\\.github\\.gyeongseokjeong\\.byeolharu\\.packagedgueststep9"/);
assert.match(java, /__GUEST_SETTINGS_PLUGIN_REGISTER__/);
assert.match(patcher, /"registerPlugin\\(ByeolharuDeviceSettingsPlugin\\.class\\);"/);
assert.ok(java.indexOf("__GUEST_SETTINGS_PLUGIN_REGISTER__") < java.indexOf("super.onCreate(state)"),
  "Capacitor plugin registration placeholder must precede bridge initialization");

assert.match(settingsJava, /@CapacitorPlugin\(name = "ByeolharuDeviceSettings"\)/);
assert.match(settingsJava, /Settings\.ACTION_APP_NOTIFICATION_SETTINGS/);
assert.match(settingsJava, /Settings\.EXTRA_APP_PACKAGE/);
assert.match(settingsJava, /getContext\(\)\.getPackageName\(\)/);
assert.match(settingsJava, /call\.resolve\(\)/);
assert.match(patcher, /assert\\.equal\\(\\s*targetPackage,/);
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

const backScript = javaStringConstant("DISMISS_DIALOG_JS");
const themeScript = javaStringConstant("READ_THEME_JS");

function runBack(dialog) {
  return runInNewContext(backScript, {
    document: { querySelector: (selector) => selector === "dialog[open]" ? dialog : null },
  });
}
assert.equal(runBack(null), false, "No open modal: let Android handle history/back");
let click = "";
const modal = {
  querySelector: (selector) => {
    if (selector === "button.modal-back") return { click: () => { click = "account-back"; } };
    if (selector === ".modal-top button:last-child") return { click: () => { click = "close"; } };
    return null;
  },
};
assert.equal(runBack(modal), true);
assert.equal(click, "account-back", "Account detail must navigate to account home first");
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
console.log("Native back/dialog and theme-contrast script checks OK (not a device test)");
