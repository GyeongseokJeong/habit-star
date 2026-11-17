/** V3.2 approved artwork registry. Art is not the growth-scoring engine. */
/** Stage 5: the user-approved JPEG pixels have been losslessly re-encoded into a valid PNG. SHA below tracks the new PNG bytes (v1.0.1). */
export const CONSTELLATION_ART = [
  { stage: 1, title: "첫 번째 별빛", min: 0, max: 6, width: 1024, height: 1536, sha256: "654cc20d0d42bb2a9731e03278d0726cfe6eae0c70c9d8e7b769e43aa8a920d4", src: "/assets/constellation/stage-01.webp", original: "/assets/constellation/originals/stage-01.png" },
  { stage: 2, title: "별이 모이는 밤", min: 7, max: 19, width: 1024, height: 1536, sha256: "5eaf44c4ee62497deadfb94142506eae42eb933212da4b28e1164900753618aa", src: "/assets/constellation/stage-02.webp", original: "/assets/constellation/originals/stage-02.png" },
  { stage: 3, title: "별빛의 연결", min: 20, max: 49, width: 1024, height: 1536, sha256: "3fcb7360b2148bbb6006547ff902ac4a8ea7d90763c2f44eddac486ccf8d98c6", src: "/assets/constellation/stage-03.webp", original: "/assets/constellation/originals/stage-03.png" },
  { stage: 4, title: "나의 작은 별자리", min: 50, max: 99, width: 1024, height: 1536, sha256: "9c3e4a702520755eb8356c666a38068d17af37af884c585c8880ef03ad16c419", src: "/assets/constellation/stage-04.webp", original: "/assets/constellation/originals/stage-04.png" },
  { stage: 5, title: "찬란한 별자리", min: 100, max: 199, width: 1024, height: 1536, sha256: "0e13d38fab74bf530a9f22f6c57c0f116d58033101eae6d2743a5b374af9ad54", src: "/assets/constellation/stage-05.webp", original: "/assets/constellation/originals/stage-05.png" },
  { stage: 6, title: "빛나는 은하", min: 200, max: null, width: 1254, height: 1254, sha256: "81c7841fc31802df39738ad324db3bda21a62e389edc39f2cbd833a15b1f47bb", src: "/assets/constellation/stage-06.webp", original: "/assets/constellation/originals/stage-06.png" },
] as const;

export type ConstellationStage = (typeof CONSTELLATION_ART)[number];
export type ConstellationStageNumber = ConstellationStage["stage"];

/** Points come from the separately implemented, record-derived Growth Engine. */
export function getConstellationStage(points: number): ConstellationStage {
  if (!Number.isFinite(points) || points < 0 || !Number.isInteger(points)) {
    throw new RangeError("Growth points must be a nonnegative integer");
  }
  for (let i = CONSTELLATION_ART.length - 1; i >= 0; i -= 1) {
    const art = CONSTELLATION_ART[i];
    if (points >= art.min) return art;
  }
  return CONSTELLATION_ART[0];
}

export function getConstellationArtByStage(stage: ConstellationStageNumber): ConstellationStage {
  const art = CONSTELLATION_ART.find((candidate) => candidate.stage === stage);
  if (!art) throw new RangeError("Unknown constellation stage");
  return art;
}
