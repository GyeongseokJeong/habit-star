/**
 * Android-only STEP 5 prototype: pure schedule planner for the existing Habit
 * model. This module neither reads browser storage nor contacts a server.
 * Calendar times follow the device's local timezone (getDay: Sunday = 0).
 */
export const REMINDER_KIND = "byeolharu-habit-reminder-v1";
export const DEMO_SCOPE = "step5-isolated-demo";
export const MAX_REMINDERS = 48;

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function localDayKey(date) {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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
  { now = new Date(), daysAhead = 8, completedTodayIds = [] } = {},
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
  const today = localDayKey(now);
  const completed = new Set(completedTodayIds);
  const usedNotificationIds = new Map();
  const result = [];

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const localDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12);
    const day = localDayKey(localDay);
    for (const habit of habits) {
      if (!habit.alarmEnabled || !habit.scheduledTime) continue;
      if (!validDays(habit.repeatDays).includes(localDay.getDay())) continue;
      if (day === today && completed.has(habit.id)) continue;
      const [, hh, mm] = TIME_PATTERN.exec(habit.scheduledTime);
      const hour = Number(hh);
      const minute = Number(mm);
      const at = new Date(localDay.getFullYear(), localDay.getMonth(), localDay.getDate(), hour, minute);
      // Reject non-existent local clock times around daylight-saving transitions.
      if (at.getHours() !== hour || at.getMinutes() !== minute || at <= now) continue;
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
        fingerprint: hashFingerprint(key + ":" + title + ":" + habit.scheduledTime),
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

export function toNativeNotification(planItem, scope) {
  if (typeof scope !== "string" || !scope.trim()) {
    throw new Error("알림 소유 범위를 지정해야 합니다.");
  }
  return {
    id: planItem.id,
    title: "별하루 ✦ " + planItem.title,
    body: "오늘의 작은 실천을 떠올려 볼까요?",
    schedule: {
      at: planItem.at,
      allowWhileIdle: false,
      isExactNotification: false,
    },
    channelId: "byeolharu-habit-reminders-step5",
    extra: {
      kind: REMINDER_KIND,
      scope,
      habitId: planItem.habitId,
      day: planItem.day,
      fingerprint: planItem.fingerprint,
    },
  };
}
