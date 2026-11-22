/**
 * STEP 6 preparation: isolated, side-effect-free bridge from a verified
 * current-day Habit snapshot to account-scoped Android reminders.
 *
 * This file must NOT be wired to the production Next.js website or auth
 * callback until the packaged application architecture is verified.
 */
import {
  buildReminderPlan, localDayKey, reminderId,
  toNativeNotification, REMINDER_KIND, MAX_REMINDERS,
} from "./reminder-plan.js";
import { buildWrapupCandidates, normalizeWrapupSettings } from "./wrapup-reminders.js";

const SCOPE_PATTERN = /^(guest|member:[A-Za-z0-9_-]{1,128})$/;

export function requireReminderScope(scope) {
  if (typeof scope !== "string" || !SCOPE_PATTERN.test(scope)) {
    throw new Error("유효하지 않은 별하루 알림 사용자 범위입니다.");
  }
  return scope;
}

/**
 * Current-day snapshot only. Do not schedule from calendar history, stale
 * account data, or unverified account identities.
 */
export function buildScopedReminderPlan(
  snapshot,
  { scope, now = new Date(), daysAhead = 8, habitOptIn = true, wrapupSettings = null } = {},
) {
  requireReminderScope(scope);
  if (
    !snapshot || typeof snapshot !== "object" ||
    snapshot.day !== localDayKey(now, snapshot.timeZone) ||
    !Array.isArray(snapshot.habits)
  ) {
    throw new Error("오늘의 최신 습관 기록이 준비되지 않았습니다.");
  }

  const completedTodayIds = snapshot.habits
    .filter((habit) => habit && habit.completed === true)
    .map((habit) => habit.id);

  const habitSource = buildReminderPlan(habitOptIn ? snapshot.habits : [], {
    now, daysAhead, completedTodayIds, timeZone: snapshot.timeZone,
  });
  const settings = normalizeWrapupSettings(wrapupSettings);
  const wrapups = buildWrapupCandidates(snapshot, { now, daysAhead }, settings);
  // Reserve the nearest 48 alarms across both kinds. Never exceed the Android
  // cap; include same-day wrap-ups before distant future habit alarms.
  const candidates = [...habitSource.notifications, ...wrapups].sort((a,b) =>
    a.at - b.at || (a.category === "wrapup" ? 1 : 0) - (b.category === "wrapup" ? 1 : 0) || a.id - b.id
  );
  const total = habitSource.total + wrapups.length;
  const seenIds = new Set();
  const scoped = candidates.slice(0, MAX_REMINDERS).map((item) => {
    const id = reminderId(scope + ":" + item.habitId, item.day);
    if (seenIds.has(id)) throw new Error("사용자 범위 내 알림 ID 충돌");
    seenIds.add(id);
    // Invalidate reservations after daylight-saving/time-zone changes.
    const fingerprint = item.fingerprint + ":" +
      item.at.getTime() + ":" + scope;
    return { ...item, id, fingerprint };
  });
  return { notifications: scoped, scope, total,
    truncated: total > MAX_REMINDERS,
  };
}

/**
 * Plan only; no native plugin calls. The pending set must contain the
 * caller's entire Android notification queue (not a prefiltered subset).
 * A conflicting foreign ID aborts before ANY writes.
 */
export function diffScopedNotifications(pending, scopedPlan) {
  if (!Array.isArray(pending) || !scopedPlan || !Array.isArray(scopedPlan.notifications)) {
    throw new Error("알림 예약 비교를 위한 입력이 올바르지 않습니다.");
  }
  const scope = requireReminderScope(scopedPlan.scope);
  const desired = scopedPlan.notifications.map((item) => toNativeNotification(item, scope));
  const desiredById = new Map();
  for (const item of desired) {
    if (desiredById.has(item.id)) throw new Error("중복 예약 ID가 존재합니다.");
    desiredById.set(item.id, item);
  }
  const ids = new Set();
  const owned = [];
  for (const item of pending) {
    if (!item || !Number.isInteger(item.id) || ids.has(item.id)) {
      throw new Error("Android 예약 목록에 중복되거나 유효하지 않은 ID가 있습니다.");
    }
    ids.add(item.id);
    const mine = item.extra?.kind === REMINDER_KIND && item.extra.scope === scope;
    if (mine) owned.push(item);
    else if (desiredById.has(item.id)) {
      throw new Error("다른 알림과 ID 충돌: 예약 변경이 중단됐습니다.");
    }
  }
  const ownedMap = new Map(owned.map((item) => [item.id, item]));
  const cancel = owned.filter((old) => {
    const wanted = desiredById.get(old.id);
    return !wanted || wanted.extra.fingerprint !== old.extra?.fingerprint;
  }).map((item) => ({ id: item.id }));
  const cancelIds = new Set(cancel.map(({ id }) => id));
  const schedule = desired.filter((item) => {
    return !ownedMap.has(item.id) || cancelIds.has(item.id);
  });
  return {
    cancel,
    schedule,
    unchanged: desired.length - schedule.length,
    desiredCount: desired.length,
  };
}

function scopedPending(pending, scope) {
  return pending.filter((item) =>
    item.extra?.kind === REMINDER_KIND &&
    item.extra.scope === scope,
  );
}

/**
 * Native adapter is dependency-injected for testing. Does NOT ask for
 * permissions automatically. Never reads or writes user habit data.
 */
export async function reconcileScopedReminders(
  localNotifications,
  scopedPlan,
) {
  requireReminderScope(scopedPlan?.scope);
  const permission = await localNotifications.checkPermissions();
  if (permission.display !== "granted") {
    return { status: "permission-required", changed: false };
  }
  const pending = (await localNotifications.getPending()).notifications;
  const changes = diffScopedNotifications(pending, scopedPlan);
  // Finish validation before altering any native reservation.
  if (!changes.cancel.length && !changes.schedule.length) {
    return { status: "unchanged", changed: false, ...changes };
  }
  if (changes.schedule.length) {
    await localNotifications.createChannel({
      id: "byeolharu-habit-reminders-step5",
      name: "별하루 습관 알림",
      importance: 4,
      visibility: 1,
    });
  }
  if (changes.cancel.length) {
    await localNotifications.cancel({ notifications: changes.cancel });
  }
  if (changes.schedule.length) {
    await localNotifications.schedule({ notifications: changes.schedule });
  }
  return { status: "updated", changed: true, ...changes };
}

/**
 * Call on explicit logout/account switch to avoid previous account reminders
 * appearing later. Does not clear IndexedDB, outbox or server records.
 */
export async function cancelScopedReminders(localNotifications, scope) {
  requireReminderScope(scope);
  const pending = (await localNotifications.getPending()).notifications;
  const own = scopedPending(pending, scope);
  if (own.length) {
    await localNotifications.cancel({
      notifications: own.map(({ id }) => ({ id })),
    });
  }
  return own.length;
}
