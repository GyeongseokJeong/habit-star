import type { Habit } from "./domain";
import type { Snapshot } from "./repository";
import { isFreshGuestDemo } from "../constellation/growth";

/**
 * UI-only classification. The original guest examples remain local records;
 * this must not rewrite history, change stats, or silently turn examples into
 * real user-created definitions.
 */
export function getFirstUseState(snapshot: Snapshot, isMember: boolean) {
  const hydrated = !isMember || snapshot.state.hydrated === true;
  const demo = !isMember && isFreshGuestDemo(snapshot.state);
  const sampleIds = new Set<string>(
    demo
      ? snapshot.state.migration?.entities
          .filter((entity) => entity.kind === "habits")
          .map((entity) => entity.id) ?? []
      : [],
  );
  const entities = Object.values(snapshot.state.entities);
  const hasCreatedHabit = entities.some(
    (entity) => entity.kind === "habits" && !sampleIds.has(entity.id),
  );
  const hasUserHistory = entities.some(
    (entity) => entity.kind === "habit_entries" && !sampleIds.has(entity.id),
  );
  // Legacy guests with actual data must never see the sample-only introduction.
  // A fresh demo stays eligible after an example is explored; only a real
  // user-created habit or non-example history ends the invitation.
  const showHint = hydrated && (
    isMember
      ? !hasCreatedHabit && !hasUserHistory
      : demo && !hasCreatedHabit && !hasUserHistory
  );
  const hasRealCompletion = entities.some(
    (entity) => entity.kind === "habit_entries" && !entity.deleted &&
      !sampleIds.has(entity.id) && entity.data.completed === true,
  );
  return { hydrated, sampleIds, showHint, hasRealCompletion };
}

/** Only an intentional first completion of a user-created habit can celebrate. */
export function canCelebrateFirstPractice(
  snapshot: Snapshot,
  isMember: boolean,
  habit: Habit,
  nextCompleted: boolean,
): boolean {
  const state = getFirstUseState(snapshot, isMember);
  return state.hydrated && !state.sampleIds.has(habit.id) &&
    !state.hasRealCompletion && !habit.completed && nextCompleted &&
    Object.values(snapshot.state.entities).some(
      (entity) => entity.kind === "habits" && !entity.deleted &&
        entity.id === habit.id,
    );
}
