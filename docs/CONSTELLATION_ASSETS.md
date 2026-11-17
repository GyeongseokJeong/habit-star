# V3.2 approved art — GitHub → v0.app handoff

## Source of truth

Approved image package: `byeolharu-v3.2-approved-art-set-v1.0.zip` from ChatGPT. The repository currently has a **code-only PR** until the six PNG and six WEBP files are uploaded to GitHub. Do not mark the image migration completed before that.

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

The source ZIP paths are `optimized-webp/stage-XX.webp` and `originals/stage-XX.png`. Only copy these 12 files into public; no reference-only alternates, contact sheets or HTML review files belong in public. Original PNG bytes must remain identical.

## User-facing upload workflow

1. Download and unzip the ChatGPT-approved package locally.
2. On GitHub, open the feature branch **`feat/v3-2-approved-art-assets-handoff`**, then open `public/assets/constellation/` → **Add file → Upload files**. Upload all six files from `optimized-webp/`, keeping the exact filenames. Commit to that feature branch, not `main`.
3. Open or create the `originals/` subdirectory and upload all six PNG files from `originals/`. Commit to the same branch. If GitHub's web upload doesn't preserve a folder path, clone the feature branch locally and copy the directory tree, then commit/push; do not flatten or rename the files.
4. After files are present in the feature branch, v0.app should use `/assets/constellation/stage-XX.webp` and the exported component `ConstellationArtwork` in `components/constellation-artwork.tsx`. No external hotlinked URLs or private image storage.
5. Verify successful image requests and visual fit in v0 Preview. In particular, Stage 6 (1254×1254) must not be forced to 2:3 and no SVG/card screenshot is a replacement for the approved images.
6. Run tests and CI, review changes and merge the PR. Merge/Publish only as an intentional, separate release action.

## Approval checksum registry

The exact original PNG SHA-256 digests are in `lib/constellation/art.ts`. Verify after uploading by `sha256sum public/assets/constellation/originals/stage-*.png` in a local checkout or another trusted runner. The registry also defines Stage names/score thresholds and intrinsic image dimensions.

The **WEBP images are derived previews** of these originals, not independently approved replacements. Confirm at mobile width that the compression does not noticeably change hue, tiny gold stars or antler detail. 

## Code boundary

- `lib/constellation/art.ts`: deterministic score → art mapping only; **not the Growth Engine**. User-wide total growth score is derived from actual persisted daily habit completion records separately per the product policy.
- `components/constellation-artwork.tsx`: image display primitive, no data writes or DB schema. Does not automatically add a new navigation item, frame, score text, badges or sharing.
- Existing UI and habit/sync/auth flows remain unchanged until a separately reviewed integration PR.
- If the WEBP files are absent, the image component displays a text fallback. This is a temporary error state, not a replacement for QA.

## Acceptance checklist

- [ ] 12 exact image files committed to branch (six PNG, six WEBP)
- [ ] 6 PNG SHA-256 values match the registry
- [ ] Stage 1–5 render in 2:3, Stage 6 in 1:1, without stretch
- [ ] Every WEBP responds successfully; no broken image fallback
- [ ] Stage 1/2 show no deer, Stage 3 partial deer, Stage 4 complete young deer, Stage 5 mature deer, Stage 6 magnificent final deer
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm build`, GitHub CI verified
- [ ] Mobile width 320–430px and both themes visually checked
- [ ] Distinct design review for card frame, Korean labels and Growth Engine wiring

## Important version conflict to avoid

Old design experiments under `design/constellation-v3-2/svg/` and `layout.prototype.json` predate the final approved PNG images. They are **not** interchangeable with the user's artwork. The approved package is the current source of visual truth.
