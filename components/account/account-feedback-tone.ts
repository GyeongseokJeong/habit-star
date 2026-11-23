/** Semantic status feedback; never present a failure as a success-green notice. */
export type AccountFeedbackTone = "success" | "warning" | "error" | "info";

export function accountFeedbackTone(message: string): AccountFeedbackTone {
  if (/실패|오류|못했|못해|되지 않|중단|거부|차단|충돌|만료|불가능|문제/.test(message)) return "error";
  if (/권한|확인해 주세요|확인해주세요|필요|대기|다시 선택|확인 중/.test(message)) return "warning";
  if (/완료|성공|저장했|변경했|복원했|허용됐|확인했습니다|설정했/.test(message)) return "success";
  return "info";
}
