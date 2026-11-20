/**
 * Non-destructive preflight for a guest-only HTTPS preview used by Android PoC.
 * This never submits credentials, creates accounts, or writes application data.
 */
import assert from "node:assert/strict";

const raw = process.env.BYEOLHARU_POC_URL?.trim();
assert.ok(raw, "Set the repository variable BYEOLHARU_APP_STAGING_URL to an HTTPS *preview* origin.");
const url = new URL(raw);
assert.equal(url.protocol, "https:", "HTTPS is required.");
assert.equal(url.origin, url.href.replace(/\/$/, ""), "Only a bare HTTPS origin is accepted.");
assert.equal(url.username + url.password + url.search + url.hash, "", "No credentials or query in preview URL.");
assert.equal(url.pathname, "/", "Do not configure a path for the preview origin.");
assert.notEqual(url.hostname, "habit-star-fawn.vercel.app", "Production website must never be used for this PoC.");
assert.ok(!url.hostname.includes("localhost") && url.hostname !== "127.0.0.1", "An Android phone cannot reach a localhost URL on the runner.");

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);
try {
  // GET only the anonymous homepage. No Supabase tokens/cookies are attached.
  const response = await fetch(url.href, {
    redirect: "manual",
    headers: { Accept: "text/html" },
    signal: controller.signal,
  });
  assert.equal(response.status, 200, `Preview origin must serve HTTP 200 HTML (got ${response.status}). Check deployment visibility and protection.`);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/i, "Preview response must be HTML.");
  const html = await response.text();
  assert.ok(html.includes("별하루"), "This URL does not appear to serve the 별하루 home page.");
  console.log("Anonymous preview home preflight OK. No credentials or data were submitted.");
} finally {
  clearTimeout(timeout);
}
