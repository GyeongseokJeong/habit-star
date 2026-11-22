import test from "node:test";
import assert from "node:assert/strict";
import { launcherIconResources, patchLauncherManifest } from "./generate-launcher-icons.mjs";

test("icon artwork provides legacy, round and adaptive Android launcher resources", () => {
  const names=Object.keys(launcherIconResources);
  assert.equal(names.length,7);
  for(const name of ["drawable/byeolharu_launcher.xml","drawable/byeolharu_launcher_round.xml",
    "drawable/byeolharu_background.xml","drawable/byeolharu_foreground.xml",
    "drawable/byeolharu_monochrome.xml","drawable-v26/byeolharu_launcher.xml",
    "drawable-v26/byeolharu_launcher_round.xml"]) {
    assert.ok(names.includes(name), name);
    assert.match(launcherIconResources[name], /<vector|<adaptive-icon/);
  }
  assert.match(launcherIconResources["drawable/byeolharu_foreground.xml"], /#F5D993/);
  assert.match(launcherIconResources["drawable-v26/byeolharu_launcher.xml"], /<monochrome/);
});
test("manifest patch replaces default capacitor icon and is idempotent",()=>{
  const before='<manifest><application android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" /></manifest>';
  const next=patchLauncherManifest(before);
  assert.match(next,/android:icon="@drawable\/byeolharu_launcher"/);
  assert.match(next,/android:roundIcon="@drawable\/byeolharu_launcher_round"/);
  assert.equal(patchLauncherManifest(next),next);
  assert.throws(()=>patchLauncherManifest('<manifest><application /></manifest>'), /icon attribute/);
});
