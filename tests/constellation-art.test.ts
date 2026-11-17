import { describe, expect, it } from "vitest";
import { CONSTELLATION_ART, getConstellationArtByStage, getConstellationStage } from "../lib/constellation/art";

describe("approved V3.2 constellation visual asset mapping", () => {
  it.each([
    [0, 1], [6, 1], [7, 2], [19, 2], [20, 3], [49, 3],
    [50, 4], [99, 4], [100, 5], [199, 5], [200, 6], [201, 6], [9999, 6],
  ])("maps %i growth points to Stage %i", (points, stage) => {
    expect(getConstellationStage(points).stage).toBe(stage);
  });

  it("rejects invalid points rather than hiding a scoring bug", () => {
    for (const points of [-1, 0.5, Number.NaN, Infinity, -Infinity]) {
      expect(() => getConstellationStage(points)).toThrow(RangeError);
    }
  });

  it("keeps the exact approval identities and undistorted dimensions", () => {
    expect(CONSTELLATION_ART).toHaveLength(6);
    for (const entry of CONSTELLATION_ART) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry.src).toMatch(/^\/assets\/constellation\/stage-0[1-6]\.webp$/);
      expect(entry.original).toMatch(/^\/assets\/constellation\/originals\/stage-0[1-6]\.png$/);
      expect(entry.width).toBe(entry.stage === 6 ? 1254 : 1024);
      expect(entry.height).toBe(entry.stage === 6 ? 1254 : 1536);
      expect(getConstellationArtByStage(entry.stage)).toBe(entry);
    }
  });
});
