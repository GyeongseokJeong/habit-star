import { dateKey, isScheduled, validDay, type Habit } from "./domain";
import { startupDataReady } from "./time-tab";

export type HabitReminderTarget = { scope: string; day: string; habitId: string };
export type HabitReminderNavigation = HabitReminderTarget & { serial: number; source?: "widget" };

/** Android payload is untrusted routing data, not authority to access/write a record. */
export function parseHabitReminder(value: unknown): HabitReminderTarget | null {
  if (!value || typeof value !== "object") return null;
  const extra = value as Record<string, unknown>;
  if (extra.kind !== "byeolharu-habit-reminder-v1" || extra.category !== "habit" ||
      typeof extra.scope !== "string" ||
      !(extra.scope === "guest" || (extra.scope.startsWith("member:") && extra.scope.slice(7).trim())) ||
      typeof extra.day !== "string" || !validDay(extra.day) ||
      typeof extra.habitId !== "string" || !extra.habitId.trim()) return null;
  return { scope: extra.scope, day: extra.day, habitId: extra.habitId };
}

type Context = {
  snapshot: { day: string; history: Record<string, unknown>; state: { hydrated?: boolean; timezone: string } } | null;
  memberId: string | null;
  habits: readonly Habit[];
  now: Date;
  blocked: boolean;
};
type Result = { kind: "wait" } | { kind: "ignore" } | { kind: "open"; habit: Habit };

/** Wait for auth/rollover hydration; reject stale, completed, or foreign targets.
 * Never dismiss an existing editor/confirmation to satisfy an incoming tap.
 * No repository writes, permission prompts, or notification scheduling. */
export function resolveHabitReminder(target: HabitReminderTarget & { source?: "widget" }, ctx: Context): Result {
  if (!ctx.snapshot || !startupDataReady(Boolean(ctx.memberId), ctx.snapshot)) return { kind: "wait" };
  const scope = ctx.memberId ? "member:" + ctx.memberId : "guest";
  if (target.scope !== scope || ctx.blocked) return { kind: "ignore" };
  const today = dateKey(ctx.now, ctx.memberId ? ctx.snapshot.state.timezone : undefined);
  if (target.day !== today) return { kind: "ignore" };
  if (ctx.snapshot.day !== today) return { kind: "wait" };
  const habit = ctx.habits.find(h => h.id === target.habitId);
  if (!habit || !isScheduled(habit, today) ||
      (target.source !== "widget" && (habit.completed || !habit.alarmEnabled || !habit.scheduledTime))) {
    return { kind: "ignore" };
  }
  return { kind: "open", habit };
}
