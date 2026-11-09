import { describe, it, expect } from "vitest";
import { dateKey, validDay, stats, merge } from "../lib/habits/domain";
import { migrateLegacy, captureLegacy } from "../lib/habits/migration";
const h = {
  id: "legacy",
  title: "물",
  icon: "💧",
  timeGroup: "morning" as const,
  alarmEnabled: false,
  completed: true,
  rating: 0,
  memo: "기억",
};
const raw = (overrides: Record<string, string | null> = {}) => ({
  sourceId: "source",
  capturedAt: "now",
  raw: {
    byeolharu_v1_habits: JSON.stringify([h]),
    byeolharu_v1_history: "{}",
    byeolharu_v1_day: "2026-11-09",
    byeolharu_v1_theme: "dark",
    ...overrides,
  },
});
describe("legacy preservation", () => {
  it("preserves checked-without-rating and old day snapshots", () => {
    const b = raw(),
      r = migrateLegacy(b, "2026-11-10", []);
    expect(r.backup).toEqual(b);
    expect(r.issues).toEqual([]);
    expect(
      r.entities.find((e) => e.kind === "habit_entries")?.data,
    ).toMatchObject({ completed: true, rating: 0, memo: "기억" });
    expect(r.entities.some((e) => e.day === "2026-11-10")).toBe(false);
  });
  it("never silently replaces malformed JSON with samples", () => {
    const b = raw({ byeolharu_v1_habits: "{broken" }),
      r = migrateLegacy(b, "2026-11-10", [h]);
    expect(r.issues[0].reason).toBe("invalid_json");
    expect(r.entities.filter((e) => e.kind !== "days")).toEqual([]);
    expect(b.raw.byeolharu_v1_habits).toBe("{broken");
  });
  it("retains mismatched duplicate date, invalid date and duplicate IDs in recovery", () => {
    const b = raw({
      byeolharu_v1_history: JSON.stringify({
        "2026-11-09": [{ ...h, memo: "other" }],
        "2026-02-30": [h],
        "2026-11-08": [h, h],
      }),
    });
    const r = migrateLegacy(b, "2026-11-10", []);
    expect(r.issues.map((x) => x.reason)).toEqual(
      expect.arrayContaining([
        "current_history_mismatch",
        "invalid_date",
        "invalid_or_duplicate_habit",
      ]),
    );
    expect(r.backup).toEqual(b);
  });
  it("preserves empty habits without creating samples", () =>
    expect(
      migrateLegacy(raw({ byeolharu_v1_habits: "[]" }), "2026-11-10", [h])
        .entities,
    ).toEqual([expect.objectContaining({ kind: "days" })]));
  it("does not invent a missing day", () => {
    const r = migrateLegacy(raw({ byeolharu_v1_day: null }), "2026-11-10", []);
    expect(r.issues[0].reason).toBe("missing_valid_day");
    expect(r.entities.some((e) => e.kind === "habit_entries")).toBe(false);
  });
  it("propagates storage read failure", () =>
    expect(() =>
      captureLegacy({
        getItem: () => {
          throw Error("blocked");
        },
      }),
    ).toThrow("blocked"));
});
describe("dates and semantics", () => {
  it("validates real dates including leap days", () => {
    expect(validDay("2024-02-29")).toBe(true);
    expect(validDay("2026-02-29")).toBe(false);
    expect(validDay("2026-99-99")).toBe(false);
  });
  it("uses the account timezone across DST and midnight", () => {
    expect(dateKey(new Date("2026-11-09T15:00:00Z"), "Asia/Seoul")).toBe(
      "2026-11-10",
    );
    expect(dateKey(new Date("2026-11-01T06:30:00Z"), "America/New_York")).toBe(
      "2026-11-01",
    );
  });
  it("does not average unrated completion", () =>
    expect(stats([h, { ...h, id: "b", rating: 4 }])).toEqual({
      completed: 2,
      rate: 100,
      average: 4,
    }));
  it("merges disjoint fields but preserves rating conflicts", () => {
    expect(
      merge(
        { memo: "", title: "a" },
        { memo: "x", title: "a" },
        { memo: "", title: "b" },
      ),
    ).toEqual({ memo: "x", title: "b" });
    expect(
      merge(
        { rating: 0, completed: false },
        { rating: 0, completed: true },
        { rating: 5, completed: true },
      ),
    ).toBeNull();
  });
});
