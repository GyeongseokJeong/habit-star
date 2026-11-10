import type { CSSProperties } from "react";
import { Star } from "lucide-react";

export function StarlitHero({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const progress = total > 0 ? Math.min(1, completed / total) : 0;
  const starStyle = {
    "--star-opacity": 0.28 + progress * 0.72,
    "--star-glow": `${6 + progress * 30}px`,
    "--star-bloom": progress * progress,
    "--star-scale": 0.78 + progress * 0.3,
  } as CSSProperties;
  const message =
    total === 0
      ? "첫 습관을 등록하면 나만의 별빛이 켜져요."
      : completed === total
        ? "오늘의 모든 별이 환하게 빛나요. 수고했어요!"
        : completed === 0
          ? "작은 실천 하나로 첫 별빛을 밝혀보세요."
          : "하나씩 실천할 때마다 별빛이 더 밝아져요.";

  return (
    <section className="starlit-hero" aria-label="오늘의 별빛">
      <div className="starlit-copy">
        <p className="starlit-kicker">TODAY&apos;S LITTLE GALAXY</p>
        <h2>
          작은 실천이 모여,
          <br />
          반짝이는 하루가 돼요.
        </h2>
        <p className="starlit-message">{message}</p>
        <p className="starlit-progress" aria-live="polite">
          <span className="starlit-progress-dot" aria-hidden="true" />
          오늘의 별빛{" "}
          <strong>
            {completed} / {total}
          </strong>
        </p>
      </div>
      <span className="starlit-star" style={starStyle} aria-hidden="true">
        <Star fill="currentColor" />
      </span>
    </section>
  );
}
