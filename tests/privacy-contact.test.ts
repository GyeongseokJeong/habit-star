import { describe, expect, it } from "vitest";
import { ACCOUNT_DELETION_MAILTO, ACCOUNT_DELETION_SUBJECT, SUPPORT_EMAIL } from "../lib/privacy-contact";

describe("public account deletion contact", () => {
  it("targets only the approved service contact with a fixed subject", () => {
    const url = new URL(ACCOUNT_DELETION_MAILTO);
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("jasset.biz@gmail.com");
    expect(url.pathname).toBe(SUPPORT_EMAIL);
    expect(url.searchParams.get("subject")).toBe(ACCOUNT_DELETION_SUBJECT);
    expect([...url.searchParams.keys()]).toEqual(["subject"]);
  });
});
