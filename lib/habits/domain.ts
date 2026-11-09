export type TimeGroup = "morning" | "day" | "night";
export type Habit = {
  id: string;
  title: string;
  icon: string;
  timeGroup: TimeGroup;
  scheduledTime?: string;
  alarmEnabled: boolean;
  completed: boolean;
  rating: number;
  memo: string;
};
export type History = Record<string, Habit[]>;
export type Kind = "habits" | "habit_entries" | "days";
export type Payload = Record<string, unknown>;
export type Entity = {
  key: string;
  kind: Kind;
  id: string;
  day: string;
  data: Payload;
  version: number;
  deleted: boolean;
};
export type Change = {
  key: string;
  kind: Kind;
  id: string;
  day: string;
  base: Entity | null;
  data: Payload;
  deleted: boolean;
  seed?: boolean;
};
export type Operation = {
  id: string;
  createdAt?: string;
  changes: Change[];
  conflictId?: string;
  supersedesOperationId?: string;
};
export type Conflict = {
  id: string;
  operation: Operation;
  remote: Entity[];
  resolved: boolean;
};
export const legacyKeys = [
  "byeolharu_v1_habits",
  "byeolharu_v1_history",
  "byeolharu_v1_day",
  "byeolharu_v1_theme",
] as const;
export function dateKey(date: Date, timezone?: string) {
  if (!timezone)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((p) => p.type === type)!.value)
    .join("-");
}
export function validDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number(s.slice(0, 4)) < 1) return false;
  const date = new Date(`${s}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === s
  );
}
export function isHabit(v: unknown): v is Habit {
  if (!v || typeof v !== "object") return false;
  const h = v as Habit;
  return (
    typeof h.id === "string" &&
    !!h.id &&
    typeof h.title === "string" &&
    typeof h.icon === "string" &&
    ["morning", "day", "night"].includes(h.timeGroup) &&
    Number.isInteger(h.rating) &&
    h.rating >= 0 &&
    h.rating <= 5 &&
    typeof h.completed === "boolean" &&
    typeof h.alarmEnabled === "boolean" &&
    typeof h.memo === "string" &&
    (h.scheduledTime === undefined ||
      (typeof h.scheduledTime === "string" &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(h.scheduledTime)))
  );
}
export function stats(habits: Habit[]) {
  const rated = habits.filter((h) => h.rating > 0),
    completed = habits.filter((h) => h.completed).length;
  return {
    completed,
    rate: habits.length ? Math.round((completed / habits.length) * 100) : 0,
    average: rated.length
      ? rated.reduce((n, h) => n + h.rating, 0) / rated.length
      : 0,
  };
}
export const entityKey = (kind: Kind, id: string, day = "") =>
  `${kind}:${day}:${id}`;
export function definition(h: Habit, position: number): Payload {
  return {
    title: h.title,
    icon: h.icon,
    timeGroup: h.timeGroup,
    scheduledTime: h.scheduledTime ?? null,
    alarmEnabled: h.alarmEnabled,
    position,
  };
}
export function entry(h: Habit, position: number): Payload {
  return {
    ...definition(h, position),
    completed: h.completed,
    rating: h.rating,
    memo: h.memo,
  };
}
export function view(entities: Entity[], day: string): Habit[] {
  return entities
    .filter((e) => e.kind === "habit_entries" && e.day === day && !e.deleted)
    .sort(
      (a, b) =>
        Number(a.data.position) - Number(b.data.position) ||
        a.id.localeCompare(b.id),
    )
    .map(
      (e) =>
        ({
          id: e.id,
          ...e.data,
          scheduledTime: e.data.scheduledTime ?? undefined,
        }) as Habit,
    );
}
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const x = a as Payload,
    y = b as Payload;
  return (
    Object.keys(x).length === Object.keys(y).length &&
    Object.keys(x).every((k) => same(x[k], y[k]))
  );
}
// Returns null instead of choosing a winner for overlapping edits.
export function merge(
  base: Payload,
  local: Payload,
  remote: Payload,
): Payload | null {
  const result = { ...remote };
  for (const k of new Set([...Object.keys(base), ...Object.keys(local)])) {
    if (same(base[k], local[k])) continue;
    const group =
      k === "completed" || k === "rating" ? ["completed", "rating"] : [k];
    if (
      group.some((f) => !same(base[f], remote[f]) && !same(local[f], remote[f]))
    )
      return null;
    result[k] = local[k];
  }
  return result;
}
