import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyLauncherIcons, approvedArtPath, checkApprovedArt, launcherIconResources, patchLauncherManifest } from "./generate-launcher-icons.mjs";

test("committed, approved image is used verbatim, not redrawn as vector shapes", () => {
  assert.ok(approvedArtPath.endsWith("mobile/assets/android-launcher/approved-scene.webp"));
  assert.ok(checkApprovedArt() > 4000);
  assert.equal(Object.keys(launcherIconResources).length, 6);
  assert.match(launcherIconResources["drawable-v26/byeolharu_launcher.xml"], /foreground android:drawable="@drawable\/byeolharu_scene"/);
  assert.match(launcherIconResources["drawable-v26/byeolharu_launcher.xml"], /monochrome/);
  assert.ok(!launcherIconResources["drawable/byeolharu_launcher.xml"].includes("F5D993"));
});
test("manifest patch preserves package attributes and is idempotent", () => {
  const before='<manifest><application android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" /></manifest>';
  const after=patchLauncherManifest(before);
  assert.match(after,/android:icon="@drawable\/byeolharu_launcher"/);
  assert.match(after,/android:roundIcon="@drawable\/byeolharu_launcher_round"/);
  assert.equal(patchLauncherManifest(after),after);
  assert.throws(()=>patchLauncherManifest('<manifest><application /></manifest>'), /icon attribute/);
});
test("Capacitor regeneration copies approved image bytes into drawable-nodpi for both build types", () => {
  const native=mkdtempSync(join(tmpdir(),"byeolharu-icon-"));
  mkdirSync(native,{recursive:true});
  writeFileSync(join(native,"AndroidManifest.xml"),'<manifest><application android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" /></manifest>');
  applyLauncherIcons(native);
  assert.deepEqual(readFileSync(join(native,"res/drawable-nodpi/byeolharu_scene.webp")),readFileSync(approvedArtPath));
  assert.match(readFileSync(join(native,"res/drawable-v26/byeolharu_launcher.xml"),"utf8"), /adaptive-icon/);
  assert.match(readFileSync(join(native,"AndroidManifest.xml"),"utf8"),/byeolharu_launcher/);
  applyLauncherIcons(native);
});
