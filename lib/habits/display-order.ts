/**
 * Presentation-only ordering for the routine list and upcoming preview.
 *
 * Unfinished habits stay above completed habits; within either group:
 *  - earlier configured HH:mm first, even if that time has already passed;
 *  - no configured time ("자유롭게") last;
 *  - matching times preserve the source/registration order.
 *
 * Never changes persisted positions, records, or the meaning of a due time.
 */
export function sortHabitsForDisplay<T extends { scheduledTime?: string }>(
  habits: readonly T[],
  isCompleted: (habit: T) => boolean = () => false,
): T[] {
  return habits
    .map((habit, index) => ({ habit, index }))
    .sort((a, b) => {
      const completionOrder =
        Number(isCompleted(a.habit)) - Number(isCompleted(b.habit));
      if (completionOrder) return completionOrder;

      const first = a.habit.scheduledTime || "";
      const second = b.habit.scheduledTime || "";
      if (!first && second) return 1;
      if (first && !second) return -1;
      // Valid HH:mm strings compare chronologically as strings.
      if (first !== second) return first < second ? -1 : 1;

      return a.index - b.index;
    })
    .map(({ habit }) => habit);
}
