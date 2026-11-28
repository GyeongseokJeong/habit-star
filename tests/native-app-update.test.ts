import { describe, expect, it } from "vitest";
import { updateActionLabel, updateOfferKey, updateStatusLabel, shouldShowUpdateNotice, rememberUpdateOffer, type UpdateStatus } from "../lib/habits/native-app-update";

describe("Play update presentation policy", () => {
  it("uses a distinct offer for each version and install phase", () => {
    expect(updateOfferKey({ status: "available", versionCode: 5 })).toBe("5:available");
    expect(updateOfferKey({ status: "downloaded", versionCode: 5 })).toBe("5:downloaded");
    expect(updateOfferKey({ status: "available", versionCode: 6 })).toBe("6:available");
  });
  it.each(["checking", "unavailable", "unknown", "latest", "downloading"] as UpdateStatus[])("does not offer an update for %s", status => {
    expect(updateOfferKey({ status, versionCode: 5 })).toBeNull();
  });
  it("dismisses only this version and phase; a new version or completed download can be offered", () => {
    const dismissed = rememberUpdateOffer([], "5:available");
    expect(shouldShowUpdateNotice({ status: "available", versionCode: 5 }, dismissed)).toBe(false);
    expect(shouldShowUpdateNotice({ status: "downloaded", versionCode: 5 }, dismissed)).toBe(true);
    expect(shouldShowUpdateNotice({ status: "available", versionCode: 6 }, dismissed)).toBe(true);
    expect(rememberUpdateOffer(dismissed, "5:available")).toEqual(dismissed);
  });
  it("rejects missing and invalid version codes", () => {
    expect(updateOfferKey({ status: "available" })).toBeNull();
    expect(updateOfferKey({ status: "downloaded", versionCode: -1 })).toBeNull();
  });
  it("never treats a failed or unknown check as current", () => {
    expect(updateStatusLabel({ status: "latest" }, true)).not.toContain("최신");
    expect(updateStatusLabel({ status: "unknown" }, false)).not.toContain("최신");
    expect(updateActionLabel("downloaded")).toBe("다시 시작");
  });
});
