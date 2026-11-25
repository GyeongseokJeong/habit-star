import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const java = readFileSync(resolve(root, "native/MainActivity.java.template"), "utf8");
const patcher = readFileSync(resolve(root, "scripts/patch-android.mjs"), "utf8");
const config = readFileSync(resolve(root, "capacitor.config.ts"), "utf8");
const settingsJava = readFileSync(resolve(root, "native/ByeolharuDeviceSettingsPlugin.java.template"), "utf8");

assert.match(java, /extends BridgeActivity/);
for (const method of ["onResume", "onPause", "onDestroy"]) {
  assert.match(java, new RegExp(`public void ${method}\\(\\)`), `Capacitor BridgeActivity requires public ${method}`);
}
assert.match(java, /getOnBackPressedDispatcher\(\)/);
assert.match(java, /view\.canGoBack\(\)/);
assert.match(java, /view\.goBack\(\)/);
assert.ok(java.includes("moveTaskToBack(true)"));
assert.match(java, /BACK_EXIT_WINDOW_MS = 2000L/);
assert.ok(java.includes("SystemClock.uptimeMillis()"));
assert.match(java, /lastRootBackAt = 0L/);
assert.ok(java.includes('Toast.makeText(this, "한 번 더 누르면 앱을 종료해요"'));
assert.match(java, /handler\.removeCallbacks\(themeSync\)/);
assert.match(java, /setAppearanceLightStatusBars\(light\)/);
assert.match(java, /setAppearanceLightNavigationBars\(light\)/);
assert.match(java, /getPackageName\(\)\.endsWith\("\.packagedgueststep9"\)/);
assert.match(java, /WindowCompat\.setDecorFitsSystemWindows\(getWindow\(\), false\)/);
assert.match(java, /ViewCompat\.setOnApplyWindowInsetsListener\(content/);
assert.match(java, /WindowInsetsCompat\.Type\.systemBars\(\)/);
assert.match(java, /WindowInsetsCompat\.Type\.displayCutout\(\)/);
assert.match(java, /content\.setPadding\(bars\.left, bars\.top, bars\.right, bars\.bottom\)/);
assert.match(java, /\.setInsets\(types, Insets\.NONE\)/);
assert.match(config, /plugins:\s*\{\s*SystemBars:\s*\{\s*insetsHandling:\s*"disable"/, "Native and CSS insets must not overlap");

assert.match(patcher, /assert\.equal\(\s*targetPackage,/, "Patcher must verify the exact installed package");
assert.match(java, /__GUEST_SETTINGS_PLUGIN_REGISTER__/);
assert.match(patcher, /"registerPlugin\(ByeolharuDeviceSettingsPlugin\.class\);"/);
assert.ok(java.indexOf("__GUEST_SETTINGS_PLUGIN_REGISTER__") < java.indexOf("super.onCreate(state)"),
  "Capacitor plugin registration placeholder must precede bridge initialization");

assert.match(settingsJava, /@CapacitorPlugin\(name = "ByeolharuDeviceSettings"\)/);
assert.match(settingsJava, /Settings\.ACTION_APP_NOTIFICATION_SETTINGS/);
assert.match(settingsJava, /Settings\.EXTRA_APP_PACKAGE/);
assert.match(settingsJava, /getContext\(\)\.getPackageName\(\)/);
assert.match(settingsJava, /call\.resolve\(\)/);
assert.match(patcher, /"io\.github\.gyeongseokjeong\.byeolharu\.packagedgueststep9"/);
assert.match(patcher, /ByeolharuDeviceSettingsPlugin\.java\.template/);


function javaStringConstant(name) {
  const anchor = `private static final String ${name} =`;
  const start = java.indexOf(anchor);
  assert.ok(start >= 0, `Missing ${name}`);
  const lines = java.slice(start + anchor.length).split("\n");
  const pieces = [];
  for (const line of lines) {
    const piece = line.trim();
    if (!piece) continue;
    const last = piece.endsWith(";");
    const quoted = piece.replace(/\s*\+?;?$/, "");
    pieces.push(JSON.parse(quoted));
    if (last) break;
  }
  return pieces.join("");
}

const backScript = javaStringConstant("HANDLE_IN_APP_BACK_JS");
assert.match(java, /view\.evaluateJavascript\(HANDLE_IN_APP_BACK_JS/, "Android must use the in-app navigation dispatcher");
assert.ok(backScript.indexOf("dialog[open]") < backScript.indexOf(".byeolharu.reflection-layout"),
  "A modal over the reflection must close before navigating to the calendar");
const themeScript = javaStringConstant("READ_THEME_JS");

function runBack({ dialog = null, confirmDialog = null, reflection = null, selected = null, interacted = false } = {}) {
  const clicks = [];
  const all = { click: () => clicks.push("all") };
  const guard = { __byeolharuBackInteraction: interacted };
  const document = {
    querySelector: selector => {
      if (selector === ".byeolharu-confirm-dialog[open]") return confirmDialog;
      if (selector === "dialog[open]") return dialog;
      if (selector === ".byeolharu.reflection-layout") return reflection;
      if (selector === "[role=tab][aria-selected=true]") return selected;
      return null;
    },
    getElementById: id => id === "tab-all" ? all : null,
    addEventListener: () => {},
  };
  const result = runInNewContext(backScript, { document, window: guard });
  return { result, clicks, interacted: guard.__byeolharuBackInteraction };
}
assert.equal(runBack().result, "root", "No intermediate screen means the native root-exit guard");
assert.equal(runBack({ interacted: true }).result, "root-changed",
  "Interactions must invalidate the previous exit confirmation");
assert.equal(runBack({ selected: { id: "tab-all" } }).result, "root",
  "All habits is the only root routine tab");
for (const tab of ["tab-morning", "tab-day", "tab-night", "tab-matrix"]) {
  const result = runBack({ selected: { id: tab } });
  assert.equal(result.result, "handled", `Back from ${tab} must return to all habits`);
  assert.deepEqual(result.clicks, ["all"]);
}
const fromReflection = { querySelector: selector => selector === "#weekly-reflection-back"
  ? { click: () => { fromReflection.clicks++; } } : null, clicks: 0 };
assert.equal(runBack({ reflection: fromReflection, selected: { id: "tab-matrix" } }).result, "handled");
assert.equal(fromReflection.clicks, 1);
assert.equal(runBack({ reflection: { querySelector: () => null } }).result, "handled",
  "Never exit when a reflection is open even if its return button is missing");
const dialogClicks = [];
const modal = {
  querySelector: selector => {
    if (selector === "button.modal-back") return { click: () => dialogClicks.push("back") };
    if (selector === ".modal-top button:last-child") return { click: () => dialogClicks.push("close") };
    return null;
  },
};
const keepClicks = [];
const confirmPrompt = {
  querySelector: selector => selector === "[data-confirm-cancel]"
    ? { click: () => keepClicks.push("continue") } : null,
};
assert.equal(runBack({ confirmDialog: confirmPrompt, dialog: modal, reflection: fromReflection }).result, "handled");
assert.deepEqual(keepClicks, ["continue"], "Native Back must dismiss only the top-layer confirmation");
assert.deepEqual(dialogClicks, [], "Underlying editor must not close while its confirmation is open");
assert.equal(runBack({ confirmDialog: { querySelector: () => null }, dialog: modal }).result, "handled",
  "Do not fall through to editor/exit if confirmation controls are briefly missing");
assert.ok(backScript.indexOf(".byeolharu-confirm-dialog[open]") < backScript.indexOf("dialog[open]"),
  "Shared confirmation always takes priority over the underlying page");
assert.equal(runBack({ dialog: modal, reflection: fromReflection }).result, "handled");
assert.deepEqual(dialogClicks, ["back"], "Account detail must return to its parent first");
assert.equal(fromReflection.clicks, 1, "Dialog takes priority over reflection");
assert.equal(runBack({ dialog: { querySelector: selector => selector === ".modal-top button:last-child"
  ? { click: () => dialogClicks.push("close") } : null } }).result, "handled");
assert.deepEqual(dialogClicks, ["back", "close"]);
assert.equal(runBack({ dialog: { querySelector: () => null } }).result, "handled",
  "Missing modal controls must never fall through to exit");
assert.ok(backScript.indexOf("dialog[open]") < backScript.indexOf(".byeolharu.reflection-layout"));
assert.ok(backScript.indexOf(".byeolharu.reflection-layout") < backScript.indexOf("[role=tab][aria-selected=true]"));
assert.ok(java.indexOf("if (view.canGoBack())") < java.indexOf("handleRootBack();", java.indexOf("if (view.canGoBack())")),
  "WebView history must be resolved before the root double-back guard");
assert.ok(java.includes(String.raw`if ("\"handled\"".equals(result))`));
assert.ok(java.includes("void handleRootBack()"));
assert.ok(/lastRootBackAt = 0L;\s*foreground = false;/.test(java));

function runTheme(value) {
  return runInNewContext(themeScript, {
    document: {
      querySelector: () => value === null ? null : { classList: { contains: () => value === "dark" } },
      documentElement: { dataset: { byeolharuTheme: value === "dark" ? "dark" : "" } },
    },
  });
}
assert.equal(runTheme("dark"), "dark");
assert.equal(runTheme("light"), "light");
assert.equal(runTheme(null), "unknown");
console.log("Native back: dialog > reflection > routine tab > history > 2-second root exit, theme OK (not a device test)");

const widget = readFileSync(resolve(root, "native/widgets/ByeolharuWidgetProvider.java.template"), "utf8");
const configActivity = readFileSync(resolve(root,"native/widgets/ByeolharuWidgetConfigActivity.java.template"),"utf8");
assert.match(settingsJava, /publishWidgetSummary/);
assert.match(patcher, /ByeolharuWidgetProvider/);
assert.match(patcher, /android:permission="android.permission.BIND_REMOTEVIEWS"/);
assert.match(widget, /FLAG_IMMUTABLE/);
assert.match(widget, /setOnClickPendingIntent\(R.id.widget_home,/);
assert.match(widget, /expiry > now/);
assert.match(widget, /getNoBackupFilesDir/);
assert.match(widget, /anyConfigured\(c\)/);
assert.match(configActivity, /consent.isChecked\(\)/);
assert.match(configActivity, /existing=prefs.contains\(id\+":consent"\)/);
assert.match(configActivity, /save.setEnabled\(existing \|\| consent.isChecked\(\)\)/);
assert.match(configActivity, /save.setEnabled\(existing \|\| checked\)/);
assert.match(configActivity, /saveOptions\(this,id,consent.isChecked\(\)/);
assert.match(widget, /putBoolean\(id\+":consent",consent\)/);
assert.match(widget, /if \(!anyConfigured\(c\)\) \{ clear\(c\); return null; \}/);
assert.match(widget, /setViewVisibility\(R.id.widget_content,ready\?View.VISIBLE:View.GONE\)/);
assert.match(widget, /setViewVisibility\(R.id.widget_private,ready\?View.GONE:View.VISIBLE\)/);
const widgetService = readFileSync(resolve(root,"native/widgets/ByeolharuWidgetListService.java.template"),"utf8");
assert.match(widgetService, /if\(!ByeolharuWidgetProvider.configured\(c,id\)\|\|position/);
assert.doesNotMatch(widget, /habitId|memberId|memo|userId|authToken/);
for(const [kind,height] of [["mini",2],["compact",3]]){
 const info=readFileSync(resolve(root,`native/widgets/xml/byeolharu_widget_${kind}_info.xml`),"utf8");
 assert.ok(info.includes('android:targetCellWidth="2"'));
 assert.ok(info.includes(`android:targetCellHeight="${height}"`));
 assert.match(info,/ByeolharuWidgetConfigActivity/);
}
for(const theme of ["dark","light"]){
 const layout=readFileSync(resolve(root,`native/widgets/layout/byeolharu_widget_${theme}.xml`),"utf8");
 assert.match(layout,/widget_list/);
 assert.match(layout,/widget_count/);
 assert.match(layout,/widget_content" android:visibility="gone"/);
 assert.match(layout,/widget_private/);
 const header=layout.match(/<LinearLayout\b[^>]*android:id="@\+id\/widget_header"[^>]*>/)?.[0];
 assert.ok(header, theme+" widget header missing");
 const height=Number(header.match(/android:layout_height="(\d+)dp"/)?.[1]);
 assert.equal(height,48, theme+" V12 header must be 48dp");
 assert.match(header,/android:layout_width="match_parent"/);
 assert.match(layout,/android:paddingStart="6dp" android:paddingEnd="8dp" android:paddingTop="4dp" android:paddingBottom="4dp"/);
}
console.log("Compact widget layout, configuration and privacy source contracts OK (not a launcher test)");

// Warm practice is debug-only and never launches an Activity or rewrites cache on tap.
assert.match(widget,/ApplicationInfo.FLAG_DEBUGGABLE/);
assert.match(widget,/setPendingIntentTemplate\(R.id.widget_list/);
assert.match(widget,/new Intent\(c,Mini.class\).setAction\(PRACTICE\)/);
assert.match(widget,/currentKey\(c,request.widget,request.key\)/);
assert.match(widget,/request.broadcast.finish\(\)/);
assert.match(settingsJava,/hasListeners\("widgetPracticeRequest"\)/);
assert.match(widgetService,/setOnClickFillInIntent\(R.id.widget_check/);
const actionRow=readFileSync(resolve(root,"native/widgets/layout/byeolharu_widget_row_action.xml"),"utf8");
assert.match(actionRow,/widget_check" android:layout_width="48dp" android:layout_height="48dp"/);

// V6: one theme contract for parent and row adapter; no independent night lookup.
assert.match(widget,/setColorStateList\(R.id.widget_root,"setBackgroundTintList"/);
assert.match(widget,/v.setColorInt\(id,"setTextColor"/);
assert.match(widget,/v.setIcon\(id,"setImageIcon"/);
assert.match(widget,/putExtra\("renderTheme",theme\)/);
assert.match(widgetService,/getStringExtra\("renderTheme"\)/);
assert.doesNotMatch(widgetService,/ByeolharuWidgetProvider.dark\(c,id\)/);
assert.doesNotMatch(widgetService,/setTextViewText\(R.id.widget_check/);
assert.match(patcher,/android:name="\.ByeolharuWidgetApplication"/);
const appTemplate=readFileSync(resolve(root,"native/widgets/ByeolharuWidgetApplication.java.template"),"utf8");
assert.match(appTemplate,/onConfigurationChanged\(Configuration config\)/);
assert.match(appTemplate,/ByeolharuWidgetProvider.refreshAll\(this\)/);
for(const theme of ["dark","light"])for(const state of ["check","circle"]){
 const icon=readFileSync(resolve(root,`native/widgets/drawable/byeolharu_widget_${state}_${theme}.xml`),"utf8");
 assert.match(icon,/android:width="22dp" android:height="22dp"/);
 assert.match(icon,/<path /);
}
assert.match(actionRow,/<ImageView android:id="@\+id\/widget_check"/);


// Host reapply: fixed modes must also emit all themed actions. Exercise the
// exact pure Java selection expression (also valid JS after equals mapping).
const themeExpression=widget.match(/static <T> T themeValue\([^)]*\) \{\s*return ([^;]+);/)?.[1];
assert.ok(themeExpression);
const expression=themeExpression.replace(/"([^"]+)"\.equals\(theme\)/g,'theme === "$1"');
for(const [theme,night,expected] of [
 ["system",false,"L"],["system",true,"D"],
 ["light",false,"L"],["light",true,"L"],
 ["dark",false,"D"],["dark",true,"D"],
]){
 assert.equal(runInNewContext(expression,{theme,night,light:"L",dark:"D"}),expected);
}
const render=widget.slice(widget.indexOf("static void render(Context"));
assert.match(render,/if \(Build.VERSION.SDK_INT>=31\) \{\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*v.setColorStateList\(R.id.widget_root/);
assert.match(render,/themeValue\(theme,false,"#FFFCF7","#1C2233"\)/);
assert.match(render,/themeValue\(theme,true,"#FFFCF7","#1C2233"\)/);
assert.match(render,/\}\s*homeIcon\(c,v,theme\)/);
for(const id of ["label","count","empty","private"])
 assert.ok(render.includes("textColor(v,R.id.widget_"+id+",theme,"));
assert.doesNotMatch(widget,/if \("system"\.equals\(theme\)&&Build.VERSION.SDK_INT>=31\)/);

// V6-2: native direct choice, draft-only synthetic preview, system chrome.
assert.doesNotMatch(configActivity,/\bSpinner\b/);
assert.match(configActivity,/RadioGroup/);
assert.match(configActivity,/new Switch\(this\)/);
assert.match(configActivity,/미리보기 · 예시 습관/);
assert.match(configActivity,/onSaveInstanceState/);
assert.match(configActivity,/setStatusBarColor/);
assert.match(configActivity,/setNavigationBarColor/);
assert.match(configActivity,/FILTERS\[filterIndex\],hide.isChecked\(\),THEMES\[themeIndex\]/);
assert.equal((configActivity.match(/ByeolharuWidgetProvider.saveOptions\(/g)||[]).length,1);


// API 24/25 cannot use dark navigation icons. The palette and icon flag
// must share the same condition; status bar remains independent.
const navExpr=configActivity.match(/boolean lightNavigation=([^;]+);/)?.[1];
assert.ok(navExpr);
for(const sdk of [24,25,26,35]){
 for(const night of [false,true]){
  assert.equal(runInNewContext(navExpr.replace("android.os.Build.VERSION.SDK_INT","sdk"),{sdk,night}),!night&&sdk>=26);
 }
}
assert.match(configActivity,/setNavigationBarColor\(lightNavigation\?bg:color\("#171D29"\)\)/);
assert.match(configActivity,/if\(lightNavigation\)flags\|=View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR/);
assert.match(configActivity,/setStatusBarColor\(bg\)/);


// P2 accessibility: custom interactive controls must retain visible
// enabled focus and press states; the ordinary drawable is the last fallback.
const controlBg=configActivity.slice(configActivity.indexOf("private StateListDrawable controlBackground"),configActivity.indexOf("private TextView text"));
assert.match(controlBg,/focused.setStroke\(dp\(3\),focusColor\)/);
assert.match(controlBg,/states.addState\(new int\[\]\{android.R.attr.state_enabled,android.R.attr.state_focused\},focused\)/);
assert.match(controlBg,/states.addState\(new int\[\]\{android.R.attr.state_enabled,android.R.attr.state_pressed\},pressed\)/);
assert.ok(controlBg.indexOf("state_focused")<controlBg.indexOf("state_pressed"));
assert.ok(controlBg.indexOf("state_pressed")<controlBg.indexOf("new int[]{},shape"));
for(const control of ["back","control","save"]){
 assert.ok(configActivity.includes(control+".setBackgroundTintList(null);"+control+".setBackground(controlBackground("),control+" missing explicit focus styling");
}
assert.match(configActivity,/save.setBackground\(controlBackground\(accent\(\),0,14,color\(night\?"#302D38":"#FFFFFF"\)\)\)/);


// V11 adaptive widgets: preserve both provider identities and initial cells;
// the host measures one flexible layout, no assumed cell-to-dp conversion.
for(const [kind,initialHeight] of [["mini",2],["compact",3]]){
 const info=readFileSync(resolve(root,"native/widgets/xml/byeolharu_widget_"+kind+"_info.xml"),"utf8");
 assert.match(info,/android:resizeMode="horizontal\|vertical"/);
 assert.match(info,/android:minResizeWidth="110dp"/);
 assert.match(info,/android:minResizeHeight="110dp"/);
 assert.ok(info.includes('android:targetCellHeight="'+initialHeight+'"'));
}
const resizeHandler=widget.slice(widget.indexOf("public void onAppWidgetOptionsChanged"),widget.indexOf("@Override public void onDeleted"));
assert.match(resizeHandler,/synchronized \(ByeolharuWidgetProvider.class\)/);
assert.match(resizeHandler,/if \(owns\(c,id\)\) render\(c,id,read\(c\)\)/);
assert.doesNotMatch(resizeHandler,/refreshAll|saveOptions|\.edit\(|publish\(|\.clear\(|schedule\(/);
assert.match(widget,/new ComponentName\(c, Mini.class\)/);
assert.match(widget,/new ComponentName\(c, Compact.class\)/);
for(const theme of ["dark","light"]){
 const layout=readFileSync(resolve(root,"native/widgets/layout/byeolharu_widget_"+theme+".xml"),"utf8");
 assert.match(layout,/widget_content" android:visibility="gone" android:layout_width="match_parent" android:layout_height="0dp" android:layout_weight="1"/);
 assert.match(layout,/widget_list" android:layout_width="match_parent" android:layout_height="match_parent"/);
 assert.match(layout,/android:requiresFadingEdge="vertical" android:fadingEdgeLength="6dp"/);
}
for(const kind of ["row","row_action"]){
 const xml=readFileSync(resolve(root,"native/widgets/layout/byeolharu_widget_"+kind+".xml"),"utf8");
 assert.match(xml,/<LinearLayout[^>]*android:layout_height="wrap_content" android:minHeight="48dp"/);
 assert.match(xml,/widget_title"[^>]*android:layout_weight="1"[^>]*android:textSize="14sp" android:maxLines="2" android:ellipsize="end"/);
 assert.match(xml,/widget_check" android:layout_width="(?:28|48)dp" android:layout_height="48dp"/);
}
assert.match(widgetService,/public int getCount\(\)\{return ByeolharuWidgetProvider.configured\(c,id\)\?rows.size\(\):0;\}/);
console.log("V11 adaptive resize and row source contracts OK (not a launcher test)");


// V11-2: preview dimensions come from host options with metadata fallback.
// Execute the pure sizing expressions rather than mocking a launcher.
const previewScaleExpr=configActivity.match(/static float previewScaleFor\([^)]*\)\{\s*return ([^;]+);/)?.[1];
assert.ok(previewScaleExpr);
for(const [width,height,maxWidth,expected] of [[110,110,220,1],[220,110,220,1],[110,400,220,0.5],[440,220,220,0.5],[220,220,160,160/220]]){
 assert.ok(Math.abs(runInNewContext(previewScaleExpr.replace(/(\d+)f/g,"$1").replaceAll("Math.min","Math.min"),{width,height,maxWidth})-expected)<0.00001);
}
const rowCapacityExpr=configActivity.match(/static int previewRowCapacity\([^)]*\)\{\s*return ([^;]+);/)?.[1];
assert.ok(rowCapacityExpr);
for(const [height,expected] of [[48,0],[110,1],[155,1],[156,2],[204,3],[300,5]]){
 assert.equal(runInNewContext(rowCapacityExpr.replace(/\(int\)/,"Math.trunc").replace("Math.trunc(","Math.trunc(").replace(/(\d+)f/g,"$1"),{height}),expected);
}
assert.match(configActivity,/getAppWidgetOptions\(id\)/);
assert.match(configActivity,/OPTION_APPWIDGET_SIZES/);
assert.match(configActivity,/OPTION_APPWIDGET_MIN_WIDTH/);
assert.match(configActivity,/info.minWidth\/density/);
assert.match(configActivity,/if\(Build.VERSION.SDK_INT>=31\)/);
assert.match(configActivity,/root.addView\(preview\);sizePreview\(id\)/);
const samplePreview=configActivity.slice(configActivity.indexOf("private void refreshPreview"),configActivity.indexOf("private void updateApplyHint"));
assert.doesNotMatch(samplePreview,/ByeolharuWidgetProvider.read|cache\(|consent.isChecked\(\)|saveOptions\(/);
assert.match(samplePreview,/ByeolharuWidgetProvider.group\(null\)/);
assert.match(samplePreview,/case "morning"/);
assert.match(samplePreview,/case "day"/);
assert.match(samplePreview,/case "night"/);
assert.match(samplePreview,/shown<previewRows/);
assert.match(samplePreview,/if\(i==0&&hide.isChecked\(\)\)continue/);
assert.match(samplePreview,/기기 시간 기준/);
assert.match(configActivity,/b.setButtonDrawable\(\(Drawable\)null\)/);
assert.match(configActivity,/b.setBackground\(choiceBackground\(\)\)/);
assert.match(configActivity,/b.setText\(\(b.isChecked\(\)\?"✓ ":""\)\+label\)/);
assert.match(configActivity,/checked,android.R.attr.state_focused/);
assert.match(configActivity,/checked,android.R.attr.state_pressed/);
assert.match(configActivity,/states.addState\(new int\[\]\{checked\},shape\(fill,0,12\)\)/);
assert.match(configActivity,/space\(root,8\);\s*RadioGroup second/);
assert.match(configActivity,/표시 동의 후 위젯을 추가할 수 있어요/);
assert.match(configActivity,/적용하면 홈 화면의 습관이 숨겨집니다/);
assert.match(configActivity,/if\(!ByeolharuWidgetProvider.owns\(this,id\)\|\|\(!existing && !consent.isChecked\(\)\)\)return/);
for(const theme of ["system","light","dark"]){
 const icon=readFileSync(resolve(root,"native/widgets/drawable/byeolharu_widget_theme_"+theme+".xml"),"utf8");
 assert.match(icon,/android:width="22dp" android:height="22dp"/);
}
console.log("V11 settings selection, synthetic preview and consent source contracts OK (not a device test)");


// V11 icon preference: old instances default to visible; per-ID storage,
// adapter identity, explicit recycled row visibility and draft-only preview.
assert.match(widget,/static boolean showHabitIcons\(Context c,int id\) \{ return options\(c\).getBoolean\(id\+":showIcons",true\); \}/);
assert.match(widget,/\.putBoolean\(id\+":showIcons",showIcons\)\.commit\(\)/);
assert.match(widget,/new String\[\]\{":consent",":filter",":hide",":theme",":showIcons"\}/);
assert.match(render,/boolean showIcons=showHabitIcons\(c,id\)/);
assert.match(render,/putExtra\("showIcons",showIcons\)/);
assert.match(render,/\(showIcons\?"icons":"text"\)/);
assert.match(widgetService,/getBooleanExtra\("showIcons",ByeolharuWidgetProvider.showHabitIcons\(c,id\)\)/);
assert.match(widgetService,/setViewVisibility\(R.id.widget_icon,showIcons\?View.VISIBLE:View.GONE\)/);
assert.match(widgetService,/setTextViewText\(R.id.widget_icon,showIcons\?row.optString\("icon"\):""\)/);
assert.match(configActivity,/section\(root,"습관 표시"\)/);
assert.match(configActivity,/hide=displaySwitch\("완료한 습관 숨기기"/);
assert.match(configActivity,/showIcons=displaySwitch\("습관 아이콘 표시",saved==null\?ByeolharuWidgetProvider.showHabitIcons\(this,id\):saved.getBoolean\("showIcons",true\)\)/);
assert.match(configActivity,/displayOptions.addView\(hide\)/);
assert.match(configActivity,/displayOptions.addView\(showIcons\)/);
assert.match(configActivity,/out.putBoolean\("showIcons",showIcons.isChecked\(\)\)/);
assert.match(configActivity,/showIcons.setOnCheckedChangeListener\(\(b,checked\)->refreshPreview\(\)\)/);
assert.match(configActivity,/saveOptions\(this,id,consent.isChecked\(\),FILTERS\[filterIndex\],hide.isChecked\(\),THEMES\[themeIndex\],showIcons.isChecked\(\)\)/);
assert.match(samplePreview,/if\(showIcons.isChecked\(\)\)\{\s*TextView habitIcon=previewText\(samples\[i\]\[0\]/);
assert.match(samplePreview,/TextView name=previewText\(samples\[i\]\[1\]/);
assert.match(samplePreview,/header.addView\(home,new LinearLayout.LayoutParams\(scaled\(44\),scaled\(48\)\)\)/);
assert.match(samplePreview,/row.addView\(icon,new LinearLayout.LayoutParams\(scaled\(22\),scaled\(22\)\)\)/);
assert.doesNotMatch(samplePreview,/prefs\.edit|\.commit\(/);
for(const kind of ["row","row_action"]){
 const xml=readFileSync(resolve(root,"native/widgets/layout/byeolharu_widget_"+kind+".xml"),"utf8");
 assert.match(xml,/widget_icon" android:layout_width="20dp"/);
 assert.match(xml,/widget_title" android:layout_width="0dp"[^>]*android:layout_weight="1" android:layout_marginStart="3dp"/);
}
console.log("V11 icon preference, adapter refresh, draft and preview source contracts OK (not a launcher test)");


// Cold runtime capability experiment: synthetic marker only. No production
// activation, background record writes, auth copies or new permissions.
const probeJava=readFileSync(resolve(root,"native/widgets/ByeolharuWidgetRuntimeProbe.java.template"),"utf8");
const probeHtml=readFileSync(resolve(root,"native/widgets/widget-runtime-probe.html"),"utf8");
const probeSeed=readFileSync(resolve(root,"packaged-guest/widget-runtime-probe.ts"),"utf8");
const guestMain=readFileSync(resolve(root,"packaged-guest/main.tsx"),"utf8");
assert.match(patcher,/"ByeolharuWidgetRuntimeProbe"/);
assert.match(patcher,/copyFileSync\(join\(widgetNative, "widget-runtime-probe.html"\)/);
assert.match(guestMain,/if \(experimentalWidgetPractice\) void seedWidgetRuntimeProbe\(window.location.origin\)/);
assert.match(settingsJava,/static boolean hasWidgetActivity\(\)/);
assert.match(widget,/if\(ByeolharuDeviceSettingsPlugin.dispatchWidgetPractice\(payload\)\) return/);
assert.match(widget,/if\(!ByeolharuWidgetColdPractice.hasActivity\(\) && claim\(c,payload\)\)\s*ByeolharuWidgetColdPractice.start/);
assert.match(probeJava,/!ByeolharuWidgetProvider.experimental\(context\)/);
assert.match(probeJava,/setBlockNetworkLoads\(true\)/);
assert.match(probeJava,/setAllowFileAccess\(false\)/);
assert.match(probeJava,/setAllowContentAccess\(false\)/);
assert.match(probeJava,/loadDataWithBaseURL\(ORIGIN,html/);
assert.match(probeJava,/Math.min\(6000L,deadline-System.currentTimeMillis\(\)-300L\)/);
assert.match(probeJava,/handler.removeCallbacks\(timeout\);handler.removeCallbacks\(poll\)/);
assert.match(probeJava,/old.destroy\(\)/);
assert.doesNotMatch(probeJava,/addJavascriptInterface|startActivity\(|startService\(|publishWidgetSummary|applyWidgetPractice/);
assert.match(probeHtml,/connect-src 'none'/);
assert.match(probeHtml,/transaction\("markers", "readonly"\)/);
assert.match(probeHtml,/request.transaction.abort\(\)/);
assert.doesNotMatch(probeHtml,/localStorage|sessionStorage|byeolharu-v2|supabase|\.put\(|\.delete\(/);
assert.doesNotMatch(probeSeed,/localStorage|sessionStorage|byeolharu-v2|supabase/);
console.log("Cold runtime synthetic storage probe source contracts OK (not an Android runtime test)");


// Cold direct practice remains debug-only; one request-scoped boolean bridge,
// existing transaction, no network, no auth/record data passed to native.
const coldJava=readFileSync(resolve(root,"native/widgets/ByeolharuWidgetColdPractice.java.template"),"utf8");
const coldTs=readFileSync(resolve(root,"packaged-guest/widget-cold-practice.ts"),"utf8");
const coldBuild=readFileSync(resolve(root,"scripts/build-packaged-guest.mjs"),"utf8");
assert.match(patcher,/"ByeolharuWidgetColdPractice"/);
assert.match(java,/ByeolharuWidgetColdPractice.activityStarted\(\)/);
assert.match(java,/ByeolharuWidgetColdPractice.activityStopped\(\)/);
assert.match(widget,/static synchronized boolean coldAllowed/);
assert.match(widget,/request.claimed && request.requestId.equals\(requestId\)/);
assert.match(widget,/!ByeolharuWidgetColdPractice.hasActivity\(\)/);
assert.match(widget,/currentKey\(c,request.widget,request.key\)/);
assert.match(widget,/if\("saved".equals\(status\)\)/);
assert.match(coldJava,/!ByeolharuWidgetProvider.experimental\(c\)/);
assert.match(coldJava,/setBlockNetworkLoads\(true\)/);
assert.match(coldJava,/setAllowFileAccess\(false\)/);
assert.match(coldJava,/setAllowContentAccess\(false\)/);
assert.match(coldJava,/public\/widget-cold-runtime.js/);
assert.equal((coldJava.match(/@JavascriptInterface/g)||[]).length,1);
assert.match(coldJava,/@JavascriptInterface public boolean allowed\(\)/);
assert.match(coldJava,/removeJavascriptInterface\("ByeolharuColdGate"\);old.destroy\(\)/);
assert.doesNotMatch(coldJava,/startActivity\(|startService\(/);
assert.match(coldBuild,/if \(process.env.BYEOLHARU_ANDROID_RELEASE !== "1"\) \{\s*await build/);
assert.match(coldTs,/repo.applyWidgetPractice\(command, allowed\)/);
assert.doesNotMatch(coldTs,/repo\.initialize\(|repo\.ensureDay\(|supabase\(|fetch\(/);
console.log("Debug cold practice source contracts OK (not an Android runtime test)");


// V12 row-wide practice, explicit home, legacy navigation invalidation.
assert.match(widget,/if\(intent.hasExtra\("detailKey"\)\)return/);
assert.doesNotMatch(widget,/openDetail\(|takeDetail\(|startActivity\(/);
assert.doesNotMatch(settingsJava,/takeWidgetDetail/);
assert.doesNotMatch(guestMain,/pendingWidgetDetail|resolveWidgetDetailKey|source:"widget"/);
assert.match(widget,/setOnClickPendingIntent\(R.id.widget_home,PendingIntent.getActivity/);
assert.doesNotMatch(widget,/setOnClickPendingIntent\(R.id.widget_(header|label|count|empty|private),/);
assert.match(widget,/getBooleanExtra\("editInApp",false\)/);
assert.match(widget,/configured\(c,id\)&&key==null/);
assert.match(widget,/세부 기록은 앱에서 수정할 수 있어요/);
for(const id of ["row","icon","title","check"])
  assert.ok(widgetService.includes("setOnClickFillInIntent(R.id.widget_"+id+",tap)"));
assert.match(widgetService,/Intent tap=actionable\?new Intent\(\).putExtra\("actionKey",key\):new Intent\(\).putExtra\("editInApp",true\)/);
assert.match(widgetService,/getViewTypeCount\(\)\{return 4;\}/);
assert.match(widgetService,/OPTION_APPWIDGET_MIN_HEIGHT/);
assert.match(widgetService,/sparseRows\(height,rows.size\(\)\)/);
assert.match(widget,/\/v12\//);
const sparseExpr=widget.match(/static boolean sparseRows\([^)]*\) \{\s*return ([^;]+);/)?.[1];
assert.ok(sparseExpr);
for(const [minHeight,count,expected] of [[0,1,false],[110,1,false],[119,1,false],[120,1,true],[179,2,false],[180,2,true],[500,2,true],[500,3,false],[500,0,false]])
  assert.equal(runInNewContext(sparseExpr,{minHeight,count}),expected);
for(const theme of ["light","dark"]){
  const xml=readFileSync(resolve(root,"native/widgets/layout/byeolharu_widget_"+theme+".xml"),"utf8");
  assert.match(xml,/widget_home" android:layout_width="44dp" android:layout_height="48dp"/);
  assert.match(xml,/android:contentDescription="별하루 앱 열기"/);
  const home=readFileSync(resolve(root,"native/widgets/drawable/byeolharu_widget_home_"+theme+".xml"),"utf8");
  assert.match(home,/android:width="22dp" android:height="22dp"/);
}
for(const kind of ["row","row_action"]){
  const normal=readFileSync(resolve(root,"native/widgets/layout/byeolharu_widget_"+kind+".xml"),"utf8");
  const sparse=readFileSync(resolve(root,"native/widgets/layout/byeolharu_widget_"+kind+"_sparse.xml"),"utf8");
  assert.equal(sparse,normal.replace('android:minHeight="48dp"','android:minHeight="60dp"'));
  assert.match(normal,/android:id="@\+id\/widget_row"/);
}
assert.match(samplePreview,/ByeolharuWidgetProvider.sparseRows\(previewMinHeight,visibleCount\)\?60:48/);
console.log("V12 quick practice, home and sparse row source contracts OK (not a launcher test)");
