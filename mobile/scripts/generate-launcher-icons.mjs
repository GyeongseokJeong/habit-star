/**
 * Deterministic first-party Android launcher icon.
 *
 * The generated Capacitor Android project is intentionally NOT versioned.
 * Materialize these resources after every `cap sync android` for debug and
 * release, with no external image service, binary blobs or network access.
 * Android adaptive launcher assets must be separate from the PWA favicon.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ns = 'xmlns:android="http://schemas.android.com/apk/res/android"';
const icon = (paths) =>
  `<?xml version="1.0" encoding="utf-8"?>
<vector ${ns} android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
${paths.join("\n")}
</vector>
`;
const path = (color, data) => `  <path android:fillColor="${color}" android:pathData="${data}" />`;

// Leave generous content safety margins for circular launcher masks.
const backgroundPaths = [
  path("#14203D", "M0,0 L108,0 L108,108 L0,108 Z"),
  path("#202F55", "M0,75 C20,71 35,80 54,89 C72,97 92,78 108,83 L108,108 L0,108 Z"),
  path("#30416D", "M0,90 C22,82 36,99 54,96 C73,94 88,82 108,90 L108,108 L0,108 Z"),
  path("#443F73", "M0,103 C25,96 44,106 58,101 C78,94 96,93 108,99 L108,108 L0,108 Z"),
];
const starPaths = [
  // A round-curved gold four-point star is recognizable even at 48px.
  path("#F5D993", "M54,28 C58,44 63,49 80,54 C63,59 58,65 54,82 C50,65 45,59 28,54 C45,49 50,44 54,28 Z"),
  path("#DDAE5D", "M54,82 C58,65 63,59 80,54 C64,54 57,60 54,82 Z"),
  // Secondary sparkle and three quiet lilac stars.
  path("#F8E2AB", "M77,26 C79,32 82,35 88,37 C82,39 79,42 77,48 C75,42 72,39 66,37 C72,35 75,32 77,26 Z"),
  path("#A9B4F4", "M27,36 C28,39 29,40 32,41 C29,42 28,43 27,46 C26,43 25,42 22,41 C25,40 26,39 27,36 Z"),
  path("#A9B4F4", "M82,70 C83,72 84,73 86,74 C84,75 83,76 82,78 C81,76 80,75 78,74 C80,73 81,72 82,70 Z"),
];
const monoPaths = [
  path("#FFFFFFFF", "M54,28 C58,44 63,49 80,54 C63,59 58,65 54,82 C50,65 45,59 28,54 C45,49 50,44 54,28 Z"),
  path("#FFFFFFFF", "M77,26 C79,32 82,35 88,37 C82,39 79,42 77,48 C75,42 72,39 66,37 C72,35 75,32 77,26 Z"),
];

export const launcherIconResources = Object.freeze({
  // Android 7-8 legacy icon fallback; no web asset is touched.
  "drawable/byeolharu_launcher.xml": icon([...backgroundPaths, ...starPaths]),
  "drawable/byeolharu_launcher_round.xml": icon([
    path("#14203D", "M54,0 A54,54 0 1,1 53.99,0 Z"),
    ...backgroundPaths.slice(1),
    ...starPaths,
  ]),
  "drawable/byeolharu_background.xml": icon(backgroundPaths),
  "drawable/byeolharu_foreground.xml": icon(starPaths),
  "drawable/byeolharu_monochrome.xml": icon(monoPaths),
  // Android 8+ adaptive launcher, with a monochrome path for Android 13+
  "drawable-v26/byeolharu_launcher.xml": `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon ${ns}>
  <background android:drawable="@drawable/byeolharu_background" />
  <foreground android:drawable="@drawable/byeolharu_foreground" />
  <monochrome android:drawable="@drawable/byeolharu_monochrome" />
</adaptive-icon>
`,
  "drawable-v26/byeolharu_launcher_round.xml": `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon ${ns}>
  <background android:drawable="@drawable/byeolharu_background" />
  <foreground android:drawable="@drawable/byeolharu_foreground" />
  <monochrome android:drawable="@drawable/byeolharu_monochrome" />
</adaptive-icon>
`,
});

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
  for (const [relativePath, content] of Object.entries(launcherIconResources)) {
    const file = join(appMainPath, "res", relativePath);
    mkdirSync(join(appMainPath, "res", relativePath.slice(0, relativePath.indexOf("/"))), { recursive: true });
    writeFileSync(file, content, "utf8");
  }
  const manifestPath = join(appMainPath, "AndroidManifest.xml");
  const original = readFileSync(manifestPath, "utf8");
  const updated = patchLauncherManifest(original);
  if (original !== updated) writeFileSync(manifestPath, updated, "utf8");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // Intentionally no implicit fallback path; use npm run android:sync.
  throw new Error("Launcher icon assets are applied by mobile/scripts/patch-android.mjs after Capacitor sync.");
}
