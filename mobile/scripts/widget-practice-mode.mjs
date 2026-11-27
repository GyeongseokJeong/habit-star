import assert from "node:assert/strict";

export const WIDGET_CANDIDATE_META = "app.byeolharu.widget.RELEASE_CANDIDATE";

export function widgetPracticeMode(variant, candidate = process.env.BYEOLHARU_WIDGET_RELEASE_CANDIDATE) {
  assert.ok(["debug", "release"].includes(variant), "Invalid Android variant");
  assert.ok(candidate === undefined || candidate === "" || candidate === "0" || candidate === "1",
    "Invalid BYEOLHARU_WIDGET_RELEASE_CANDIDATE");
  assert.ok(candidate !== "1" || variant === "release", "Widget candidate requires release variant");
  return variant === "debug" ? "debug" : candidate === "1" ? "release-candidate" : "read-only";
}

// Always rewrite the marker even when reusing a generated Android tree.
// Native reads only this compiled application metadata, never a runtime toggle.
export function patchWidgetCandidateManifest(manifest, mode) {
  assert.ok(["debug","read-only","release-candidate"].includes(mode), "Invalid widget mode");
  const app = manifest.match(/<application\b[^>]*>/g);
  assert.equal(app?.length, 1, "Expected one application");
  const marker = /<meta-data\s+android:name="app\.byeolharu\.widget\.RELEASE_CANDIDATE"\s+android:value="(?:true|false)"\s*\/>/g;
  const matches = [...manifest.matchAll(marker)];
  assert.ok(matches.length <= 1, "Duplicate widget candidate marker");
  assert.equal(manifest.split(WIDGET_CANDIDATE_META).length - 1, matches.length, "Unexpected widget candidate marker");
  const value = mode === "release-candidate";
  const tag = '<meta-data android:name="' + WIDGET_CANDIDATE_META + '" android:value="' + value + '" />';
  if (matches.length) {
    // Our generated marker is always the first child of application.
    const start = manifest.indexOf(app[0]) + app[0].length;
    assert.ok(/^\s*$/.test(manifest.slice(start, matches[0].index)), "Widget candidate metadata must belong to application");
    return manifest.replace(marker, tag);
  }
  return manifest.replace(app[0], app[0] + "\n        " + tag);
}
