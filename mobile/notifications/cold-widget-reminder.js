import { MAX_REMINDERS, localDayKey, REMINDER_KIND } from "./reminder-plan.js";
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

/**
 * STEP 4B: pure post-commit decision; external native adapter applies it.
 * Invoke only after the existing widget transaction returned "saved", while
 * the exact verified request is still valid. The complete inventory must be
 * obtained from the same native plugin store plus its visible/scheduled sets;
 * validate each actual storage key against its decoded ID before normalizing.
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
    const previousRatingValid = command.completed ? command.expectedRating === 0
      : command.expectedRating === 0 || command.expectedRating === 5;
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

    // Derive today's potential target from the canonical planner. A past or
    // nonexistent (DST) minute is not safe to restore or recall.
    const candidate = buildScopedReminderPlan({ day, timeZone, habits: [{ ...habit, completed: false }] },
      { scope, now, daysAhead: 1, habitOptIn: true });
    const ordinary = nativeTarget(candidate, habit.id, day, false);
    const precise = nativeTarget(candidate, habit.id, day, true);
    if (!ordinary || !precise) return noop("no-future-target");
    const inventory = inspectQueue(queue);
    const id = ordinary.id;
    if (inventory.visible.has(id)) return defer("visible-id");
    const current = inventory.byId.get(id);
    if (current && (!inventory.scheduled.has(id) ||
        (!sameOwner(current, ordinary) && !sameOwner(current, precise)))) return defer("occupied-id");
    if (command.completed) {
      if (current && ordinary.schedule.at.getTime() <= now.getTime() + 2000) return defer("too-close");
      return current ? { kind: "cancel", expected: sameOwner(current, precise) ? precise : ordinary }
        : noop("already-absent");
    }

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
