# V3.2 approved art — GitHub → v0.app handoff

## Source of truth

Approved image package: `byeolharu-v3.2-approved-art-set-v1.0.1.zip` from ChatGPT. All six approved PNG originals and six derived WebP images are in `public/assets/constellation/` on `main`. Stage 6 uses the final 1024×1536 portrait update. Keep these twelve files byte-for-byte unchanged; verify with `node scripts/verify-constellation-assets.mjs`.

The GitHub directory expected by Next.js and v0.app is:

```text
public/assets/constellation/
  stage-01.webp
  stage-02.webp
  stage-03.webp
  stage-04.webp
  stage-05.webp
  stage-06.webp
  originals/
    stage-01.png
    stage-02.png
    stage-03.png
    stage-04.png
    stage-05.png
    stage-06.png
```

The source ZIP paths are `optimized-webp/stage-XX.webp` and `originals/stage-XX.png`. Only copy these 12 files into public; no reference-only alternates, contact sheets or HTML review files belong in public. The Stage 1–4 and 6 PNG bytes must remain identical. Stage 5 was mistakenly shipped as JPEG content with a PNG filename in v1.0. The corrected v1.0.1 asset is a true PNG encoding of identical decoded pixels and therefore has a new SHA-256.

## Historical upload workflow (completed in PR #24 and the final Stage 6 update)

The instructions below document the original handoff, not remaining work. All originals and previews are already committed. Every Stage 1–6 original is 1024×1536 (2:3); the final Stage 6 portrait replaces the earlier square version.

## User-facing upload workflow (historical)

1. Download and unzip the ChatGPT-approved package locally.
2. On GitHub, open the feature branch **`feat/v3-2-approved-art-assets-handoff`**, then open `public/assets/constellation/` → **Add file → Upload files**. Upload all six files from `optimized-webp/`, keeping the exact filenames. Commit to that feature branch, not `main`.
3. Open or create the `originals/` subdirectory and upload all six PNG files from `originals/`. Commit to the same branch. If GitHub's web upload doesn't preserve a folder path, clone the feature branch locally and copy the directory tree, then commit/push; do not flatten or rename the files.
4. After files are present in the feature branch, v0.app should use `/assets/constellation/stage-XX.webp` and the exported component `ConstellationArtwork` in `components/constellation-artwork.tsx`. No external hotlinked URLs or private image storage.
5. Verify successful image requests and visual fit in v0 Preview. Stage 6's final 1024×1536 original is natively 2:3; never stretch or crop it, and no SVG/card screenshot is a replacement for the approved images.
6. Run tests and CI, review changes and merge the PR. Merge/Publish only as an intentional, separate release action.

## Approval checksum registry

The correct original PNG SHA-256 digests (including re-encoded Stage 5) are in `lib/constellation/art.ts`. Verify after uploading by `node scripts/verify-constellation-assets.mjs` (format signatures, dimensions, SHA-256) or `sha256sum public/assets/constellation/originals/stage-*.png` in a local checkout or another trusted runner. The registry also defines Stage names/score thresholds and intrinsic image dimensions.

The **WEBP images are derived previews** of these originals, not independently approved replacements. Confirm at mobile width that the compression does not noticeably change hue, tiny gold stars or antler detail. 

## Code boundary

- `lib/constellation/art.ts`: deterministic score → art mapping only; **not the Growth Engine**. User-wide total growth score is derived from actual persisted daily habit completion records separately per the product policy.
- `components/constellation-artwork.tsx`: image display primitive, no data writes or DB schema. `components/constellation-growth-view.tsx` composes the image with a separate card frame, score, poem, zoom and Stage 6 decorative stars. Sharing is not implemented.
- The growth viewer is integrated on the home page; existing habit/sync/auth storage paths remain unchanged.
- If the WEBP files are absent, the image component displays a text fallback. This is a temporary error state, not a replacement for QA.

## Current acceptance checks

The twelve files on `main` are verified by `node scripts/verify-constellation-assets.mjs` against signatures, SHA-256 and 1024×1536 dimensions. Playwright covers image loading, 2:3 `object-contain`, Stage 1–6, mobile and both themes, as well as enlarged viewing. The approved artworks remain unchanged. A Chrome screenshot review does not replace independent real-device aesthetic approval or Samsung Internet testing; re-run typecheck, unit tests, build and GitHub CI for each change.

## Important version conflict to avoid

Old design experiments under `design/constellation-v3-2/svg/` and `layout.prototype.json` predate the final approved PNG images. They are **not** interchangeable with the user's artwork. The approved package is the current source of visual truth.

## Stage 5 format incident fixed (v1.0.1)

The previously packaged `originals/stage-05.png` was internally JPEG (`FF D8 FF`), although its SHA-256 matched the prior registry. This was an error in our packaging and integrity checks, **not** a new visual choice. The corrected image is a true PNG (`89 50 4E 47 0D 0A 1A 0A`) with identical decoded RGB pixels and 1024×1536 dimensions. The corrected Stage 5 checksum is `0e13d38fab74bf530a9f22f6c57c0f116d58033101eae6d2743a5b374af9ad54`. **Never upload the original v1.0 or the old v0-upload-ready ZIP.** Use `byeolharu-v3.2-v0-upload-ready-v1.0.1.zip` or the v1.0.1 complete archive.

## Stage 6 final artwork update (2026-11-18)

The user replaced the previously approved **1254×1254 square Stage 6** with a final **1024×1536 portrait Stage 6**, maintaining the same Stage 1–5 2:3 ratio. These are deliberately distinct approved files; do not stretch the original square version.

The **exact two** files from `byeolharu-v3.2-stage-06-final-2x3.zip` are already committed at these GitHub paths (replacing the previous versions):

- `public/assets/constellation/originals/stage-06.png` — 2,741,990 bytes, SHA-256 `72c91f59cbe695b10b2fd28376d21c9ac2eeff09318f6e9b5a45f0b0ea95a80e`
- `public/assets/constellation/stage-06.webp` — 525,838 bytes, SHA-256 `e6b1b060e6c917a9d0a32bf2613db9090a3361262f2d9d682e21ec6c92a1c6ef`

The corresponding `lib/constellation/art.ts`, `scripts/verify-constellation-assets.mjs`, tests, and both image files have since been merged together. Stages 1–5 remain unchanged. A screenshot or regenerated deer is not an acceptable replacement.
