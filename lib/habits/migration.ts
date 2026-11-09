import {
  type Entity,
  type Habit,
  legacyKeys,
  isHabit,
  validDay,
  entityKey,
  definition,
  entry,
  same,
} from "./domain";
export type LegacyBackup = {
  raw: Record<string, string | null>;
  capturedAt: string;
  sourceId: string;
};
export type RecoveryIssue = { path: string; reason: string; value: unknown };
export type Migration = {
  entities: Entity[];
  issues: RecoveryIssue[];
  mapping: Record<string, string>;
  backup: LegacyBackup;
};
export function captureLegacy(storage: Pick<Storage, "getItem">): LegacyBackup {
  // A thrown read prevents initialization; no defaults may be written.
  return {
    raw: Object.fromEntries(legacyKeys.map((k) => [k, storage.getItem(k)])),
    capturedAt: new Date().toISOString(),
    sourceId: crypto.randomUUID(),
  };
}
export function migrateLegacy(
  backup: LegacyBackup,
  today: string,
  samples: Habit[],
): Migration {
  const issues: RecoveryIssue[] = [],
    mapping: Record<string, string> = {},
    entities: Entity[] = [];
  function parse(key: string, fallback: unknown): unknown {
    const raw = backup.raw[key];
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      issues.push({ path: key, reason: "invalid_json", value: raw });
      return fallback;
    }
  }
  function rows(value: unknown, path: string): Habit[] {
    if (!Array.isArray(value)) {
      issues.push({ path, reason: "invalid_array", value });
      return [];
    }
    const seen = new Set<string>();
    return value.filter((h, i) => {
      if (!isHabit(h) || seen.has(h.id)) {
        issues.push({
          path: `${path}[${i}]`,
          reason: "invalid_or_duplicate_habit",
          value: h,
        });
        return false;
      }
      if (
        !h.title.trim() ||
        h.title.length > 80 ||
        h.icon.length > 100 ||
        h.memo.length > 500 ||
        (h.rating > 0 && !h.completed)
      ) {
        issues.push({
          path: `${path}[${i}]`,
          reason: "cloud_validation_required",
          value: h,
        });
        return false;
      }
      seen.add(h.id);
      mapping[h.id] ??= crypto.randomUUID();
      return true;
    }) as Habit[];
  }
  const rawHistory = parse("byeolharu_v1_history", {});
  const history: Record<string, Habit[]> = {};
  if (
    rawHistory &&
    typeof rawHistory === "object" &&
    !Array.isArray(rawHistory)
  ) {
    for (const [day, value] of Object.entries(rawHistory)) {
      if (!validDay(day)) {
        issues.push({ path: day, reason: "invalid_date", value });
        continue;
      }
      history[day] = rows(value, day);
    }
  } else
    issues.push({
      path: "history",
      reason: "invalid_object",
      value: rawHistory,
    });
  const fresh = legacyKeys.slice(0, 3).every((k) => backup.raw[k] == null);
  const current = rows(
    parse("byeolharu_v1_habits", fresh ? samples : []),
    "habits",
  );
  const storedDay = backup.raw.byeolharu_v1_day;
  if (current.length || backup.raw.byeolharu_v1_habits != null) {
    if (fresh || (storedDay && validDay(storedDay))) {
      const d = fresh ? today : storedDay!;
      if (history[d] && !same(history[d], current))
        issues.push({
          path: d,
          reason: "current_history_mismatch",
          value: history[d],
        });
      history[d] = current;
    } else
      issues.push({
        path: "habits",
        reason: "missing_valid_day",
        value: current,
      });
  }
  const currentIds = new Set(current.map((h) => h.id));
  const definitions = new Map<string, Habit>();
  for (const day of Object.keys(history).sort())
    for (const h of history[day]) definitions.set(h.id, h);
  for (const h of current) definitions.set(h.id, h);
  let position = 0;
  for (const [old, h] of definitions) {
    const id = mapping[old];
    entities.push({
      key: entityKey("habits", id),
      kind: "habits",
      id,
      day: "",
      data: definition(
        h,
        currentIds.has(old)
          ? current.findIndex((x) => x.id === old)
          : current.length + position++,
      ),
      version: 0,
      deleted: !currentIds.has(old),
    });
  }
  for (const [day, habits] of Object.entries(history)) {
    entities.push({
      key: entityKey("days", day, day),
      kind: "days",
      id: day,
      day,
      data: { timezone: null },
      version: 0,
      deleted: false,
    });
    habits.forEach((h, i) => {
      const id = mapping[h.id];
      entities.push({
        key: entityKey("habit_entries", id, day),
        kind: "habit_entries",
        id,
        day,
        data: entry(h, i),
        version: 0,
        deleted: false,
      });
    });
  }
  return { entities, issues, mapping, backup };
}
