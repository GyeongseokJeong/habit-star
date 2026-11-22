/** The presentation of a sync error must never change or clear its source data state. */
export const TRANSIENT_NOTICE_DELAY_MS = 3500;
export const TRANSIENT_NOTICE_VISIBLE_MS = 8000;
export const TRANSIENT_NOTICE_SUPPRESS_MS = 5 * 60_000;

export type SyncNoticeKind = "sync" | "auth" | "storage" | "other" | "settings";
export type SyncNoticeView = {
  kind: SyncNoticeKind;
  title: string;
  description: string;
  action: "retry" | "login" | "records";
  /** True only for transient cloud sync, never for saved-record errors. */
  autoDismiss: boolean;
};

export function resolveSyncNotice(error: string, storageWarning: boolean): SyncNoticeView | null {
  const message = error.trim();
  if (message.startsWith("인증이 만료") || message.includes("다시 로그인해주세요")) {
    return {
      kind: "auth", title: "로그인 확인이 필요해요",
      description: "연결을 다시 확인해 주세요. 미전송 기록은 보존됩니다.",
      action: "login", autoDismiss: false,
    };
  }
  if (message.startsWith("동기화하지 못했습니다.")) {
    return {
      kind: "sync", title: "동기화를 잠시 완료하지 못했어요",
      description: "이 기기에 저장된 기록은 유지돼요.",
      action: "retry", autoDismiss: true,
    };
  }
  if (message.startsWith("저장하지 못했습니다.") || message.includes("저장소를 열지 못")) {
    return {
      kind: "storage", title: "기록 저장을 확인해 주세요",
      description: "저장에 문제가 있을 수 있어요. 데이터 관리에서 상태를 확인해 주세요.",
      action: "records", autoDismiss: false,
    };
  }
  if (message) {
    return {
      kind: "other", title: "기록 상태를 확인해 주세요",
      description: message, action: "records", autoDismiss: false,
    };
  }
  if (storageWarning) {
    // Currently this flag is set by display/theme localStorage failures;
    // do not imply that IndexedDB habit records have been lost.
    return {
      kind: "settings", title: "앱 설정을 확인해 주세요",
      description: "일부 화면 설정을 저장하지 못했어요.",
      action: "records", autoDismiss: false,
    };
  }
  return null;
}
