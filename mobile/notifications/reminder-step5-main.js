import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { buildReminderPlan, toNativeNotification, DEMO_SCOPE, REMINDER_KIND } from "./reminder-plan.js";

const CHANNEL_ID = "byeolharu-habit-reminders-step5";
const status = document.querySelector("#status");
const preview = document.querySelector("#preview");
const buttons = [...document.querySelectorAll("button")];
let busy = false;
let firstCompleted = false;
let testMinuteBase = null;
const dateTime = (date) => date.toLocaleString("ko-KR", {weekday:"short",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"});

function demoHabits() {
  if (!testMinuteBase) testMinuteBase = Date.now();
  const clock = (mins) => {
    const date = new Date(testMinuteBase + mins * 60_000);
    return String(date.getHours()).padStart(2,"0") + ":" + String(date.getMinutes()).padStart(2,"0");
  };
  return [
    {id:"step5-demo-water",title:"물 마시기",alarmEnabled:true,scheduledTime:clock(3),repeatDays:[0,1,2,3,4,5,6]},
    {id:"step5-demo-reading",title:"독서 10분",alarmEnabled:true,scheduledTime:clock(5),repeatDays:[1,2,3,4,5]},
  ];
}
function plan() {
  return buildReminderPlan(demoHabits(), {
    now:new Date(),
    daysAhead:8,
    completedTodayIds:firstCompleted?["step5-demo-water"]:[],
  });
}
function showPlan() {
  const result=plan();
  preview.replaceChildren();
  for(const item of result.notifications.slice(0,7)) {
    const li=document.createElement("li");
    li.textContent=item.title+" · "+dateTime(item.at);
    preview.append(li);
  }
  return result;
}
async function ownPending() {
  const pending=await LocalNotifications.getPending();
  return pending.notifications.filter(n=>n.extra?.kind===REMINDER_KIND && n.extra?.scope===DEMO_SCOPE);
}
async function cancelOwn() {
  const existing=await ownPending();
  if(existing.length) await LocalNotifications.cancel({notifications:existing.map(n=>({id:n.id}))});
  return existing.length;
}
function report(message){status.textContent=message;}
async function run(fn) {
  if(busy)return;
  busy=true; buttons.forEach(b=>{b.disabled=true;});
  try{await fn();} catch(error){report("오류: "+(error instanceof Error?error.message:String(error)));}
  finally{busy=false;buttons.forEach(b=>{b.disabled=false;});}
}
document.querySelector("#permission").addEventListener("click",()=>run(async()=>{
  const p=await LocalNotifications.requestPermissions();
  report("알림 권한: "+p.display);
}));
document.querySelector("#previewButton").addEventListener("click",()=>run(async()=>{
  const result=showPlan();
  report("앞으로 8일간 예약 대상 "+result.total+"건"+(result.truncated?" (최대 건수로 제한)":""));
}));
document.querySelector("#schedule").addEventListener("click",()=>run(async()=>{
  const p=await LocalNotifications.requestPermissions();
  if(p.display!=="granted"){report("알림 권한이 필요합니다.");return;}
  const current=showPlan();
  await LocalNotifications.createChannel({id:CHANNEL_ID,name:"별하루 STEP 5 습관 알림",importance:4,visibility:1});
  // Only touch the demo-owned records; never cancel other apps or STEP 4 IDs.
  const old=await ownPending();
  const desired=current.notifications.map(item=>toNativeNotification(item,DEMO_SCOPE));
  // Keep valid existing records in place; never cancel before calculating the full replacement.
  const currentById=new Map(old.map(n=>[n.id,n]));
  const desiredIds=new Set(desired.map(n=>n.id));
  const stale=old.filter(n=>!desiredIds.has(n.id)||!desired.some(d=>d.id===n.id&&d.extra.fingerprint===n.extra?.fingerprint));
  const staleIds=new Set(stale.map(n=>n.id));
  const toSchedule=desired.filter(n=>!currentById.has(n.id)||staleIds.has(n.id));
  if(stale.length) await LocalNotifications.cancel({notifications:stale.map(n=>({id:n.id}))});
  if(toSchedule.length) await LocalNotifications.schedule({notifications:toSchedule});
  report("데모 알림 "+desired.length+"건 계획\n변경된 예약 "+toSchedule.length+"건 · 제거 "+stale.length+"건\n알림 도착은 Android 절전 정책에 따라 지연될 수 있습니다.");
}));
document.querySelector("#complete").addEventListener("click",()=>run(async()=>{
  firstCompleted=true;
  const pending=await ownPending();
  const today=new Date();
  const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,"0"),String(today.getDate()).padStart(2,"0")].join("-");
  const toCancel=pending.filter(n=>n.extra?.habitId==="step5-demo-water"&&n.extra?.day===todayKey);
  if(toCancel.length) await LocalNotifications.cancel({notifications:toCancel.map(n=>({id:n.id}))});
  showPlan();
  report("첫 번째 습관을 오늘 완료 처리했습니다.\n오늘의 해당 알림 "+toCancel.length+"건 취소. 다른 요일의 알림은 유지됩니다.");
}));
document.querySelector("#pending").addEventListener("click",()=>run(async()=>{
  const pending=await ownPending();
  report("현재 예약된 STEP 5 데모 알림: "+pending.length+"건");
}));
document.querySelector("#cancel").addEventListener("click",()=>run(async()=>{
  const count=await cancelOwn();
  report("STEP 5 데모 알림 "+count+"건 취소했습니다.");
}));
if(Capacitor.isNativePlatform()&&Capacitor.getPlatform()==="android"){
  report("Android 연결 완료. 일정 미리보기부터 진행하세요.");
  showPlan();
} else {
  report("Android 전용 디버그 APK에서 실행해 주세요.");
  buttons.forEach(b=>{b.disabled=true;});
}