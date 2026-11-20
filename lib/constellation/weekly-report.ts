import { validDay } from "../habits/domain";
import type { ConstellationGrowth } from "./growth";

const DAY_MS = 24 * 60 * 60 * 1000;

export type WeeklyStarlightDay = {
  /** Local calendar YYYY-MM-DD, Monday first. */
  day: string;
  /** Distinct completed habit IDs from the existing V3.2 growth engine. */
  completedHabits: number;
  /** Existing V3.2 points: capped at 3 per local day. */
  points: number;
  /** Future days are not interpreted as missed practice. */
  isFuture: boolean;
};

export type WeeklyStarlightSummary = {
  startDay: string;
  endDay: string;
  days: WeeklyStarlightDay[];
  totalCompletedHabits: number;
  totalPoints: number;
  practiceDays: number;
  /** An in-progress week is never presented as a finished report. */
  isComplete: boolean;
};

/**
 * Read-only calendar-week projection of the *existing* V3.2 growth calculation.
 *
 * - Korean calendar convention: Monday through Sunday (seven local date keys).
 * - todayDay is already anchored to the account's local timezone.
 * - weeksAgo = 0 is this week, 1 is the previous complete week.
 * - Missing/zero-practice days are neutral: no penalty, denominator or guesses
 *   about scheduled habits are introduced.
 * - Today's history shadow, guest demo exclusions, record edits and 3-point
 *   cap all inherit calculateConstellationGrowth's established rules.
 * - No persistence, mutations or new Stage thresholds.
 */
export function summarizeWeeklyStarlight(
  growth: Pick<ConstellationGrowth, "days">,
  todayDay: string,
  weeksAgo = 0,
): WeeklyStarlightSummary {
  if (!validDay(todayDay)) throw new RangeError("올바른 기준 날짜가 필요합니다.");
  if (!Number.isSafeInteger(weeksAgo) || weeksAgo < 0 || weeksAgo > 520) {
    throw new RangeError("조회 가능한 주간 범위가 아닙니다.");
  }

  const todayUtc = Date.parse(`${todayDay}T12:00:00Z`);
  const dayOfWeek = new Date(todayUtc).getUTCDay(); // Sun=0; Mon=1.
  const mondayOffset = (dayOfWeek + 6) % 7;
  const startUtc = todayUtc - (mondayOffset + weeksAgo * 7) * DAY_MS;
  const toDay = (utc: number) => new Date(utc).toISOString().slice(0, 10);
  const startDay = toDay(startUtc);
  const endDay = toDay(startUtc + 6 * DAY_MS);

  // Growth returns at most one row per valid day. Map guards against accidental
  // duplicate consumption; never sum a repeated day twice.
  const byDay = new Map(
    growth.days.filter((entry) => validDay(entry.day)).map((entry) => [entry.day, entry]),
  );
  const days: WeeklyStarlightDay[] = Array.from({ length: 7 }, (_, index) => {
    const day = toDay(startUtc + index * DAY_MS);
    const isFuture = day > todayDay;
    const record = isFuture ? undefined : byDay.get(day);
    return {
      day,
      completedHabits: record?.completedHabits ?? 0,
      points: record?.points ?? 0,
      isFuture,
    };
  });

  return {
    startDay,
    endDay,
    days,
    totalCompletedHabits: days.reduce((total, day) => total + day.completedHabits, 0),
    totalPoints: days.reduce((total, day) => total + day.points, 0),
    practiceDays: days.filter((day) => day.completedHabits > 0).length,
    isComplete: endDay < todayDay,
  };
}
