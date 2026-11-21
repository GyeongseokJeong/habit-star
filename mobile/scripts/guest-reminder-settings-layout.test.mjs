import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=resolve(import.meta.dirname,"../..");
const ui=readFileSync(resolve(root,"components/account/account-panel.tsx"),"utf8");
const nativeCss=readFileSync(resolve(root,"mobile/packaged-guest/safe-area.css"),"utf8");
const web=readFileSync(resolve(root,"app/page.tsx"),"utf8");

test("native reminder inspection and repair are collapsed behind an accessible details control",()=>{
 assert.match(ui,/<details className="android-reminder-details">/);
 assert.match(ui,/<summary>알림 문제 해결/);
 const start=ui.indexOf('<details className="android-reminder-details">');
 const end=ui.indexOf("</details>",start);
 assert.ok(start>=0 && end>start);
 const section=ui.slice(start,end);
 assert.match(section,/onInspectPending/);
 assert.match(section,/onAuditPending/);
 assert.match(section,/nativeReminders\.repairAvailable &&/);
 assert.match(section,/onRepairPending/);
 assert.match(section,/nativeReminders\.diagnostic/);
 assert.match(section,/nativeReminders\.auditStatus/);
 assert.match(section,/nativeReminders\.repairStatus/);
 // Advanced native diagnostics stay closed by default.
 assert.doesNotMatch(section,/<details[^>]*\sopen(?:\s|=|>)/);
});
test("settings omit the global alarm toggle and keep diagnostics collapsed",()=>{
 const start=ui.indexOf('<details className="android-reminder-details">');
 assert.ok(start>=0);
 assert.doesNotMatch(ui,/aria-label="습관 알림"/);
 assert.doesNotMatch(ui,/onEnabledChange\(!nativeReminders\.active\)/);
 assert.match(ui,/nativeReminders\.permissionState === "denied"/);
 assert.match(ui,/<summary>알림 문제 해결/);
 assert.doesNotMatch(web,/android-reminder-details|onInspectPending/);
});
test("packaged-only CSS keeps advanced diagnostics readable and tappable",()=>{
 assert.match(nativeCss,/\.android-reminder-details > summary/);
 assert.match(nativeCss,/min-height: 48px/);
 assert.match(nativeCss,/\.android-reminder-detail-actions > button/);
 assert.match(nativeCss,/min-height: 44px/);
});
