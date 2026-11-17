import { describe, expect, it } from "vitest";
import { describeConstellationGrowth, CONSTELLATION_CAPTIONS } from "../lib/constellation/presentation";

describe("V3.2 constellation card presentation", () => {
  it.each([
    [0, 1, "0 ~ 6점", 7, 0],
    [6, 1, "0 ~ 6점", 1, 6 / 7 * 100],
    [7, 2, "7 ~ 19점", 13, 0],
    [19, 2, "7 ~ 19점", 1, 12 / 13 * 100],
    [20, 3, "20 ~ 49점", 30, 0],
    [49, 3, "20 ~ 49점", 1, 29 / 30 * 100],
    [50, 4, "50 ~ 99점", 50, 0],
    [99, 4, "50 ~ 99점", 1, 49 / 50 * 100],
    [100, 5, "100 ~ 199점", 100, 0],
    [199, 5, "100 ~ 199점", 1, 99],
  ])("shows correct range and progress for %i points", (points, stage, range, remaining, percent) => {
    const result = describeConstellationGrowth(points);
    expect(result.art.stage).toBe(stage);
    expect(result.range).toBe(range);
    expect(result.remainingPoints).toBe(remaining);
    expect(result.progressPercent).toBeCloseTo(percent, 5);
  });

  it("never invents another official stage after 200 points", () => {
    for (const points of [200, 250, 300, 800]) {
      const result = describeConstellationGrowth(points);
      expect(result.art.stage).toBe(6);
      expect(result.range).toBe("200점 이상");
      expect(result.next).toBeUndefined();
      expect(result.remainingPoints).toBeNull();
      expect(result.progressPercent).toBe(100);
    }
    expect(describeConstellationGrowth(201).extraGlow).toBeGreaterThan(0);
    expect(describeConstellationGrowth(500).extraGlow).toBeGreaterThan(
      describeConstellationGrowth(250).extraGlow,
    );
  });

  it("retains one short Korean poem for each approved stage", () => {
    expect(Object.keys(CONSTELLATION_CAPTIONS)).toHaveLength(6);
    expect(describeConstellationGrowth(0).caption).toContain("작은 별빛");
    expect(describeConstellationGrowth(20).caption).toContain("별빛");
    expect(describeConstellationGrowth(200).caption).toContain("별자리");
  });
});
