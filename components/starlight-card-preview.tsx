"use client";

import type { CSSProperties } from "react";
import { Flame, Layers3, Star } from "lucide-react";
import { ConstellationArtwork } from "@/components/constellation-artwork";
import { getConstellationStage } from "@/lib/constellation/art";

/**
 * V5 share-card design contract:
 * - The shareable region is this article alone, always 4:5.
 * - Keep the approved 2:3 Stage artwork intact (object-contain).
 * - Its asset is repeated only as a blurred, decorative background glow.
 * - Stage number and brand each appear once; no account or habit names.
 * - Step 2 can render this same DOM at 1080 × 1350 for PNG export.
 *
 * This step remains read-only: no save/share commands or record mutations.
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
  const cardStyle = {
    "--starlight-stage-art": `url("${stage.src}")`,
  } as CSSProperties;

  return (
    <section className="starlight-preview-screen" aria-label="별빛 카드 미리보기">
      <article
        className="starlight-share-card"
        aria-label={`별빛 카드, 현재 Stage ${stage.stage}`}
        style={cardStyle}
      >
        <header className="starlight-share-head">
          <p className="starlight-share-brand">
            <span aria-hidden="true">✦</span>
            <strong>별하루</strong>
            <small>BYEOLHARU</small>
          </p>
          <h3>작은 실천이 모여<br />빛나는 습관이 되었어요 <span aria-hidden="true">✦</span></h3>
        </header>
        <div className="starlight-share-sky">
          <ConstellationArtwork points={points} stage={stage.stage} className="starlight-share-artwork" />
          <p className="starlight-share-stage">{stage.title}</p>
        </div>
        <dl className="starlight-share-metrics">
          <div>
            <dt><Flame aria-hidden="true" /> 연속 실천</dt>
            <dd>{streak}<span>일</span></dd>
          </div>
          <div>
            <dt><Star aria-hidden="true" /> 누적 실천</dt>
            <dd>{completedHabits}<span>회</span></dd>
          </div>
          <div>
            <dt><Layers3 aria-hidden="true" /> 현재 단계</dt>
            <dd>Stage {stage.stage}</dd>
          </div>
        </dl>
      </article>
    </section>
  );
}
