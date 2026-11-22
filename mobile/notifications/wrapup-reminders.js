/**
 * Android-only period wrap-up preferences and pure candidate planner.
 * No storage reads, background network calls or native scheduling here.
 * A queued reminder reflects the latest committed snapshot when planned.
 */
import { buildReminderPlan, localDayKey } from "./reminder-plan.js";

export const WRAPUP_GROUPS = Object.freeze(["morning", "day", "night"]);
export const WRAPUP_TIMES = Object.freeze({
  morning: Object.freeze(["09:30", "10:00", "10:30"]),
  day: Object.freeze(["15:30", "16:00", "16:30"]),
  night: Object.freeze(["21:00", "21:30", "22:00", "22:30"]),
});
export const WRAPUP_DEFAULTS = Object.freeze({
  morning: Object.freeze({ enabled: false, time: "10:30" }),
  day: Object.freeze({ enabled: false, time: "16:30" }),
  night: Object.freeze({ enabled: false, time: "22:00" }),
});
const LABELS = { morning: "아침", day: "낮", night: "밤" };
const ALL_DAYS = [0,1,2,3,4,5,6];

export function normalizeWrapupSettings(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const next = {};
  for (const group of WRAPUP_GROUPS) {
    const item = source[group];
    const valid = item && typeof item === "object" && !Array.isArray(item);
    const time = valid && WRAPUP_TIMES[group].includes(item.time)
      ? item.time : WRAPUP_DEFAULTS[group].time;
    // An unrecognized saved time cannot silently activate an alarm.
    next[group] = { enabled: Boolean(valid && item.enabled === true && WRAPUP_TIMES[group].includes(item.time)), time };
  }
  return next;
}
export const hasEnabledWrapup = (settings) =>
  WRAPUP_GROUPS.some((group) => settings?.[group]?.enabled === true);

/** Construct at most one plan per configured period/day.
 * Only today's eligible unfinished scheduled habits count; future days assume
 * not completed yet. An individual habit must opt into alarms and have a
 * scheduled time BEFORE the wrap-up time to avoid premature reminders.
 */
export function buildWrapupCandidates(snapshot, { now = new Date(), daysAhead = 8 } = {}, settings) {
  const cfg = normalizeWrapupSettings(settings);
  if (!hasEnabledWrapup(cfg)) return [];
  if (!snapshot || !Array.isArray(snapshot.habits)) throw new Error("마무리 알림을 예약할 습관 정보가 없습니다.");
  const today = localDayKey(now, snapshot.timeZone);
  const todayWeekday = new Date(today + "T12:00:00Z").getUTCDay();
  const result = [];
  for (const group of WRAPUP_GROUPS) {
    if (!cfg[group].enabled) continue;
    const atTime = cfg[group].time;
    const eligible = snapshot.habits.filter((habit) =>
      habit && habit.timeGroup === group &&
      habit.alarmEnabled === true &&
      typeof habit.scheduledTime === "string" &&
      habit.scheduledTime < atTime
    );
    if (!eligible.length) continue;
    const days = (habit) => habit.repeatDays === undefined ? ALL_DAYS : habit.repeatDays;
    const unionDays = [...new Set(eligible.flatMap(days))].sort();
    if (!unionDays.length) continue;
    const todayPending = eligible.filter((habit) =>
      days(habit).includes(todayWeekday) && !habit.completed
    ).length;
    const syntheticId = "__byeolharu_wrapup__" + group;
    const synthetic = {
      id: syntheticId,
      title: LABELS[group] + " 마무리",
      alarmEnabled: true,
      scheduledTime: atTime,
      repeatDays: unionDays,
    };
    const source = buildReminderPlan([synthetic], {
      now, daysAhead, timeZone: snapshot.timeZone,
      completedTodayIds: todayPending ? [] : [syntheticId],
    });
    for (const item of source.notifications) {
      const weekday = new Date(item.day + "T12:00:00Z").getUTCDay();
      const count = eligible.filter((habit) =>
        days(habit).includes(weekday) && (item.day !== today || !habit.completed)
      ).length;
      if (count === 0) continue;
      result.push({
        ...item,
        category: "wrapup",
        timeGroup: group,
        remainingCount: count,
        title: LABELS[group] + " 마무리",
        fingerprint: item.fingerprint + ":wrapup-v1:" + count,
      });
    }
  }
  return result;
}
