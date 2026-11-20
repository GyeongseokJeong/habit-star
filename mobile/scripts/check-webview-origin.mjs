/**
 * Anonymous HTTP preflight only. Never sends a login, cookie, JWT, or habit data.
 * Android remote mode is explicitly for the existing public website, not a
 * private staging project. A successful HTTP check is NOT device validation.
 */
import assert from "node:assert/strict";

const expected = "https://habit-star-fawn.vercel.app";
assert.equal(process.env.BYEOLHARU_POC_REMOTE_DEBUG, "1", "Remote mode must be explicitly enabled.");
const selected = (process.env.BYEOLHARU_POC_URL || expected).trim();
const url = new URL(selected);
assert.equal(url.href, `${expected}/`, "Only the existing HTTPS production origin is permitted.");

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15000);
try {
  const response = await fetch(url, {
    redirect: "manual",
    headers: { Accept: "text/html" },
    signal: controller.signal,
  });
  assert.equal(response.status, 200, `Public homepage returned HTTP ${response.status}; investigate before testing the APK.`);
  assert.match(response.headers.get("content-type") ?? "", /text\/html/i);
  const html = await response.text();
  assert.ok(html.includes("별하루"), "The site did not return the expected app homepage.");
  console.log("Public guest homepage OK. No credentials, cookies, or records were submitted.");
} finally {
  clearTimeout(timeout);
}
