import { MAX_REMINDERS, localDayKey, reminderId, REMINDER_KIND } from "./reminder-plan.js";
import { buildScopedReminderPlan, diffScopedNotifications } from "./scoped-reminder-runtime.js";
import { WRAPUP_GROUPS, WRAPUP_TIMES } from "./wrapup-reminders.js";
import { effectiveHabitReminderOptIn } from "./habit-reminder-intent.js";

// A cancelled/expired/visible stored entry is NOT an available notification ID.
const validId = id => Number.isSafeInteger(id) && id > 0 && id <= 2147483647;
function uniqueIds(ids) {
  if (!Array.isArray(ids) || ids.some(id => !validId(id)) || new Set(ids).size !== ids.length) {
    throw Error("Invalid notification IDs");
  }
  return new Set(ids);
}
function inspectQueue(queue) {
  const stored = uniqueIds(queue.storedIds);
  const scheduled = uniqueIds(queue.scheduledIds);
  const visible = uniqueIds(queue.visibleIds);
  if (!Array.isArray(queue.saved)) throw Error("Missing saved notifications");
  const parsed = uniqueIds(queue.saved.map(item => item?.id));
  if (parsed.size !== stored.size || [...stored].some(id => !parsed.has(id)) ||
      [...scheduled].some(id => !stored.has(id))) throw Error("Incomplete notification inventory");
  return { stored, scheduled, visible, byId: new Map(queue.saved.map(item => [item.id, item])) };
}
const defer = reason => ({ kind: "defer", reason });
const noop = reason => ({ kind: "noop", reason });
function sameOwner(actual, expected) {
  const a = actual?.extra, e = expected.extra;
  const schedule = actual?.schedule;
  const at = schedule?.at instanceof Date ? schedule.at.getTime()
    : typeof schedule?.at === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(schedule.at)
      ? Date.parse(schedule.at) : NaN;
  return actual?.id === expected.id && a?.kind === REMINDER_KIND &&
    a.scope === e.scope && a.category === "habit" && a.habitId === e.habitId &&
    a.day === e.day && a.fingerprint === e.fingerprint &&
    actual.cancelled !== true && actual.channelId === expected.channelId &&
    actual.title === expected.title && actual.body === expected.body &&
    actual.isExactNotification === expected.isExactNotification &&
    at === expected.schedule.at.getTime() && schedule.allowWhileIdle === true &&
    (schedule.repeats === undefined || schedule.repeats === false) &&
    schedule.on === undefined && schedule.every === undefined && schedule.count === undefined;
}
function nativeTarget(plan, id, day, exact) {
  const item = plan.notifications.find(n => n.habitId === id && n.day === day && n.category !== "wrapup");
  // Use the exact same fingerprint/payload builder as normal foreground reconciliation.
  return item ? diffScopedNotifications([], { ...plan, notifications: [item] }, { exact }).schedule[0] : null;
}

const titlePrefix = "별하루 ✦ ";
function onlyFields(value, fields) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every(key => fields.includes(key));
}

/** Completion can cancel an earlier setting's reservation for this exact
 * habit/day/scope. Reconstruct the stored payload with the canonical planner
 * (including its fingerprint and DST policy); IDs alone are not ownership.
 * Native independently validates the same stored payload before mutation.
 * This helper must NEVER be used to decide what to restore. */
