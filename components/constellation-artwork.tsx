"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { getConstellationStage, type ConstellationStage } from "@/lib/constellation/art";

/**
 * Artwork-only visual primitive. No record writes, scoring calculation or card copy.
 * Gold frame, stage/score labels, and poetic copy belong to a separate layer.
 * Graceful fallback allows a design PR to be previewed before PNG/WEBP upload.
 */
export function ConstellationArtwork({
  points,
  className = "",
}: {
  points: number;
  className?: string;
}) {
  const art = getConstellationStage(points);
  return <ArtworkForStage key={art.stage} art={art} className={className} />;
}

function ArtworkForStage({ art, className }: { art: ConstellationStage; className: string }) {
  const [loadError, setLoadError] = useState(false);
  useEffect(() => setLoadError(false), [art.src]);
  return (
    <div
      className={`relative mx-auto w-full max-w-[560px] overflow-hidden rounded-2xl bg-[#0b0d26] ${className}`}
      style={{ aspectRatio: `${art.width} / ${art.height}` }}
      data-constellation-stage={art.stage}
    >
      {loadError ? (
        <div role="img" aria-label={`${art.title} 별자리 아트를 불러올 수 없습니다`} className="flex h-full items-center justify-center px-5 text-center text-sm text-[#f5dfb6]">
          <span>✦ {art.title}</span>
        </div>
      ) : (
        <Image
          src={art.src}
          alt={`${art.title} — 별하루 성장 Stage ${art.stage}`}
          fill
          sizes="(max-width: 640px) 92vw, 560px"
          className="object-contain"
          onError={() => setLoadError(true)}
        />
      )}
    </div>
  );
}
