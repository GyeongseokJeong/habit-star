import { describe, expect, it } from "vitest";
import { accountFeedbackTone } from "../components/account/account-feedback-tone";

describe("account feedback semantics", () => {
  it("never renders failures with success coloring, even when they mention permissions", () => {
    expect(accountFeedbackTone("알림 설정을 저장하지 못했어요. Android 알림 권한을 확인해 주세요.")).toBe("error");
    expect(accountFeedbackTone("백업 복원 실패")).toBe("error");
    expect(accountFeedbackTone("계정이 변경되어 복원을 중단했습니다.")).toBe("error");
  });
  it("distinguishes actionable permission warnings from confirmed successes", () => {
    expect(accountFeedbackTone("기기 알림 권한을 확인해 주세요.")).toBe("warning");
    expect(accountFeedbackTone("시간대를 변경했어요. 이전 기록의 날짜는 유지됩니다.")).toBe("success");
    expect(accountFeedbackTone("백업을 복원했습니다.")).toBe("success");
  });
  it("keeps uncertain messages neutral instead of falsely claiming success", () => {
    expect(accountFeedbackTone("파일을 선택하고 내용을 검토하세요.")).toBe("info");
  });
});
