"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Maximize2, X } from "lucide-react";
import { ConstellationArtwork } from "@/components/constellation-artwork";
import { describeConstellationGrowth } from "@/lib/constellation/presentation";

/**
 * V3.2 signature presentation: approved art and separately rendered text/frame.
 * Read-only; no updates to completion, history, or sync state.
 */
export function ConstellationGrowthView({ points }: { points: number }) {
  const { art, caption, range, next, progressPercent, remainingPoints, extraGlow } =
    describeConstellationGrowth(points);
  const [zoomOpen, setZoomOpen] = useState(false);
  const style = {
    "--constellation-extra-glow": extraGlow,
  } as CSSProperties;

  return (
    <section className="constellation-growth-view" aria-label="별자리 성장 현황">
      <div className="constellation-card" style={style}>
        <div className="constellation-card-heading">
          <span className="constellation-stage-mark">STAGE {art.stage}</span>
          <h3 className="constellation-card-title">{art.title}</h3>
          <p className="constellation-score-range">{range}</p>
        </div>

        <button
          type="button"
          className="constellation-art-trigger"
          aria-label={`${art.title} 원화 크게 보기`}
          onClick={() => setZoomOpen(true)}
        >
          <ConstellationArtwork points={points} className="constellation-scene" />
          <span className="constellation-expand-hint" aria-hidden="true">
            <Maximize2 size={14} /> 크게 보기
          </span>
        </button>

        <p className="constellation-poem">{caption}</p>
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
            별빛은 앞으로도 조금씩 더 풍성해져요.
          </p>
        )}
      </div>
      {zoomOpen && (
        <ConstellationZoom
          points={points}
          title={art.title}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </section>
  );
}

function ConstellationZoom({
  points,
  title,
  onClose,
}: {
  points: number;
  title: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="constellation-zoom"
      aria-label={`${title} 원화 확대 감상`}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="constellation-zoom-content">
        <div className="constellation-zoom-top">
          <p>{title}</p>
          <button type="button" className="constellation-zoom-close" aria-label="확대 감상 닫기" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <ConstellationArtwork points={points} className="constellation-zoom-art" />
      </div>
    </dialog>
  );
}
