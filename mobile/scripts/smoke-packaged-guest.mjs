/**
 * Catch packaged Android guest-shell startup faults at runtime, not merely
 * whether esbuild emitted a nonempty JS asset. Loads exactly the packaged
 * HTML/CSS/JS via an isolated static origin in headless Chromium.
 */
import { createServer } from "node:http";
import assert from "node:assert/strict";
import { readFileSync, statSync, existsSync, writeFileSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const dir = resolve(fileURLToPath(new URL("../www-packaged-guest/", import.meta.url)));
const mime = { ".js":"application/javascript", ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".svg":"image/svg+xml", ".png":"image/png", ".woff2":"font/woff2", ".webp":"image/webp", ".json":"application/json" };
const errors = [];
const requests = [];
const server = createServer((req,res)=>{
  try {
    const rel = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
    const abs = resolve(dir,"."+rel,rel.endsWith("/")?"index.html":"");
    if (!(abs===dir || abs.startsWith(dir+sep)) || !existsSync(abs) || !statSync(abs).isFile()) {
      requests.push(rel);
      res.writeHead(404).end("Not Found");
      return;
    }
    res.setHeader("Content-Type",mime[extname(abs)]??"application/octet-stream");
    res.end(readFileSync(abs));
  } catch(e) { res.writeHead(500).end(String(e)); }
});
let browser;
try {
  await new Promise(resolveListen=>server.listen(0,"127.0.0.1",resolveListen));
  const port=server.address().port;
  browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:393,height:852}, isMobile:true,hasTouch:true});
  page.on("pageerror",e=>errors.push("JS "+(e.stack??e.message)));
  page.on("console",m=>{if(m.type()==="error")errors.push("console "+m.text());});
  page.on("response",r=>{if(r.status()>=400)requests.push(r.status()+" "+r.url());});
  await page.goto("http://127.0.0.1:"+port+"/",{waitUntil:"domcontentloaded"});
  try {
    await page.locator(".byeolharu").first().waitFor({timeout:12000,state:"attached"});
  } catch(e) {
    await page.screenshot({path:resolve(dir,"startup-failure.png"),fullPage:true});
    const fallback=await page.locator("#byeolharu-root").innerText().catch(()=>"(root missing)");
    throw new Error("Packaged app did not mount after 12s. Root: "+fallback.slice(0,300)+"\nErrors: "+errors.join("\n")+"\nFailed resources: "+requests.join(", "));
  }
  // Native Android now insets the actual WebView viewport. In the browser
  // fallback that viewport has zero inset, so do not add dummy CSS padding.
  const header = await page.evaluate(() => {
    const el = document.querySelector(".site-header");
    const brand = document.querySelector(".site-header .brand");
    const root = document.querySelector(".byeolharu");
    return {
      height: el.getBoundingClientRect().height,
      topPadding: parseFloat(getComputedStyle(el).paddingTop),
      brandTop: brand.getBoundingClientRect().top,
      bottomPadding: parseFloat(getComputedStyle(root).paddingBottom)
    };
  });
  assert.equal(header.height,68,"Packaged Android header uses safe-viewport height");
  assert.equal(header.topPadding,0,"Native inset must not be added again via CSS");
  assert.ok(header.brandTop>=0,"Logo must remain inside the safe WebView viewport");
  assert.ok(header.bottomPadding>=16,"Scroll content needs footer breathing room");

  // Unlike the Next.js website, this APK has no /_next/image server. Ensure
  // the exact local stage artwork loads in the bundled Android WebView.
  await page.getByRole("button",{name:/나의 별자리 STAGE 1/}).click();
  const growthImage=page.getByRole("dialog",{name:"나의 별자리"}).locator("[data-constellation-stage='1'] img").first();
  await growthImage.waitFor({state:"visible",timeout:10000});
  await page.waitForFunction(() => {
    const img=document.querySelector("dialog [data-constellation-stage='1'] img");
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth>0;
  },null,{timeout:15000});
  const src=await growthImage.getAttribute("src");
  assert.equal(new URL(src).pathname,"/assets/constellation/stage-01.webp","Android must use local artwork, not /_next/image");
  await page.getByRole("dialog",{name:"나의 별자리"}).getByRole("button",{name:"별빛 카드 만들기"}).click();
  const shareArt=page.getByRole("dialog",{name:"별빛 카드"}).locator("[data-constellation-stage='1'] img");
  await shareArt.waitFor({state:"visible",timeout:10000});
  await page.waitForFunction(() => {
    const img=document.querySelector(".starlight-share-card [data-constellation-stage='1'] img");
    return img instanceof HTMLImageElement && img.complete && img.naturalWidth>0;
  },null,{timeout:15000});
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog",{name:"별빛 카드"}).waitFor({state:"hidden",timeout:5000});

  // Exercise Android login/signup entry points without submitting credentials.
  await page.getByRole("button",{name:"계정 및 데이터 관리"}).click();
  await page.getByRole("dialog",{name:"내 계정"}).getByRole("button",{name:"로그인",exact:true}).click();
  await page.getByRole("dialog",{name:"로그인"}).getByRole("textbox",{name:"이메일"}).waitFor({state:"visible"});
  await page.getByRole("dialog",{name:"로그인"}).getByRole("button",{name:"회원가입",exact:true}).click();
  const signup=page.getByRole("dialog",{name:"회원가입"});
  await signup.getByRole("button",{name:"이메일로 회원가입"}).waitFor({state:"visible"});
  assert.ok((await signup.innerText()).includes("웹 브라우저에서 인증"));
  await page.keyboard.press("Escape");
  await signup.waitFor({state:"hidden"});

  // Reproduce the user's second screenshot: open the habit editor and scroll
  // to the bottom. The dialog background must be opaque and reach viewport
  // bottom so the underlying routine tabs never show below the actions.
  await page.locator(".add-button").first().click();
  const dialog=page.locator("dialog.modal:has(.habit-editor-form)");
  await dialog.waitFor({state:"visible",timeout:5000});
  // The shared modal has a 180ms translateY entrance animation. A geometry
  // assertion during that animation measures the sheet ~7px below the edge
  // even though it correctly lands flush after animation completion.
  await dialog.evaluate(async el => {
    await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})));
    el.scrollTop=el.scrollHeight;
  });
  const layout=await page.evaluate(() => {
    const sheet=document.querySelector("dialog.modal:has(.habit-editor-form)");
    const footer=sheet.querySelector(".habit-editor-footer");
    const bounds=sheet.getBoundingClientRect();
    const footerBounds=footer.getBoundingClientRect();
    return {
      viewportBottom:window.innerHeight,
      dialogBottom:bounds.bottom,
      footerBottom:footerBounds.bottom,
      sheetBackground:getComputedStyle(sheet).backgroundColor,
      footerBackground:getComputedStyle(footer).backgroundColor,
    };
  });
  assert.ok(Math.abs(layout.viewportBottom-layout.dialogBottom)<2,
    "Habit editor must reach the viewport bottom: "+JSON.stringify(layout));
  assert.ok(layout.footerBottom<=layout.dialogBottom+1,
    "Sticky actions must remain inside the opaque editor sheet: "+JSON.stringify(layout));
  assert.notEqual(layout.sheetBackground,"rgba(0, 0, 0, 0)",
    "Habit editor sheet cannot be transparent");
  assert.notEqual(layout.footerBackground,"rgba(0, 0, 0, 0)",
    "Sticky action footer cannot be transparent");
  if(errors.length)throw new Error("Packaged app runtime exceptions: "+errors.join("\n"));
  console.log("PASS: first-party guest UI mounted from packaged assets, no JS startup errors");
} finally {
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
