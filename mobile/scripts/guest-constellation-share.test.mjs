import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname,"../..");
const read = file => readFileSync(resolve(root,file),"utf8");

test("the packaged Android bundle renders raw stage images without a Next optimizer",()=>{
  const artwork=read("components/constellation-artwork.tsx");
  const packager=read("mobile/scripts/build-packaged-guest.mjs");
  assert.match(artwork,/unoptimized=\{process\.env\.NEXT_PUBLIC_ANDROID_PACKAGED_GUEST === "true"\}/);
  assert.match(packager,/"process\.env\.NEXT_PUBLIC_ANDROID_PACKAGED_GUEST": '"true"'/);
  for(let stage=1;stage<=6;stage++) {
    const s=String(stage).padStart(2,"0");
    assert.ok(existsSync(resolve(root,"public/assets/constellation/stage-"+s+".webp")),"Missing Stage "+stage+" bundled artwork");
  }
  assert.match(packager,/cpSync\(resolve\(root, "public"\), out/);
});

test("Android share uses Capacitor's FileProvider and native share sheet, not browser share",()=>{
  const main=read("mobile/packaged-guest/main.tsx");
  const app=read("components/byeolharu.tsx");
  const growth=read("components/constellation-growth-view.tsx");
  const preview=read("components/starlight-card-preview.tsx");
  const adapter=read("mobile/packaged-guest/native-starlight-share.ts");
  const pkg=JSON.parse(read("mobile/package.json"));
  assert.ok(pkg.dependencies["@capacitor/filesystem"] && pkg.dependencies["@capacitor/share"]);
  assert.match(main,/nativeShare=\{isAndroid \? shareStarlightPngOnAndroid : undefined\}/);
  assert.match(app,/nativeShare=\{nativeShare\}/);
  assert.match(growth,/nativeShare=\{nativeShare\}/);
  assert.match(preview,/if \(nativeShare\)/);
  assert.match(preview,/\.then\(\(png\) => nativeShare\(png, starlightPngFilename\(stage\.stage\)\)\)/);
  assert.match(adapter,/Directory\.Cache/);
  assert.match(adapter,/Filesystem\.writeFile/);
  assert.match(adapter,/Filesystem\.getUri/);
  assert.match(adapter,/Share\.share/);
  assert.doesNotMatch(adapter,/serviceRole|SUPABASE|fetch\(/);
});
