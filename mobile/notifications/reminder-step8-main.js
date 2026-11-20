import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { createReminderLifecycle } from "./reminder-lifecycle.js";
import { localDayKey } from "./reminder-plan.js";

const native = Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
const status = document.querySelector("#status");
const summary = document.querySelector("#summary");
const actions = [...document.querySelectorAll("button")];
const time = document.querySelector("#time");
const days = document.querySelector("#weekdays");
const enabled = document.querySelector("#habitEnabled");
const labels = ["일", "월", "화", "수", "목", "금", "토"];
let busy = false;
let optIn = false;
let completed = false;
let selectedDays = [0,1,2,3,4,5,6];
const lifecycle = native ? createReminderLifecycle({ localNotifications: LocalNotifications }) : null;
const demoScope = { kind: "guest", verified: true };

// No personal data, token, IndexedDB, login, localStorage or network requests.
const nowClock = () => {
  const at = new Date(Date.now() + 4*60_000);
  return [String(at.getHours()).padStart(2,"0"),String(at.getMinutes()).padStart(2,"0")].join(":");
};
time.value = nowClock();

function show(message) { status.textContent = message; }
function setSummary(message) { summary.textContent = message; }
function renderDays() {
  days.replaceChildren();
  labels.forEach((name,index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    button.textContent = name;
    button.setAttribute("aria-pressed",String(selectedDays.includes(index)));
    button.setAttribute("aria-label",name+"요일");
    button.addEventListener("click", () => {
      // Never allow a zero-day reminder; requires a clear selection.
      if(selectedDays.length===1 && selectedDays[0]===index) {
        show("최소 한 요일을 선택해주세요.");
        return;
      }
      selectedDays = selectedDays.includes(index)
        ? selectedDays.filter(i=>i!==index)
        : [...selectedDays,index].sort((a,b)=>a-b);
      renderDays();
      void execute(async () => { if(optIn) await syncNow(); });
    });
    days.appendChild(button);
  });
}
function currentSnapshot() {
  return {
    day: localDayKey(new Date()),
    habits: [{
      id:"step8-water-habit", title:"물 마시기", icon:"💧", timeGroup:"morning",
      scheduledTime:time.value || undefined, repeatDays:[...selectedDays],
      alarmEnabled: enabled.checked, completed, rating:completed?3:0, memo:"",
    }],
  };
}
function context() {
  return {identity:demoScope,optIn,snapshot:currentSnapshot()};
}
async function syncNow() {
  const result=await lifecycle.sync(context());
  show({
    updated:"알림 예약을 새 설정에 맞춰 갱신했어요.",
    unchanged:"예약 변경 사항이 없어요.",
    disabled:"별하루 데모 알림을 모두 껐어요.",
    "permission-required":"알림 권한이 필요해요. 권한 버튼을 눌러주세요.",
    "snapshot-not-ready":"오늘 습관 데이터가 아직 준비되지 않았어요.",
    superseded:"최신 습관 상태를 다시 적용합니다.",
  }[result.status] ?? result.status);
  if (result.truncated) show("예약 수 상한(48건)에 도달했습니다.");
  setSummary("현재 상태: "+(optIn?"사용":"끔")+
    " · 오늘 실천 "+(completed?"완료":"예정")+
    " · 반복 "+selectedDays.map(d=>labels[d]).join(" "));
}
async function execute(task) {
  if(!native || busy) return;
  busy=true; actions.forEach(b=>b.disabled=true);
  try { await task(); }
  catch(err){ show("알림 적용 실패: "+(err instanceof Error?err.message:String(err))); }
  finally{ busy=false; actions.forEach(b=>b.disabled=false); }
}
document.querySelector("#permission").addEventListener("click",()=>execute(async()=>{
  const result=await LocalNotifications.requestPermissions();
  show("알림 권한: "+result.display);
}));
document.querySelector("#activate").addEventListener("click",()=>execute(async()=>{
  if(!time.value){show("알림 시간을 선택해주세요.");return;}
  const permission=await LocalNotifications.checkPermissions();
  if(permission.display!=="granted"){show("알림 권한을 먼저 허용해주세요.");return;}
  optIn=true;
  await syncNow();
}));
document.querySelector("#completed").addEventListener("click",()=>execute(async()=>{
  completed=true; if(optIn) await syncNow();
  else show("오늘 습관을 완료했습니다. 알림은 꺼져 있습니다.");
}));
document.querySelector("#undo").addEventListener("click",()=>execute(async()=>{
  completed=false; if(optIn) await syncNow();
  else show("오늘 습관을 다시 미완료로 표시했습니다.");
}));
document.querySelector("#pending").addEventListener("click",()=>execute(async()=>{
  const { notifications } = await LocalNotifications.getPending();
  const ours=notifications.filter(n=>n.extra?.kind==="byeolharu-habit-reminder-v1"&&n.extra?.scope==="guest");
  show("데모 알림 "+ours.length+"건이 예약되어 있어요.");
}));
document.querySelector("#disable").addEventListener("click",()=>execute(async()=>{
  optIn=false; await lifecycle.disable();
  show("알림을 껐어요. 데모 습관은 유지됩니다.");
}));
time.addEventListener("change",()=>execute(async()=>{if(optIn)await syncNow();}));
enabled.addEventListener("change",()=>execute(async()=>{if(optIn)await syncNow();}));
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible"&&optIn) void execute(()=>lifecycle.onForeground(context()).then(result=>{
    show("앱 복귀 후 알림 상태: "+result.status);
  }));
});
renderDays();
if(!native) {
  show("Android 테스트 APK에서만 실행할 수 있어요.");
  actions.forEach(b=>b.disabled=true);
} else {
  // No opt-in survives app relaunch. Prevent stale schedules from a prior test.
  void execute(async()=>{await lifecycle.disable();show("테스트 준비 완료. 권한을 확인하고 알림을 켜주세요.");});
}
