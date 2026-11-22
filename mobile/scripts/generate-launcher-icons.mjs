/**
 * Android launcher art V2: the APPROVED raster scene, never a vector redraw.
 * The graphic is committed as a tiny WebP in mobile/assets and copied after
 * Capacitor sync, which regenerates mobile/android during CI builds.
 */
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ns = 'xmlns:android="http://schemas.android.com/apk/res/android"';
const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const approvedArtPath = resolve(mobileRoot, "assets/android-launcher/approved-scene.webp");
export const approvedArtSha256 = "e0064679b3ad97eaa5566115bebd2856a0b3d44f3b64aa753aece22f905c3824";

const icon = (paths) =>
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<vector ' + ns + ' android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n' +
  paths.join("\n") + '\n</vector>\n';
const path = (color, data) => '  <path android:fillColor="' + color + '" android:pathData="' + data + '" />';
const mono = icon([
  path("#FFFFFFFF","M54,28 C58,44 63,49 80,54 C63,59 58,65 54,82 C50,65 45,59 28,54 C45,49 50,44 54,28 Z"),
  path("#FFFFFFFF","M77,26 C79,32 82,35 88,37 C82,39 79,42 77,48 C75,42 72,39 66,37 C72,35 75,32 77,26 Z"),
]);
const background = icon([path("#141D3D","M0,0 L108,0 L108,108 L0,108 Z")]);
const legacy = '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<layer-list ' + ns + '>\n  <item android:drawable="@drawable/byeolharu_scene" />\n</layer-list>\n';
const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n' +
  '<adaptive-icon ' + ns + '>\n' +
  '  <background android:drawable="@drawable/byeolharu_background" />\n' +
  '  <foreground android:drawable="@drawable/byeolharu_scene" />\n' +
  '  <monochrome android:drawable="@drawable/byeolharu_monochrome" />\n' +
  '</adaptive-icon>\n';

export const launcherIconResources = Object.freeze({
  "drawable/byeolharu_launcher.xml": legacy,
  "drawable/byeolharu_launcher_round.xml": legacy,
  "drawable/byeolharu_background.xml": background,
  "drawable/byeolharu_monochrome.xml": mono,
  "drawable-v26/byeolharu_launcher.xml": adaptive,
  "drawable-v26/byeolharu_launcher_round.xml": adaptive,
});

export function checkApprovedArt() {
  assert.ok(existsSync(approvedArtPath), "Approved launcher scene is missing");
  const image = readFileSync(approvedArtPath);
  assert.equal(createHash("sha256").update(image).digest("hex"), approvedArtSha256,
    "Do not silently replace or redraw the approved launcher artwork");
  assert.equal(image.toString("ascii",0,4),"RIFF","Expected RIFF container");
  assert.equal(image.toString("ascii",8,12),"WEBP","Expected WebP source");
  return image.length;
}

export function patchLauncherManifest(manifest) {
  assert.equal((manifest.match(/<application\b/g) || []).length, 1, "Android application manifest not found");
  assert.equal((manifest.match(/android:icon="[^"]+"/g) || []).length, 1, "Android app icon attribute must be unique");
  assert.equal((manifest.match(/android:roundIcon="[^"]+"/g) || []).length, 1, "Android round icon attribute must be unique");
  return manifest
    .replace(/android:icon="[^"]+"/, 'android:icon="@drawable/byeolharu_launcher"')
    .replace(/android:roundIcon="[^"]+"/, 'android:roundIcon="@drawable/byeolharu_launcher_round"');
}

export function applyLauncherIcons(appMainPath) {
  assert.ok(typeof appMainPath === "string" && appMainPath, "Invalid native resource root");
  checkApprovedArt();
  const artOutput = join(appMainPath, "res/drawable-nodpi/byeolharu_scene.webp");
  mkdirSync(dirname(artOutput), { recursive:true });
  copyFileSync(approvedArtPath, artOutput);
  for (const [relativePath, content] of Object.entries(launcherIconResources)) {
    const file = join(appMainPath, "res",relativePath);
    mkdirSync(dirname(file), {recursive:true});
    writeFileSync(file,content,"utf8");
  }
  const manifestPath = join(appMainPath,"AndroidManifest.xml");
  const original = readFileSync(manifestPath,"utf8");
  const updated = patchLauncherManifest(original);
  if(original!==updated) writeFileSync(manifestPath,updated,"utf8");
}

if(process.argv[1] && fileURLToPath(import.meta.url)===process.argv[1]) {
  throw new Error("Use mobile/scripts/patch-android.mjs after Capacitor sync.");
}
