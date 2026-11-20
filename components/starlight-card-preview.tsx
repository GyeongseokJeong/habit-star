"use client";

import { ConstellationArtwork } from "@/components/constellation-artwork";
import { getConstellationStage } from "@/lib/constellation/art";

/**
 * V5 STEP 1: read-only card preview.
 * This uses existing, record-derived growth data and approved Stage artwork.
 * PNG export and platform sharing belong to a later, separately reviewed step.
 */
export function StarlightCardPreview({
  points,
  completedHabits,
  streak,
}: {
  points: number;
  completedHabits: number;
  streak: number;
}) {
  const stage = getConstellationStage(points);

  return (
    <section className="starlight-preview-screen" aria-label="별빛 카드 미리보기">
      <article className="starlight-share-card" aria-label={`별빛 카드, 현재 Stage ${stage.stage}`}>
        <div className="starlight-share-head">
          <span className="starlight-share-kicker">BYEOLHARU · MY STARLIGHT</span>
          <h3>작은 실천이 모여<br />빛나는 습관이 되었어요 <span aria-hidden="true">✦</span></h3>
        </div>
        <div className="starlight-share-sky">
          <ConstellationArtwork points={points} stage={stage.stage} className="starlight-share-artwork" />
          <p className="starlight-share-stage">STAGE {stage.stage} · {stage.title}</p>
        </div>
        <dl className="starlight-share-metrics">
          <div>
            <dt>연속 실천</dt>
            <dd>{streak}<span>일</span></dd>
          </div>
          <div>
            <dt>누적 실천</dt>
            <dd>{completedHabits}<span>회</span></dd>
          </div>
          <div>
            <dt>현재 단계</dt>
            <dd>Stage {stage.stage}</dd>
          </div>
        </dl>
        <p className="starlight-share-brand"><span aria-hidden="true">✦</span> 별하루 <small>BYEOLHARU</small></p>
      </article>
      <p className="starlight-preview-footnote">나의 기록을 담은 별빛 카드 미리보기</p>
    </section>
  );
}
