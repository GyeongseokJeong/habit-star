# V3.2 artwork delivery — images must be uploaded

This branch **contains the integration code and approval registry but DOES NOT YET CONTAIN THE IMAGE BYTES**.

Copy the six approved WEBP derivatives from the [approved art package ZIP supplied in ChatGPT] into this folder:

`stage-01.webp` ... `stage-06.webp`

Also copy the six **unaltered** approved PNG originals to:

`originals/stage-01.png` ... `originals/stage-06.png`

The exact source package is `byeolharu-v3.2-approved-art-set-v1.0.1.zip` (available from the project chat). **Do not use the old SVGs, comparison-board crops, old card screenshots or the Stage 5 'HD visual match' alternate.**

GitHub and v0.app can read these via fixed paths once the files are committed:

- `/assets/constellation/stage-01.webp` .. `stage-06.webp` for the site
- `/assets/constellation/originals/stage-01.png` .. `stage-06.png` for the approved originals

See `docs/CONSTELLATION_ASSETS.md` for manual binary-upload procedure, SHA-256 checks and Vercel/v0 verification. The artwork is deliberately not baked together with gold frame, score copy and labels.

**Format caveat:** v1.0's `stage-05.png` was JPEG in disguise. Use only corrected `byeolharu-v3.2-v0-upload-ready-v1.0.1.zip` and verify file magic with `node scripts/verify-constellation-assets.mjs` after uploading.
