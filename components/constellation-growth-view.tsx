"use client";

import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Maximize2, X } from "lucide-react";
import { ConstellationArtwork } from "@/components/constellation-artwork";
import { StarlightCardPreview } from "@/components/starlight-card-preview";
import { CONSTELLATION_ART, type ConstellationStageNumber } from "@/lib/constellation/art";
import { CONSTELLATION_CAPTIONS, describeConstellationGrowth } from "@/lib/constellation/presentation";

/**
 * Read-only gallery. Unlocked artwork follows the current, record-derived Stage;
 * gallery selection never modifies habit history, scoring or cloud state.
 */
export function ConstellationGrowthView({
  points,
  completedHabits,
  streak,
  previewOpen,
  onCreatePreview,
}: {
  points: number;
  completedHabits: number;
  streak: number;
  previewOpen: boolean;
  onCreatePreview: () => void;
}) {
  const { art, next, progressPercent, remainingPoints, extraGlow } =
    describeConstellationGrowth(points);
  const currentStage = art.stage;
  const [selectedStage, setSelectedStage] = useState<ConstellationStageNumber>(currentStage);
  const [departure, setDeparture] = useState<{ stage: ConstellationStageNumber; direction: number; id: number } | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const createCardButton = useRef<HTMLButtonElement>(null);
  const wasPreviewOpen = useRef(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const lastSwipeAt = useRef(0);
  const transitionId = useRef(0);
  const galleryStage = Math.min(selectedStage, currentStage) as ConstellationStageNumber;
  const selectedArt = CONSTELLATION_ART[galleryStage - 1];
  // Keep up to three 44px touch targets without overflowing 320px mobile screens.
  const windowStart = Math.max(1, Math.min(galleryStage - 1, currentStage - 2));
  const visibleStages = CONSTELLATION_ART.filter(
    (item) => item.stage <= currentStage && item.stage >= windowStart && item.stage < windowStart + 3,
  );
  const caption = CONSTELLATION_CAPTIONS[selectedArt.stage];
  const range = selectedArt.max === null ? `${selectedArt.min}점 이상` : `${selectedArt.min} ~ ${selectedArt.max}점`;
  const style = {
    "--constellation-extra-glow": galleryStage === 6 ? extraGlow : 0,
  } as CSSProperties;

  // Returning from preview restores keyboard focus and gallery selection.
  useEffect(() => {
    if (!previewOpen && wasPreviewOpen.current) {
      // The detail may have scrolled to the end on short viewports.
      // Allow focus to reveal the entry again after returning from preview.
      createCardButton.current?.focus();
    }
    wasPreviewOpen.current = previewOpen;
  }, [previewOpen]);

  useEffect(() => {
    if (!departure) return;
    const id = window.setTimeout(() => setDeparture((previous) => previous?.id === departure.id ? null : previous), 340);
    return () => window.clearTimeout(id);
  }, [departure]);

  // In case records were undone while the gallery is open, never show a locked Stage.
  useEffect(() => {
    if (selectedStage > currentStage) {
      setSelectedStage(currentStage);
      setDeparture(null);
    }
  }, [currentStage, selectedStage]);

  function selectStage(stage: number) {
    if (stage < 1 || stage > currentStage || stage === galleryStage) return;
    const nextStage = stage as ConstellationStageNumber;
    transitionId.current += 1;
    setDeparture({ stage: galleryStage, direction: Math.sign(stage - galleryStage), id: transitionId.current });
    setSelectedStage(nextStage);
  }

  function handleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    if (event.touches.length !== 1) return;
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };

  }

  function handleTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    if (!touchStart.current || event.changedTouches.length !== 1) return;
    const deltaX = event.changedTouches[0].clientX - touchStart.current.x;
    const deltaY = event.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.3) return;
    lastSwipeAt.current = Date.now();
    selectStage(galleryStage + (deltaX < 0 ? 1 : -1));
  }

  if (previewOpen) {
    return (
      <StarlightCardPreview
        points={points}
        completedHabits={completedHabits}
        streak={streak}
      />
    );
  }

  return (
    <section className="constellation-growth-view" aria-label="별자리 성장 현황">
      <div className="constellation-card" style={style}>
        <div className="constellation-card-heading" aria-live="polite" aria-atomic="true">
          <span className="constellation-stage-mark">STAGE {selectedArt.stage}</span>
          <h3 className="constellation-card-title">{selectedArt.title}</h3>
          <p className="constellation-score-range">{range}{galleryStage !== currentStage ? " · 지난 별자리" : ""}</p>
        </div>

        <button
          type="button"
          className="constellation-art-trigger"
          aria-label={`${selectedArt.title} 원화 크게 보기`}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => { touchStart.current = null; }}
          onClick={() => {
            // Browsers may or may not synthesize a click after a swipe.
            // A time-bounded guard avoids swallowing the next genuine tap.
            if (Date.now() - lastSwipeAt.current < 350) return;
            setZoomOpen(true);
          }}
        >
          <div key={`current-${galleryStage}-${transitionId.current}`} className={departure ? `constellation-gallery-enter ${departure.direction > 0 ? "forward" : "backward"}` : ""}>
            <ConstellationArtwork points={points} stage={selectedArt.stage} className="constellation-scene" />
          </div>
          {departure && departure.stage <= currentStage && (
            <div key={`previous-${departure.id}`} className={`constellation-gallery-exit ${departure.direction > 0 ? "forward" : "backward"}`} aria-hidden="true">
              <ConstellationArtwork points={points} stage={departure.stage} className="constellation-scene" />
            </div>
          )}
          {departure && <span key={`glimmer-${departure.id}`} className="constellation-gallery-glimmer" aria-hidden="true" />}
          <span className="constellation-expand-hint" aria-hidden="true">
            <Maximize2 size={14} /> 크게 보기
          </span>
        </button>

        {currentStage > 1 && (
          <nav className="constellation-gallery-navigation" aria-label="획득한 별자리 탐색">
            <button type="button" className="constellation-gallery-arrow" aria-label="이전 별자리" disabled={galleryStage === 1} onClick={() => selectStage(galleryStage - 1)}>
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <div className="constellation-gallery-steps" role="group" aria-label={`획득한 단계 ${currentStage}개, 이전·다음 화살표로 모두 탐색 가능`}>
              {visibleStages.map((item) => (
                <button
                  type="button"
                  key={item.stage}
                  className={`constellation-gallery-step${item.stage === galleryStage ? " is-active" : ""}`}
                  aria-label={`Stage ${item.stage} ${item.title}${item.stage === currentStage ? " (현재 단계)" : ""}`}
                  aria-pressed={item.stage === galleryStage}
                  onClick={() => selectStage(item.stage)}
                >
                  <span aria-hidden="true" />
                </button>
              ))}
            </div>
            <button type="button" className="constellation-gallery-arrow" aria-label="다음 별자리" disabled={galleryStage === currentStage} onClick={() => selectStage(galleryStage + 1)}>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </nav>
        )}
        {galleryStage === 6 && (
          <span className="constellation-afterglow" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => <span key={index} />)}
          </span>
        )}
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
      <button
        ref={createCardButton}
        type="button"
        className="constellation-share-entry"
        onClick={onCreatePreview}
      >
        <ImageIcon size={19} aria-hidden="true" />
        <span>별빛 카드 만들기</span>
        <ChevronRight size={19} aria-hidden="true" />
      </button>
      {zoomOpen && (
        <ConstellationZoom
          points={points}
          stage={selectedArt.stage}
          title={selectedArt.title}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </section>
  );
}

function ConstellationZoom({
  points,
  stage,
  title,
  onClose,
}: {
  points: number;
  stage: ConstellationStageNumber;
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
        <ConstellationArtwork points={points} stage={stage} className="constellation-zoom-art" />
      </div>
    </dialog>
  );
}
