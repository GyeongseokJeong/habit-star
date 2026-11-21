import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Android-only: share the exact 1080x1350 PNG produced by the existing
 * Starlight Card renderer. Only a disposable image is written to app cache.
 * No external storage permission, user records, network upload or auto-post.
 */
export async function shareStarlightPngOnAndroid(png: Blob, filename: string): Promise<void> {
  if (png.type !== "image/png" || png.size === 0) {
    throw new Error("공유할 PNG 이미지가 준비되지 않았습니다.");
  }
  if (!/^byeolharu-starlight-stage-[1-6]\.png$/.test(filename)) {
    throw new Error("지원하지 않는 별빛 카드 파일 이름입니다.");
  }
  // Filesystem expects raw base64 for binary files, not a data: URL.
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("이미지 변환에 실패했습니다."));
        return;
      }
      const separator = reader.result.indexOf(",");
      if (separator < 0) reject(new Error("이미지 변환에 실패했습니다."));
      else resolve(reader.result.slice(separator + 1));
    };
    reader.onerror = () => reject(new Error("이미지 변환에 실패했습니다."));
    reader.readAsDataURL(png);
  });
  // Capacitor Android Share's FileProvider exposes app cache by default.
  await Filesystem.writeFile({ directory: Directory.Cache, path: filename, data });
  const { uri } = await Filesystem.getUri({ directory: Directory.Cache, path: filename });
  await Share.share({
    title: "별하루 별빛 카드",
    files: [uri],
    dialogTitle: "별빛 카드 공유",
  });
}
