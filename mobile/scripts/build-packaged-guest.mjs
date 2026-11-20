import assert from "node:assert/strict";
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
rmSync(out, {recursive:true,force:true});
mkdirSync(out, {recursive:true});
// First-party static resources (artwork, PWA icons, emoji, etc.).
cpSync(resolve(root, "public"), out, {recursive:true});
copyFileSync(resolve(mobile, "packaged-guest/index.html"), resolve(out, "index.html"));

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
    "process.env.NEXT_PUBLIC_CLOUD_ENABLED": '"false"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '""',
  },
  loader: {
    ".svg": "file", ".png": "file", ".jpeg": "file", ".jpg": "file",
    ".webp": "file", ".woff": "file", ".woff2": "file",
  },
  logLevel:"info",
});
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
console.log("STEP 9 actual Byeolharu guest UI bundle prepared: "+js.length+" bytes JS; "+result.css.length+" bytes CSS");
