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
  // Simulate a Samsung edge-to-edge WebView that injects its native insets
  // as --safe-area-inset-* CSS variables (e.g. 32 px status, 24 px nav).
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-area-inset-top","32px");
    document.documentElement.style.setProperty("--safe-area-inset-bottom","24px");
  });
  const layout = await page.evaluate(() => {
    const header=document.querySelector(".site-header");
    const brand=document.querySelector(".site-header .brand");
    const root=document.querySelector(".byeolharu");
    return {
      height:header.getBoundingClientRect().height,
      brandTop:brand.getBoundingClientRect().top,
      rootBottom:parseFloat(getComputedStyle(root).paddingBottom),
      top:parseFloat(getComputedStyle(header).paddingTop),
    };
  });
  assert.ok(layout.top>=32,"Android status-bar safe-area CSS was not applied: "+JSON.stringify(layout));
  assert.ok(layout.brandTop>=32,"Logo would overlap Android status bar: "+JSON.stringify(layout));
  assert.ok(layout.height>=99,"Header must grow by the system inset: "+JSON.stringify(layout));
  assert.ok(layout.rootBottom>=40,"Last habit must scroll above Android nav bar: "+JSON.stringify(layout));
  if(errors.length)throw new Error("Packaged app runtime exceptions: "+errors.join("\n"));
  console.log("PASS: first-party guest UI mounted from packaged assets, no JS startup errors");
} finally {
  if(browser)await browser.close();
  await new Promise(ok=>server.close(ok));
}
