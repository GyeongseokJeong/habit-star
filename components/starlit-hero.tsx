import { ArrowRight } from "lucide-react";
import { getConstellationStage } from "@/lib/constellation/art";

export function StarlitHero({
  points,
  onViewConstellation,
  celebratedStage,
}: {
  points?: number;
  onViewConstellation?: () => void;
  celebratedStage?: number | null;
}) {
  const art = points === undefined ? null : getConstellationStage(points);

  return (
    <section className="starlit-hero" aria-label="나의 별자리 미리보기">
      {art && onViewConstellation ? (
        <button
          type="button"
          className={`starlit-card${celebratedStage ? " starlit-card-celebrating" : ""}`}
          aria-label={`나의 별자리 STAGE ${art.stage} ${art.title} 열기`}
          onClick={onViewConstellation}
        >
          <img
            className="starlit-art"
            src={`/assets/home-constellation/stage-${String(art.stage).padStart(2, "0")}.webp`}
            alt=""
            width={1950}
            height={850}
            fetchPriority="high"
          />
          <span className="starlit-copy" aria-hidden="true">
            <span className="starlit-kicker">STAGE {art.stage}</span>
            <span className="starlit-title">{art.title}</span>
            <ArrowRight className="starlit-arrow" size={19} strokeWidth={1.7} />
          </span>
        </button>
      ) : (
        <div className="starlit-card starlit-card-loading" role="status" aria-label="별자리 불러오는 중">
          <span className="starlit-copy">별자리를 불러오고 있어요</span>
        </div>
      )}
      {celebratedStage ? (
        <span className="sr-only constellation-stage-celebration" role="status" aria-live="polite" aria-atomic="true">
          별자리가 한층 밝아졌어요 · STAGE {celebratedStage}
        </span>
      ) : null}
    </section>
  );
}
