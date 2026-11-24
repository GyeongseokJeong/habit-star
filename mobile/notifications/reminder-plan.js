/**
 * Android-only STEP 5 prototype: pure schedule planner for the existing Habit
 * model. This module neither reads browser storage nor contacts a server.
 * Guest calendar times follow the device; members use their account time zone.
 */
export const REMINDER_KIND = "byeolharu-habit-reminder-v1";
export const DEMO_SCOPE = "step5-isolated-demo";
export const MAX_REMINDERS = 48;
// Include the native scheduling policy in fingerprints so an app update
// replaces pending alarms created by the old, non-idle-capable policy.
export const REMINDER_DELIVERY_POLICY = "prefer-exact-v3";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// Member calendar follows the persisted account timezone. Guest stays device-local.
function zonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {timeZone, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23"}).formatToParts(date);
  const p = Object.fromEntries(parts.filter(x=>x.type!=="literal").map(x=>[x.type,Number(x.value)]));
  return p;
}
export function localDayKey(date, timeZone) {
  if (timeZone !== undefined) {
    const p = zonedParts(date, timeZone);
    return [p.year,p.month,p.day].map((x,i)=>String(x).padStart(i===0?4:2,"0")).join("-");
  }
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

// Resolve a local wall-clock minute to a real instant. Probe offsets on either
// side of the date to handle DST gaps/folds: skip nonexistent times and choose
// the earlier instant for repeated times (one alarm per habit/day).
function zonedMinute(day, hour, minute, timeZone) {
  const [y,m,d] = day.split("-").map(Number);
  const wall = Date.UTC(y,m-1,d,hour,minute,0);
  const offsets = new Set();
  for (const hours of [-36,-12,0,12,36]) {
    const probe = wall + hours * 3600000;
    const p = zonedParts(new Date(probe),timeZone);
    offsets.add(Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second)-probe);
  }
  const matches = [...offsets].map(offset=>new Date(wall-offset)).filter(at=>{
    const p=zonedParts(at,timeZone);
    return p.year===y && p.month===m && p.day===d && p.hour===hour && p.minute===minute && p.second===0;
  }).sort((a,b)=>a-b);
  return matches[0] ?? null;
}

/** A stable positive Android notification ID, disjoint from test ID 7301. */
export function reminderId(habitId, day) {
  const input = habitId + ":" + day;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  }
  return 1_000_000_000 + ((hash >>> 0) % 900_000_000);
}

function validDays(value) {
  if (value === undefined) return ALL_DAYS;
  if (
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 7 ||
    new Set(value).size !== value.length ||
    value.some((x) => !Number.isInteger(x) || x < 0 || x > 6)
  ) throw new Error("유효하지 않은 반복 요일이 있습니다.");
  return value;
}

function validateHabit(habit) {
  if (
    !habit ||
    typeof habit !== "object" ||
    typeof habit.id !== "string" ||
    !habit.id.trim() ||
    typeof habit.title !== "string" ||
    !habit.title.trim() ||
    typeof habit.alarmEnabled !== "boolean"
  ) throw new Error("습관 설정이 올바르지 않습니다.");
  validDays(habit.repeatDays);
  if (habit.scheduledTime !== undefined && !TIME_PATTERN.test(habit.scheduledTime)) {
    throw new Error("알림 시간이 HH:mm 형식이 아닙니다.");
  }
}

function hashFingerprint(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  }
  return String(h >>> 0);
}

/**
 * Plans one-shot, inexact Android notifications for a bounded rolling horizon.
 * No implicit permission requests, background reads or automatic scheduling.
 * Rebuild after a habit edit/completion, app resume or device time change.
 */
