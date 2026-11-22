import { describe, expect, it } from "vitest";
import { hasMemoKeyword, MEMO_MAX_LENGTH, toggleMemoKeyword } from "../lib/habits/memo-keywords";

describe("C3 memo keyword controls", () => {
  it("adds exactly once, displays selected state and toggles off", () => {
    expect(toggleMemoKeyword("", "뿌듯함")).toBe("뿌듯함");
    expect(hasMemoKeyword("뿌듯함", "뿌듯함")).toBe(true);
    expect(toggleMemoKeyword("뿌듯함", "뿌듯함")).toBe("");
  });

  it("preserves free-written prose containing a keyword", () => {
    const memo = "오늘은 뿌듯함을 느꼈어요.";
    expect(hasMemoKeyword(memo, "뿌듯함")).toBe(false);
    const added = toggleMemoKeyword(memo, "뿌듯함");
    expect(added).toBe(memo + " · 뿌듯함");
    expect(toggleMemoKeyword(added, "뿌듯함")).toBe(memo);
  });

  it("preserves other keywords and manually written sections", () => {
    const memo = "직접 작성한 문장 · 뿌듯함 · 피로 극복 · 마지막 내용";
    expect(toggleMemoKeyword(memo, "뿌듯함")).toBe("직접 작성한 문장 · 피로 극복 · 마지막 내용");
    expect(toggleMemoKeyword(memo, "조금 지침")).toBe(memo + " · 조금 지침");
  });

  it("removes only exact existing keyword tokens, including duplicated legacy tokens", () => {
    const memo = "뿌듯함 · 직접 쓴 뿌듯함 메모 · 뿌듯함";
    expect(toggleMemoKeyword(memo, "뿌듯함")).toBe("직접 쓴 뿌듯함 메모");
  });

  it("never truncates an existing memo or exceeds the original limit", () => {
    const memo = "가".repeat(MEMO_MAX_LENGTH);
    expect(toggleMemoKeyword(memo, "뿌듯함")).toBe(memo);
  });
});
