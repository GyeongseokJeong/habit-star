import { entityKey, isScheduled, validDay, view, type Entity } from "./domain";
import { getFirstUseState } from "./onboarding";
import type { Snapshot, State } from "./repository";

/** Internal command only. Never expose account identifiers to the launcher. */
export type WidgetPracticeCommand = {
  scope: string;
  day: string;
  habitId: string;
  revision: number;
  version: number;
  expectedCompleted: boolean;
  expectedRating: number;
  completed: boolean;
};
export type WidgetPracticeResult = "saved" | "invalid" | "wrong-scope" | "stale" |
  "not-ready" | "unavailable" | "conflict" | "requires-detail";

type Validation = { kind: "ready"; base: Entity; rating: 0 | 5 } | { kind: Exclude<WidgetPracticeResult, "saved"> };

function validCommand(c: WidgetPracticeCommand): boolean {
  return !!c && typeof c.scope === "string" && !!c.scope &&
    typeof c.day === "string" && validDay(c.day) &&
    typeof c.habitId === "string" && !!c.habitId.trim() &&
    Number.isSafeInteger(c.revision) && c.revision >= 0 &&
    Number.isSafeInteger(c.version) && c.version >= 0 &&
    typeof c.expectedCompleted === "boolean" && typeof c.completed === "boolean" &&
    c.expectedCompleted !== c.completed &&
    Number.isInteger(c.expectedRating) && c.expectedRating >= 0 && c.expectedRating <= 5;
}

/** Quick practice defaults to five stars; an explicit undo resets to zero.
 * All valid completed ratings (0–5) can be explicitly undone, regardless
 * of where they were recorded. Inconsistent incomplete rated records
 * still require the editor.
 */
export function widgetPracticeTargetRating(command: WidgetPracticeCommand): 0 | 5 | null {
  if (command.completed && !command.expectedCompleted && command.expectedRating === 0) return 5;
  if (!command.completed && command.expectedCompleted &&
      Number.isInteger(command.expectedRating) && command.expectedRating >= 0 && command.expectedRating <= 5) return 0;
  return null;
}

/** Derive an explicit target from a verified, committed snapshot; not a toggle. */
export function createWidgetPracticeCommand(snapshot: Snapshot, scope: string, habitId: string): WidgetPracticeCommand | null {
  const habit = snapshot.habits.find(h => h.id === habitId);
  const base = snapshot.state.entities[entityKey("habit_entries", habitId, snapshot.day)];
  if (!habit || !base) return null;
  const command: WidgetPracticeCommand = {
    scope, day: snapshot.day, habitId, revision: snapshot.state.localRevision ?? 0,
    version: base.version, expectedCompleted: habit.completed, expectedRating: habit.rating,
    completed: !habit.completed,
  };
  const result = validateWidgetPractice(command, scope, snapshot.day, snapshot.state, scope.startsWith("member:"));
  // Protected records can still be routed to detail by a future UI.
  return result.kind === "ready" || result.kind === "requires-detail" ? command : null;
}

/** Recheck every condition inside the existing IndexedDB read/write transaction.
 * Revision/version prevent stale commands from overwriting a newer record,
 * even when the same check state has reappeared (ABA).
 */
export function validateWidgetPractice(
  command: WidgetPracticeCommand, scope: string, day: string, state: State, member: boolean,
): Validation {
  if (!validCommand(command)) return { kind: "invalid" };
  if (command.scope !== scope) return { kind: "wrong-scope" };
  if (command.day !== day) return { kind: "stale" };
  if ((member && state.hydrated !== true) ||
      !state.entities[entityKey("days", day, day)] ||
      state.entities[entityKey("days", day, day)].deleted) return { kind: "not-ready" };
  if (state.importLock && state.importLock.until > Date.now()) return { kind: "not-ready" };
  if ((state.localRevision ?? 0) !== command.revision) return { kind: "stale" };
  const definition = state.entities[entityKey("habits", command.habitId)];
  const base = state.entities[entityKey("habit_entries", command.habitId, day)];
  if (!definition || definition.deleted || !base || base.deleted) return { kind: "unavailable" };
  const habits = view(Object.values(state.entities), day);
  const habit = habits.find(h => h.id === command.habitId);
  if (!habit || !isScheduled(habit, day)) return { kind: "unavailable" };
  if (getFirstUseState({ day, habits, history: { [day]: habits }, state }, member).sampleIds.has(command.habitId))
    return { kind: "unavailable" };
  if (state.conflicts.some(c => !c.resolved && c.operation.changes.some(change => change.id === command.habitId)))
    return { kind: "conflict" };
  if (base.version !== command.version || habit.completed !== command.expectedCompleted ||
      habit.rating !== command.expectedRating) return { kind: "stale" };
  // Derive the rating only after matching the committed record. Never accept
  // a caller-provided target rating or overwrite an inconsistent record.
  const rating = widgetPracticeTargetRating(command);
  if (rating === null) return { kind: "requires-detail" };
  return { kind: "ready", base, rating };
}
