"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Download, Share2 } from "lucide-react";
import { Flame, Layers3, Star } from "lucide-react";
import { convertStarlightPngToJpeg, downloadStarlightPng, renderStarlightPng, starlightJpegFilename, starlightPngFilename } from "@/lib/constellation/starlight-png";
import { ConstellationArtwork } from "@/components/constellation-artwork";
import { getConstellationStage } from "@/lib/constellation/art";

/**
 * V5 share-card design contract:
 * - The shareable region is this article alone, always 4:5.
 * - Keep the approved 2:3 Stage artwork intact (object-contain).
 * - Its asset is repeated only as a blurred, decorative background glow.
 * - Stage number and brand each appear once; no account or habit names.
 * - The same DOM is rendered at 1080 × 1350 for PNG and file sharing.
 * - Browser share is feature detected; native Android WebView requires a separate bridge.
 * - No automatic posting or habit-record changes.
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
  const cardRef = useRef<HTMLElement>(null);
  const pngPromiseRef = useRef<Promise<Blob> | null>(null);
  const captureKeyRef = useRef("");
  const shareFileRef = useRef<File | null>(null);
  const preparationIdRef = useRef(0);
  const [saving, setSaving] = useState(false);
  const [savingJpeg, setSavingJpeg] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareState, setShareState] = useState<"checking" | "preparing" | "ready" | "unsupported" | "failed">("checking");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const cacheKey = `${points}:${completedHabits}:${streak}:${stage.stage}`;

  function getPng(): Promise<Blob> {
    if (!cardRef.current) return Promise.reject(new Error("별빛 카드 영역을 찾을 수 없습니다."));
    if (!pngPromiseRef.current) {
      const promise = renderStarlightPng(cardRef.current);
      pngPromiseRef.current = promise;
      // A failed render should not poison a later retry or the Save button.
      void promise.catch(() => {
        if (pngPromiseRef.current === promise) pngPromiseRef.current = null;
      });
    }
    return pngPromiseRef.current;
  }

  function prepareShare() {
    const requestId = ++preparationIdRef.current;
    shareFileRef.current = null;
    setShareState("preparing");
    void getPng().then((png) => {
      if (requestId !== preparationIdRef.current) return;
      const file = new File([png], starlightPngFilename(stage.stage), { type: "image/png" });
      try {
        if (typeof navigator.share === "function" &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [file] })) {
          shareFileRef.current = file;
          setShareState("ready");
        } else {
          setShareState("unsupported");
        }
      } catch {
        setShareState("unsupported");
      }
    }).catch(() => {
      if (requestId === preparationIdRef.current) setShareState("failed");
    });
  }

  useEffect(() => {
    // Keep a single in-flight capture even when StrictMode replays effects.
    // Invalidate the cached image if live growth records change.
    if (captureKeyRef.current !== cacheKey) {
      pngPromiseRef.current = null;
      captureKeyRef.current = cacheKey;
    }
    shareFileRef.current = null;
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") {
      setShareState("unsupported");
      return () => { preparationIdRef.current += 1; };
    }
    prepareShare();
    return () => { preparationIdRef.current += 1; };
  }, [cacheKey]);

  async function handleSave() {
    if (!cardRef.current || saving || sharing || savingJpeg) return;
    setSaving(true);
    setFeedback(null);
    try {
      const png = await getPng();
      downloadStarlightPng(png, starlightPngFilename(stage.stage));
      setFeedback({ kind: "success", text: "PNG 이미지 저장을 요청했어요." });
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "이미지 저장에 실패했습니다. 다시 시도해 주세요.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleJpegSave() {
    if (!cardRef.current || saving || sharing || savingJpeg) return;
    setSavingJpeg(true);
    setFeedback(null);
    try {
      const jpeg = await convertStarlightPngToJpeg(await getPng());
      downloadStarlightPng(jpeg, starlightJpegFilename(stage.stage));
      setFeedback({ kind: "success", text: "JPG 이미지 저장을 요청했어요." });
    } catch (error) {
      setFeedback({
        kind: "error",
        text: error instanceof Error ? error.message : "JPG 저장에 실패했습니다. 다시 시도해 주세요.",
      });
    } finally {
      setSavingJpeg(false);
    }
  }

  function handleShareError(error: unknown) {
    if (error && typeof error === "object" && "name" in error && error.name === "AbortError") {
      // Closing the system share chooser is a normal user decision.
      return;
    }
    setFeedback({
      kind: "error",
      text: "이미지를 공유하지 못했어요. 다시 시도하거나 이미지 저장을 이용해 주세요.",
    });
  }

  function handleShare() {
    const file = shareFileRef.current;
    if (!file || shareState !== "ready" || saving || savingJpeg || sharing || typeof navigator.share !== "function") return;
    setSharing(true);
    setFeedback(null);
    // IMPORTANT: invoke share() synchronously from this click event. Awaiting
    // PNG creation here would lose the transient user activation on mobile.
    try {
      const task = navigator.share({ files: [file], title: "별하루 별빛 카드" });
      void task.then(() => {
        setFeedback({ kind: "success", text: "공유 요청을 전달했어요." });
      }).catch(handleShareError).finally(() => setSharing(false));
    } catch (error) {
      handleShareError(error);
      setSharing(false);
    }
  }

  const cardStyle = {
    "--starlight-stage-art": `url("${stage.src}")`,
  } as CSSProperties;

  return (
    <section className="starlight-preview-screen" aria-label="별빛 카드 미리보기">
      <article
        ref={cardRef}
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
      <div className="starlight-actions">
        <button
          type="button"
          className="starlight-save-button"
          disabled={saving || savingJpeg || sharing}
          aria-busy={saving}
          onClick={handleSave}
        >
          <Download size={19} aria-hidden="true" />
          {saving ? "이미지 준비 중…" : "이미지 저장"}
        </button>
        {shareState !== "checking" && shareState !== "unsupported" && (
          <button
            type="button"
            className="starlight-share-button"
            disabled={shareState === "preparing" || saving || savingJpeg || sharing}
            aria-busy={shareState === "preparing" || sharing}
            onClick={shareState === "failed" ? prepareShare : handleShare}
          >
            <Share2 size={19} aria-hidden="true" />
            {shareState === "preparing"
              ? "공유 준비 중…"
              : shareState === "failed"
                ? "공유 다시 준비"
                : sharing
                  ? "공유 중…"
                  : "이미지 공유"}
          </button>
        )}
      </div>
      <details className="starlight-instagram-help">
        <summary>인스타그램에서 게시 화면이 안 열리나요?</summary>
        <p>인스타그램 앱이 열려도 게시 화면으로 연결되지 않을 수 있어요. 이미지를 저장한 다음 인스타그램에서 + → 게시물로 직접 선택해 보세요.</p>
        <p>같은 문제가 반복되면 JPG 이미지로도 비교할 수 있어요. JPG가 문제 해결을 보장하지는 않습니다.</p>
        <button
          type="button"
          className="starlight-jpeg-save-button"
          disabled={saving || savingJpeg || sharing}
          aria-busy={savingJpeg}
          onClick={handleJpegSave}
        >
          <Download size={17} aria-hidden="true" />
          {savingJpeg ? "JPG 준비 중…" : "JPG로 저장"}
        </button>
      </details>
      {shareState === "unsupported" && (
        <p className="starlight-share-hint">이 환경에서는 이미지를 저장한 뒤 공유해 주세요.</p>
      )}
      <p
        role="status"
        aria-live="polite"
        className={`starlight-save-feedback ${feedback?.kind === "error" ? "is-error" : ""}`}
      >
        {feedback?.text ?? ""}
      </p>
    </section>
  );
}
