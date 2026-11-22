import { describe, expect, it } from "vitest";
import { resolveSyncNotice, TRANSIENT_NOTICE_DELAY_MS, TRANSIENT_NOTICE_VISIBLE_MS, TRANSIENT_NOTICE_SUPPRESS_MS } from "../lib/habits/sync-notice-policy";

describe("sync notice severity and copy", () => {
  it("keeps transient cloud sync separate from local storage failure", () => {
    expect(resolveSyncNotice("동기화하지 못했습니다. 로컬 기록은 보존됩니다. 연결을 확인하고 다시 시도해주세요.",false))
      .toMatchObject({kind:"sync",autoDismiss:true,action:"retry"});
    expect(resolveSyncNotice("저장하지 못했습니다. 백업을 내려받고 저장 공간을 확인해주세요.",false))
      .toMatchObject({kind:"storage",autoDismiss:false,action:"records"});
  });
  it("requires explicit acknowledgement for auth, recovery, and storage issues", () => {
    expect(resolveSyncNotice("인증이 만료되었습니다. 다시 로그인해주세요. 미전송 기록은 보존됩니다.",false))
      .toMatchObject({kind:"auth",action:"login",autoDismiss:false});
    expect(resolveSyncNotice("가져오기에 실패했습니다. 원본과 중단 지점은 보존됩니다.",false))
      .toMatchObject({kind:"other",autoDismiss:false});
  });
  it("does not claim record loss from optional display preferences", () => {
    expect(resolveSyncNotice("",true)).toMatchObject({kind:"settings",autoDismiss:false});
    expect(resolveSyncNotice("",true)?.description).not.toMatch(/기록.*손실/);
    expect(resolveSyncNotice("",false)).toBeNull();
  });
  it("delays brief errors, auto-dismisses a persistent notice, and suppresses quick repeats", () => {
    expect(TRANSIENT_NOTICE_DELAY_MS).toBe(3500);
    expect(TRANSIENT_NOTICE_VISIBLE_MS).toBe(8000);
    expect(TRANSIENT_NOTICE_SUPPRESS_MS).toBe(5*60000);
  });
});
