export type UpdateStatus = "checking" | "unavailable" | "unknown" | "latest" | "available" | "downloading" | "downloaded";
export type UpdateInfo = { status: UpdateStatus; versionCode?: number };
export type NativeUpdateControls = {
  info: UpdateInfo;
  busy: boolean;
  notice: boolean;
  error: boolean;
  dismiss: () => void;
  act: () => void;
};

export const updateNoticeKey = "byeolharu_play_update_notice_v1";
export function updateOfferKey(info: UpdateInfo): string | null {
  return (info.status === "available" || info.status === "downloaded") &&
    Number.isInteger(info.versionCode) && info.versionCode! > 0
    ? `${info.versionCode}:${info.status}` : null;
}
export function shouldShowUpdateNotice(info: UpdateInfo, dismissed: readonly string[]) {
  const offer = updateOfferKey(info);
  return offer !== null && !dismissed.includes(offer);
}
export function rememberUpdateOffer(dismissed: readonly string[], offer: string) {
  return [...new Set([...dismissed, offer])].slice(-12);
}
export function updateActionLabel(status: UpdateStatus) {
  if (status === "available") return "업데이트";
  if (status === "downloaded") return "다시 시작";
  return "업데이트 확인";
}
export function updateStatusLabel(info: UpdateInfo, error: boolean) {
  if (error) return "업데이트를 다시 확인해 주세요.";
  switch (info.status) {
    case "checking": return "확인 중";
    case "latest": return "최신 버전이에요.";
    case "available": return "새 버전이 있어요.";
    case "downloading": return "다운로드 중이에요.";
    case "downloaded": return "업데이트 준비가 끝났어요.";
    default: return "업데이트를 확인해 주세요.";
  }
}