export function buildReminderPlan(
  habits,
  { now = new Date(), daysAhead = 8, completedTodayIds = [], timeZone } = {},
) {
  if (!Array.isArray(habits) || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("알림 계획에 사용할 입력이 잘못되었습니다.");
  }
  if (!Number.isInteger(daysAhead) || daysAhead < 1 || daysAhead > 14) {
    throw new Error("알림 계획 범위는 1~14일이어야 합니다.");
  }
  if (!Array.isArray(completedTodayIds) || completedTodayIds.some((x) => typeof x !== "string")) {
    throw new Error("오늘의 완료 습관 목록이 잘못되었습니다.");
  }

  const seenHabitIds = new Set();
  for (const habit of habits) {
    validateHabit(habit);
    if (seenHabitIds.has(habit.id)) throw new Error("중복된 습관 ID가 있습니다.");
    seenHabitIds.add(habit.id);
  }
  const today = localDayKey(now, timeZone);
  const [year,month,date] = today.split("-").map(Number);
  const completed = new Set(completedTodayIds);
  const usedNotificationIds = new Map();
  const result = [];

  for (let offset = 0; offset < daysAhead; offset += 1) {
    // Calendar arithmetic uses UTC solely as a zone-independent date container.
    const calendar = new Date(Date.UTC(year,month-1,date+offset,12));
    const day = calendar.toISOString().slice(0,10);
    for (const habit of habits) {
      if (!habit.alarmEnabled || !habit.scheduledTime) continue;
      if (!validDays(habit.repeatDays).includes(calendar.getUTCDay())) continue;
      if (day === today && completed.has(habit.id)) continue;
      const [, hh, mm] = TIME_PATTERN.exec(habit.scheduledTime);
      const hour = Number(hh);
      const minute = Number(mm);
      const at = timeZone === undefined
        ? new Date(calendar.getUTCFullYear(), calendar.getUTCMonth(), calendar.getUTCDate(), hour, minute)
        : zonedMinute(day,hour,minute,timeZone);
      // Reject nonexistent local clock times and past alarms.
      if (!at || (timeZone === undefined && (at.getHours() !== hour || at.getMinutes() !== minute)) || at <= now) continue;
      const id = reminderId(habit.id, day);
      const key = habit.id + ":" + day;
      const previous = usedNotificationIds.get(id);
      if (previous && previous !== key) {
        throw new Error("Android 알림 ID 충돌: 예약을 적용하지 않았습니다.");
      }
      usedNotificationIds.set(id, key);
      const title = habit.title.trim();
      result.push({
        id,
        habitId: habit.id,
        day,
        at,
        title,
        fingerprint: hashFingerprint(key + ":" + title + ":" + habit.scheduledTime + ":" + REMINDER_DELIVERY_POLICY),
      });
    }
  }
  result.sort((a, b) => a.at - b.at || a.id - b.id);
  return {
    notifications: result.slice(0, MAX_REMINDERS),
    truncated: result.length > MAX_REMINDERS,
    total: result.length,
  };
}

export function toNativeNotification(planItem, scope, { exact = false } = {}) {
  if (typeof scope !== "string" || !scope.trim()) {
    throw new Error("알림 소유 범위를 지정해야 합니다.");
  }
  const isWrapup = planItem.category === "wrapup";
  return {
    id: planItem.id,
    title: "별하루 ✦ " + planItem.title,
    body: isWrapup
      ? `${planItem.title.split(" ")[0]}의 작은 실천 ${planItem.remainingCount}개가 남아 있어요. 가볍게 돌아볼까요?`
      : "오늘의 작은 실천을 떠올려 볼까요?",
    schedule: {
      at: planItem.at,
      // A user-selected habit reminder should also run while the phone is idle.
      allowWhileIdle: true,
    },
    // Capacitor Local Notifications 8.3+ puts this on LocalNotificationSchema,
    // NOT schedule. Do not trigger an unexpected exact-alarm settings prompt.
    isExactNotification: exact,
    channelId: "byeolharu-habit-reminders-step5",
    extra: {
      kind: REMINDER_KIND,
      scope,
      category: isWrapup ? "wrapup" : "habit",
      habitId: planItem.habitId,
      ...(isWrapup ? { timeGroup: planItem.timeGroup, remainingCount: planItem.remainingCount } : {}),
      day: planItem.day,
      fingerprint: planItem.fingerprint,
    },
  };
}
