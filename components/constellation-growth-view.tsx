"use client";

import type { CSSProperties } from "react";
import { ConstellationArtwork } from "@/components/constellation-artwork";
import { describeConstellationGrowth } from "@/lib/constellation/presentation";

/**
 * V3.2 signature presentation: approved art and separately rendered text/frame.
 * Read-only; no updates to completion, history, or sync state.
 */
export function ConstellationGrowthView({ points }: { points: number }) {
  const { art, caption, range, next, progressPercent, remainingPoints, extraGlow } =
    describeConstellationGrowth(points);
  const style = {
    "--constellation-extra-glow": extraGlow,
  } as CSSProperties;

  return (
    <section className="constellation-growth-view" aria-label="별자리 성장 현황">
      <div className="constellation-card" style={style}>
        <span className="constellation-finial" aria-hidden="true">✦</span>
        <div className="constellation-card-heading">
          <span className="constellation-stage-mark">STAGE {art.stage}</span>
          <h3 className="constellation-card-title">{art.title}</h3>
          <p className="constellation-score-range">{range}</p>
        </div>

        <ConstellationArtwork
          points={points}
          className="constellation-scene"
        />

        <p className="constellation-poem">{caption}</p>
        <span className="constellation-card-foot" aria-hidden="true">✧</span>
      </div>

      <div className="constellation-growth-summary">
        <div className="constellation-growth-numbers">
          <span>지금까지 모은 별빛</span>
          <strong aria-live="polite">{points}점</strong>
        </div>
        {next ? (
          <>
            <div
              className="constellation-growth-track"
              role="progressbar"
              aria-label={`Stage ${next.stage}까지의 별빛 성장`}
              aria-valuemin={art.min}
              aria-valuemax={next.min}
              aria-valuenow={points}
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="constellation-growth-next">
              다음 별자리까지 <strong>{remainingPoints}점</strong>
            </p>
          </>
        ) : (
          <p className="constellation-growth-complete">
            ✦ 별빛은 앞으로도 조금씩 더 풍성해져요.
          </p>
        )}
      </div>
    </section>
  );
}
