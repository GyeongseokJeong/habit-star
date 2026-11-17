/**
 * V3.2 approved stage thresholds and public asset contract.
 * UI-only: calculate total growth points in the domain layer first.
 * Do not infer completed records from the image or stage.
 */
export type ConstellationStage = 1 | 2 | 3 | 4 | 5 | 6;

export type ConstellationStageInfo = Readonly<{
  stage: ConstellationStage;
  name: string;
  minPoints: number;
  maxPoints: number | null;
  src: string;
  width: number;
  height: number;
}>;

export const CONSTELLATION_STAGES: readonly ConstellationStageInfo[] = [
  { stage: 1, name: "첫 번째 별빛", minPoints: 0, maxPoints: 6, src: "/assets/constellation/v3.2/stage-01.webp", width: 1024, height: 1536 },
  { stage: 2, name: "별이 모이는 밤", minPoints: 7, maxPoints: 19, src: "/assets/constellation/v3.2/stage-02.webp", width: 1024, height: 1536 },
  { stage: 3, name: "별빛의 연결", minPoints: 20, maxPoints: 49, src: "/assets/constellation/v3.2/stage-03.webp", width: 1024, height: 1536 },
  { stage: 4, name: "나의 작은 별자리", minPoints: 50, maxPoints: 99, src: "/assets/constellation/v3.2/stage-04.webp", width: 1024, height: 1536 },
  // Stage 5 approved original PNG is smaller than its derivative WebP: use exact approved PNG.
  { stage: 5, name: "찬란한 별자리", minPoints: 100, maxPoints: 199, src: "/assets/constellation/v3.2/stage-05.png", width: 1024, height: 1536 },
  // Stage 6 original is square: never stretch it into a portrait ratio.
  { stage: 6, name: "빛나는 은하", minPoints: 200, maxPoints: null, src: "/assets/constellation/v3.2/stage-06.webp", width: 1254, height: 1254 },
] as const;

export function getConstellationStage(totalPoints: number): ConstellationStageInfo {
  const points = Number.isFinite(totalPoints) ? Math.max(0, Math.floor(totalPoints)) : 0;
  for (let i = CONSTELLATION_STAGES.length - 1; i >= 0; i -= 1) {
    if (points >= CONSTELLATION_STAGES[i].minPoints) {
      return CONSTELLATION_STAGES[i];
    }
  }
  return CONSTELLATION_STAGES[0];
}

export function pointsToNextStage(totalPoints: number): number | null {
  const stage = getConstellationStage(totalPoints);
  if (stage.stage === 6) return null;
  const next = CONSTELLATION_STAGES[stage.stage];
  return Math.max(0, next.minPoints - Math.max(0, Math.floor(totalPoints)));
}