function canonicalStoredTarget(stored, { scope, habit, day, timeZone, now }) {
  if (!onlyFields(stored, ["id", "title", "body", "schedule", "isExactNotification", "channelId", "extra", "cancelled"]) ||
      (stored.cancelled !== undefined && stored.cancelled !== false) ||
      typeof stored.title !== "string" || !stored.title.startsWith(titlePrefix) || stored.title.length > 8192 ||
      typeof stored.isExactNotification !== "boolean" ||
      !onlyFields(stored.schedule, ["at", "allowWhileIdle", "repeats"]) ||
      !onlyFields(stored.extra, ["kind", "scope", "habitId", "category", "day", "fingerprint"])) return null;
  const title = stored.title.slice(titlePrefix.length);
  if (!title.trim() || title !== title.trim()) return null;
  const rawAt = stored.schedule.at;
  const at = rawAt instanceof Date ? new Date(rawAt.getTime())
    : typeof rawAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(rawAt) ? new Date(rawAt) : null;
  if (!at || !Number.isFinite(at.getTime()) || (typeof rawAt === "string" && at.toISOString() !== rawAt) ||
      at <= now || at.getMilliseconds() !== 0 || localDayKey(at, timeZone) !== day) return null;
  const minute = timeZone === undefined
    ? [at.getHours(), at.getMinutes()].map(n => String(n).padStart(2, "0")).join(":")
    : new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  const plan = buildScopedReminderPlan({ day, timeZone, habits: [{ ...habit, title,
    scheduledTime: minute, repeatDays: undefined, completed: false }] },
  { scope, now, daysAhead: 1, habitOptIn: true });
  const expected = nativeTarget(plan, habit.id, day, stored.isExactNotification);
  return expected && sameOwner(stored, expected) ? expected : null;
}

/**
 * STEP 4B: pure post-commit decision; external native adapter applies it.
 * Invoke only after the existing widget transaction returned "saved", while
 * the exact verified request is still valid. Cancellation needs the complete
 * inventory for its single target ID; restoration needs the complete native
 * queue (including other IDs for capacity/collision checks). Both must come
 * from the same plugin store and visible/scheduled sets; validate each
 * selected actual storage key against its decoded ID before normalizing.
 * getPending() alone cannot prove ID availability or actual OS delivery.
 * The adapter must revalidate request, revision, scope, day, prefs,
 * permissions, inventory & time immediately before one native operation.
 * Never applies an entire rolling-horizon diff in the cold runtime.
 */
