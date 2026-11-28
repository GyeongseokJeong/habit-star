import assert from "node:assert/strict";

export const WIDGET_RELEASE_META = "app.byeolharu.widget.RELEASE_DIRECT_PRACTICE";
export const WIDGET_LEGACY_CANDIDATE_META = "app.byeolharu.widget.RELEASE_CANDIDATE";

// STEP 4E candidate was accepted. Both supported variants now ship direct
// practice. Reject obsolete overrides rather than silently building a
// different artifact from an old CI/local invocation.
export function widgetPracticeMode(variant, legacy = process.env.BYEOLHARU_WIDGET_RELEASE_CANDIDATE) {
  assert.ok(["debug", "release"].includes(variant), "Invalid Android variant");
  assert.equal(legacy, undefined, "Obsolete BYEOLHARU_WIDGET_RELEASE_CANDIDATE; use the normal build");
  return variant === "debug" ? "debug" : "release-enabled";
}

// Only a literal application-level marker enables the non-debuggable
// package. The first-child check also makes reusing generated trees safe.
export function patchWidgetPracticeManifest(manifest, mode) {
  assert.ok(["debug", "release-enabled"].includes(mode), "Invalid widget mode");
  const app = manifest.match(/<application\b[^>]*>/g);
  assert.equal(app?.length, 1, "Expected one application");
  const marker = /<meta-data\s+android:name="app\.byeolharu\.widget\.(?:RELEASE_CANDIDATE|RELEASE_DIRECT_PRACTICE)"\s+android:value="(?:true|false)"\s*\/>/g;
  const matches = [...manifest.matchAll(marker)];
  assert.ok(matches.length <= 1, "Duplicate widget practice marker");
  const count = [WIDGET_RELEASE_META, WIDGET_LEGACY_CANDIDATE_META]
    .reduce((n, name) => n + manifest.split(name).length - 1, 0);
  assert.equal(count, matches.length, "Unexpected widget practice marker");
  const tag = '<meta-data android:name="' + WIDGET_RELEASE_META + '" android:value="' + (mode === "release-enabled") + '" />';
  if (matches.length) {
    const start = manifest.indexOf(app[0]) + app[0].length;
    assert.ok(/^\s*$/.test(manifest.slice(start, matches[0].index)), "Widget practice metadata must belong to application");
    return manifest.replace(marker, tag);
  }
  return manifest.replace(app[0], app[0] + "\n        " + tag);
}
