import { CONSTELLATION_ART, getConstellationStage } from "./art";

export const CONSTELLATION_CAPTIONS = {
  1: "작은 별빛 하나가 태어나,\n나만의 하늘을 밝히기 시작해요.",
  2: "흩어진 별빛이 모여,\n조금씩 형태를 만들어가요.",
  3: "흩어져 있던 별빛이 모여,\n조금씩 하나의 모습이 되어가요.",
  4: "별자리의 윤곽이 완성되며,\n나만의 빛이 자라나요.",
  5: "모여든 별들이 찬란하게 피어나,\n나만의 하늘을 채워가요.",
  6: "완성된 나만의 별자리,\n더 넓은 빛으로 펼쳐 나가요.",
} as const;

export function describeConstellationGrowth(points: number) {
  const art = getConstellationStage(points);
  const next = CONSTELLATION_ART.find((entry) => entry.stage === art.stage + 1);
  const range = art.max === null ? `${art.min}점 이상` : `${art.min} ~ ${art.max}점`;
  return {
    art,
    range,
    caption: CONSTELLATION_CAPTIONS[art.stage],
    next,
    remainingPoints: next ? next.min - points : null,
    progressPercent: next
      ? ((points - art.min) / (next.min - art.min)) * 100
      : 100,
    // Continuous, purely decorative glimmer at Stage 6. No new hidden milestones.
    extraGlow: art.stage === 6
      ? 1 - Math.exp(-Math.max(0, points - 200) / 180)
      : 0,
  };
}
