import assert from "node:assert/strict";
import { sourceBuildInfo } from "./build-info.mjs";
import { cpSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

assert.equal(process.env.BYEOLHARU_POC_PACKAGED_GUEST, "1", "STEP 9 packaging must be explicitly enabled");
assert.notEqual(process.env.BYEOLHARU_POC_REMOTE_DEBUG, "1", "Release candidate may not use remote WebView");
assert.notEqual(process.env.BYEOLHARU_POC_NOTIFICATIONS, "1", "STEP 9 is separate from notification demo packages");
const mobile = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(mobile, "..");
const out = resolve(mobile, "www-packaged-guest");
const provenance = sourceBuildInfo(root, true);
const widgetDirectPractice = provenance.widgetPractice !== "read-only";
// Public API settings only. Never package secret/service-role credentials.
const publicAuth = JSON.parse(readFileSync(resolve(mobile, "public-auth-config.json"), "utf8"));
assert.match(publicAuth.supabaseUrl, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
assert.match(publicAuth.supabasePublishableKey, /^sb_publishable_[A-Za-z0-9_-]+$/);
assert.match(publicAuth.siteOrigin, /^https:\/\/[a-z0-9.-]+$/);
assert.ok(!publicAuth.siteOrigin.includes("localhost"));
rmSync(out, {recursive:true,force:true});
mkdirSync(out, {recursive:true});
// First-party static resources (artwork, PWA icons, emoji, etc.).
cpSync(resolve(root, "public"), out, {recursive:true});
copyFileSync(resolve(mobile, "packaged-guest/index.html"), resolve(out, "index.html"));
copyFileSync(resolve(mobile, "packaged-guest/safe-area.css"), resolve(out, "safe-area.css"));
writeFileSync(resolve(out, "build-info.json"), JSON.stringify(provenance, null, 2) + "\n");

// Browser-only React code. Disable server-auth client initialization for the
// first guest-only Android APK. No credentials are embedded in the package.
await build({
  absWorkingDir: root,
  entryPoints: [resolve(mobile, "packaged-guest/main.tsx")],
  outfile: resolve(out, "app.js"),
  tsconfig: resolve(root, "tsconfig.json"),
  platform: "browser",
  format: "iife",
  bundle: true,
  // Browser-only compatibility for third-party modules using Node process.
  inject: [resolve(mobile, "packaged-guest/browser-process-shim.js")],
  minify: true,
  target: "es2022",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_APP_VERSION": JSON.stringify(provenance.version),
    "process.env.NEXT_PUBLIC_BUILD_SHA": JSON.stringify(provenance.sourceSha),
    "process.env.NEXT_PUBLIC_ANDROID_RELEASE": JSON.stringify(provenance.variant === "release" ? "true" : "false"),
    "process.env.NEXT_PUBLIC_ANDROID_WIDGET_DIRECT_PRACTICE": JSON.stringify(widgetDirectPractice ? "true" : "false"),
    "process.env.NEXT_PUBLIC_ANDROID_PACKAGED_GUEST": '"true"',
    "process.env.NEXT_PUBLIC_CLOUD_ENABLED": '"true"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": JSON.stringify(publicAuth.supabaseUrl),
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicAuth.supabasePublishableKey),
    "process.env.NEXT_PUBLIC_SITE_URL": JSON.stringify(publicAuth.siteOrigin),
  },
  loader: {
    ".svg": "file", ".png": "file", ".jpeg": "file", ".jpg": "file",
    ".webp": "file", ".woff": "file", ".woff2": "file",
  },
  logLevel:"info",
});
// Isolated offline runtime: Debug or explicit test-only release candidate.
// No React mount, network or Auth client.
if (widgetDirectPractice) {
  await build({
    absWorkingDir: root,
    entryPoints: [resolve(mobile, "packaged-guest/widget-cold-entry.ts")],
    outfile: resolve(out, "widget-cold-runtime.js"),
    tsconfig: resolve(root, "tsconfig.json"),
    platform: "browser", format: "iife", bundle: true, minify: true, target: "es2022",
  });
}
// Reuse the actual design CSS, not an invented look-alike.
const cssPath = resolve(root, "app/globals.css");
const result = await postcss([tailwind({base:root})]).process(
  readFileSync(cssPath, "utf8"),
  {from:cssPath,to:resolve(out,"app.css")},
);
writeFileSync(resolve(out,"app.css"), result.css);
const js = readFileSync(resolve(out,"app.js"),"utf8");
assert.ok(js.length > 30000,"Actual application bundle appears empty");
assert.ok(!js.includes("service_role"),"Do not embed server credentials");
const html=readFileSync(resolve(out,"index.html"),"utf8");
assert.ok(!/https?:\/\/[^"'\s]+/.test(html),"Packaged shell may not load remote scripts");
console.log("Packaged Byeolharu guest UI: "+js.length+" bytes JS, "+result.css.length+" bytes CSS; source "+provenance.sourceSha.slice(0, 8));
