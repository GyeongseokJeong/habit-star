import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const TEST_ID = 7301;
const CHANNEL_ID = "byeolharu-poc-reminders";
const status = document.getElementById("status");
const buttons = [...document.querySelectorAll("button")];
let busy = false;

function report(message) {
  status.textContent = message;
}
async function action(fn) {
  if (busy) return;
  busy = true;
  buttons.forEach(button => { button.disabled = true; });
  try { await fn(); }
  catch (err) { report(`오류: ${err instanceof Error ? err.message : String(err)}`); }
  finally {
    busy = false;
    buttons.forEach(button => { button.disabled = false; });
  }
}
async function permissionStatus(request = false) {
  const value = request
    ? await LocalNotifications.requestPermissions()
    : await LocalNotifications.checkPermissions();
  return value.display;
}
async function ensureChannel() {
  await LocalNotifications.createChannel({
    id: CHANNEL_ID,
    name: "별하루 알림 기능 테스트",
    description: "Android 알림 권한 및 예약 확인",
    importance: 4,
    visibility: 1,
  });
}
document.getElementById("permission").addEventListener("click", () => action(async () => {
  const result = await permissionStatus(true);
  report(`알림 권한 상태: ${result}\n설정에서 다시 변경할 수 있습니다.`);
}));
document.getElementById("schedule").addEventListener("click", () => action(async () => {
  const result = await permissionStatus(true);
  if (result !== "granted") {
    report("알림 권한이 허용되지 않았습니다. 설정에서 알림을 허용한 뒤 다시 시도하세요.");
    return;
  }
  await ensureChannel();
  // Replace a previously scheduled test instead of accumulating duplicates.
  await LocalNotifications.cancel({ notifications: [{ id: TEST_ID }] });
  const when = new Date(Date.now() + 30_000);
  await LocalNotifications.schedule({
    notifications: [{
      id: TEST_ID,
      title: "별하루 ✦",
      body: "작은 실천이 별빛이 되는 순간이에요. (Android 알림 테스트)",
      schedule: { at: when, allowWhileIdle: false },
      channelId: CHANNEL_ID,
      extra: { kind: "byeolharu-notification-poc" },
    }],
  });
  report(`테스트 알림 1건 예약됨\n예정 시각: ${when.toLocaleTimeString("ko-KR")}\n이제 앱을 백그라운드로 보내세요.`);
}));
document.getElementById("pending").addEventListener("click", () => action(async () => {
  const found = await LocalNotifications.getPending();
  const ours = found.notifications.filter(item => item.id === TEST_ID);
  report(ours.length ? "별하루 테스트 알림 1건이 예약되어 있습니다." : "예약된 별하루 테스트 알림이 없습니다.");
}));
document.getElementById("cancel").addEventListener("click", () => action(async () => {
  await LocalNotifications.cancel({ notifications: [{ id: TEST_ID }] });
  report("예약된 테스트 알림을 취소했습니다.");
}));
if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
  report("Android 연결됨. 알림 권한 확인부터 시작하세요.");
  LocalNotifications.addListener("localNotificationReceived", () => {
    report("알림 수신 이벤트가 확인되었습니다. 알림 패널도 확인하세요.");
  }).catch(() => {});
} else {
  report("Android 네이티브 환경이 아닙니다. APK에서 시험하세요.");
  buttons.forEach(button => { button.disabled = true; });
}
