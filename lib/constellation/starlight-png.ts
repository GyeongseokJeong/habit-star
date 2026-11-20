/**
 * Captures the approved, live 4:5 Starlight Card only.
 * The dialog frame, controls and surrounding page are never part of the PNG.
 * No remote service, user data upload or changes to the saved habit records.
 */
export const STARLIGHT_PNG_WIDTH = 1080;
export const STARLIGHT_PNG_HEIGHT = 1350;

export function starlightPngFilename(stage: number): string {
  return `byeolharu-starlight-stage-${stage}.png`;
}

async function waitForStageArtwork(card: HTMLElement): Promise<void> {
  const art = card.querySelector<HTMLElement>("[data-constellation-stage]");
  if (!art) throw new Error("별자리 원화를 찾을 수 없습니다.");
  const image = art.querySelector<HTMLImageElement>("img");
  if (!image) throw new Error("별자리 원화가 정상적으로 표시되지 않습니다.");
  if (!image.complete) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        image.removeEventListener("load", loaded);
        image.removeEventListener("error", failed);
      };
      const loaded = () => { cleanup(); resolve(); };
      const failed = () => { cleanup(); reject(new Error("별자리 이미지를 불러오지 못했습니다.")); };
      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", failed, { once: true });
      // The load may have completed between the check and listener install.
      if (image.complete) {
        cleanup();
        if (image.naturalWidth > 0) resolve();
        else reject(new Error("별자리 이미지를 불러오지 못했습니다."));
      }
    });
  }
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error("별자리 이미지를 불러오지 못했습니다.");
  }
  await image.decode();
}

async function stageArtAsDataUrl(card: HTMLElement): Promise<string> {
  const image = card.querySelector<HTMLImageElement>("[data-constellation-stage] img");
  if (!image?.currentSrc && !image?.src) {
    throw new Error("별자리 원화 주소를 찾을 수 없습니다.");
  }
  const response = await fetch(image.currentSrc || image.src);
  if (!response.ok) throw new Error("별자리 이미지 배경을 준비하지 못했습니다.");
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("별자리 이미지 형식이 올바르지 않습니다.");
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("별자리 이미지 배경을 변환하지 못했습니다."));
    };
    reader.onerror = () => reject(new Error("별자리 이미지 배경을 변환하지 못했습니다."));
    reader.readAsDataURL(blob);
  });
}

export async function renderStarlightPng(card: HTMLElement): Promise<Blob> {
  if (!card.classList.contains("starlight-share-card")) {
    throw new Error("별빛 카드 영역을 찾을 수 없습니다.");
  }
  // Force all variable Korean font subsets needed for the visible text to load.
  if (document.fonts) {
    await document.fonts.load('700 18px "Noto Sans KR Variable"', "별하루 작은 실천이 모여 빛나는 습관이 되었어요");
    await document.fonts.ready;
  }
  await waitForStageArtwork(card);

  // The library is downloaded only when the user explicitly requests a PNG.
  const { toBlob } = await import("html-to-image");
  // html-to-image embeds <img> assets but cannot automatically rewrite URL
  // references in ::before background rules. Temporarily supply the loaded
  // approved artwork as an inline data URL so the cloned pseudo-element keeps
  // the same subtle nebula glow as the actual preview.
  const originalArtVariable = card.style.getPropertyValue("--starlight-stage-art");
  const embeddedArt = await stageArtAsDataUrl(card);
  let result: Blob | null = null;
  try {
    card.style.setProperty("--starlight-stage-art", `url("${embeddedArt}")`);
    result = await toBlob(card, {
      canvasWidth: STARLIGHT_PNG_WIDTH,
      canvasHeight: STARLIGHT_PNG_HEIGHT,
      pixelRatio: 1,
      backgroundColor: "#0e1430",
      preferredFontFormat: "woff2",
      cacheBust: true,
    });
  } finally {
    card.style.setProperty("--starlight-stage-art", originalArtVariable);
  }
  if (!result || result.type !== "image/png" || result.size === 0) {
    throw new Error("이미지를 생성하지 못했습니다.");
  }
  // A PNG's IHDR stores its dimensions at offsets 16 and 20.
  const header = new DataView(await result.slice(0, 24).arrayBuffer());
  if (header.getUint32(16) !== STARLIGHT_PNG_WIDTH ||
      header.getUint32(20) !== STARLIGHT_PNG_HEIGHT) {
    throw new Error("저장 이미지의 크기가 올바르지 않습니다.");
  }
  return result;
}

export function downloadStarlightPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Keep the object URL around briefly for slower mobile download handlers.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