export function planColdWidgetReminder({ snapshot, command, memberId, optInRaw, wrapupRaw,
    permissionGranted, exact, queue, now = new Date() }) {
  try {
    const scope = memberId === null ? "guest" : "member:" + memberId;
    const state = snapshot?.state;
    const day = snapshot?.day;
    const timeZone = memberId === null ? undefined : state?.timezone;
    if (!state || !command || command.scope !== scope || command.day !== day ||
        (memberId !== null && (typeof memberId !== "string" || !memberId ||
          state.hydrated !== true || typeof timeZone !== "string" || !timeZone)) ||
        !Object.hasOwn(snapshot.history, day) || day !== localDayKey(now, timeZone) ||
        !Number.isSafeInteger(command.revision) || command.revision < 0 ||
        state.localRevision !== command.revision + 1 ||
        typeof command.habitId !== "string" || !command.habitId.trim() ||
        typeof command.completed !== "boolean" || command.expectedCompleted !== !command.completed ||
        !Number.isSafeInteger(command.version) || command.version < 0) return defer("stale-commit");
    const matching = snapshot.habits.filter(h => h.id === command.habitId);
    const entries = Object.values(state.entities).filter(e =>
      e.kind === "habit_entries" && e.id === command.habitId && e.day === day && !e.deleted);
    const rating = command.completed ? 5 : 0;
    // Match widgetPracticeTargetRating: explicit undo of any valid completed
    // rating is allowed; incomplete rated records still require the editor.
    const previousRatingValid = command.completed ? command.expectedRating === 0
      : Number.isInteger(command.expectedRating) && command.expectedRating >= 0 && command.expectedRating <= 5;
    if (!previousRatingValid || matching.length !== 1 || matching[0].completed !== command.completed ||
        matching[0].rating !== rating || entries.length !== 1 || entries[0].version !== command.version ||
        entries[0].data.completed !== command.completed || entries[0].data.rating !== rating)
      return defer("stale-commit");
    const habit = matching[0];
    if (![null, "0", "1"].includes(optInRaw) || (wrapupRaw !== null && typeof wrapupRaw !== "string"))
      return defer("unknown-preferences");
    const wrapupSettings = wrapupRaw === null ? null : JSON.parse(wrapupRaw);
    if (wrapupRaw !== null && (!wrapupSettings || typeof wrapupSettings !== "object" || Array.isArray(wrapupSettings) ||
        Object.keys(wrapupSettings).some(group => !WRAPUP_GROUPS.includes(group) ||
          typeof wrapupSettings[group]?.enabled !== "boolean" ||
          !WRAPUP_TIMES[group].includes(wrapupSettings[group]?.time))))
      return defer("unknown-preferences");
    const deviceOptIn = optInRaw === "1" ? true : optInRaw === "0" ? false : null;
    if (!effectiveHabitReminderOptIn(deviceOptIn, snapshot) || !habit.alarmEnabled || !habit.scheduledTime)
      return noop("opted-out-or-unconfigured");
    if (permissionGranted !== true || typeof exact !== "boolean") return defer("permission-unconfirmed");

    // Keep validation of the CURRENT habit configuration, even when its own
    // occurrence is now past. The widget command must still be for today's
    // scheduled habit; only the stored reservation's title/time may differ.
    const candidate = buildScopedReminderPlan({ day, timeZone, habits: [{ ...habit, completed: false }] },
      { scope, now, daysAhead: 1, habitOptIn: true });
    if (habit.repeatDays && !habit.repeatDays.includes(new Date(day + "T12:00:00Z").getUTCDay()))
      return defer("stale-commit");

    if (command.completed) {
      // The old reservation can be later than today's edited schedule. Check
      // its own still-future time and ownership rather than skipping it just
      // because the latest schedule no longer has a future occurrence.
      const inventory = inspectQueue(queue);
      const id = reminderId(scope + ":" + habit.id, day);
      if (inventory.visible.has(id)) return defer("visible-id");
      const current = inventory.byId.get(id);
      if (!current) return noop("already-absent");
      const expected = canonicalStoredTarget(current, { scope, habit, day, timeZone, now });
      if (!expected || !inventory.scheduled.has(id)) return defer("occupied-id");
      if (expected.schedule.at.getTime() <= now.getTime() + 2000) return defer("too-close");
      return { kind: "cancel", expected };
    }

    // Undo must use today's CURRENT settings, never an earlier notification's
    // title/time. A past or nonexistent (DST) minute is not safe to restore.
    const ordinary = nativeTarget(candidate, habit.id, day, false);
    const precise = nativeTarget(candidate, habit.id, day, true);
    if (!ordinary || !precise) return noop("no-future-target");
    const inventory = inspectQueue(queue);
    const id = ordinary.id;
    if (inventory.visible.has(id)) return defer("visible-id");
    const current = inventory.byId.get(id);
    if (current && (!inventory.scheduled.has(id) ||
        (!sameOwner(current, ordinary) && !sameOwner(current, precise)))) return defer("occupied-id");
    // Restoration must obey the full existing priority/cap policy AND never
    // evict unrelated reservations to create space during a cold tap.
    const rolling = buildScopedReminderPlan({ day, timeZone, habits: snapshot.habits },
      { scope, now, daysAhead: 8, habitOptIn: true, wrapupSettings });
    const desired = nativeTarget(rolling, habit.id, day, exact);
    if (!desired) return defer("outside-plan");
    if (current) return sameOwner(current, desired) ? noop("already-scheduled") : defer("occupied-id");
    if (inventory.scheduled.size >= MAX_REMINDERS) return defer("capacity");
    // The 8.3.1 manager can post immediately when a time passes between
    // planning and scheduling. This small conservative margin is not an OS
    // guarantee; the adapter must recheck its clock at the native boundary.
    if (desired.schedule.at.getTime() <= now.getTime() + 2000) return defer("too-close");
    return { kind: "restore", notification: desired };
  } catch {
    return defer("invalid-input");
  }
}
