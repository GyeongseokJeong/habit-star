# V3.2 Constellation Art Prototype · v0.1

This is a **design prototype, not a merged runtime feature or final approved art**.

- `layout.prototype.json` contains 19 stable primary star coordinates and 21 graph edges across 6 growth stages.
- Stage thresholds (0/7/20/50/100/200) and the central-star branching-growth policy are **confirmed**.
- Every node has a `firstStage`. Edges only become visible when both endpoints have appeared.
- The visual direction is Midnight Navy, Plum/Violet nebula, Champagne Gold luminous stars, layered glows, delicate orbital filaments.
- The 250/300/350/400 Stage 6 decorations remain **proposals**, not approved implementation requirements.
- Background nebula/glow layers are separate from geometric constellation nodes and must be composed without randomizing primary coordinates.
- The actual six standalone SVG prototypes and offline interactive review page were delivered as a user-review asset. This JSON provides the stable geometry for later React/SVG production implementation.
- Follow the design QA gate in [the signature constellation policy](../../docs/CONSTELLATION_V3_2.md): six-stage mobile proof, clear Stage 5/6 distinction, palette consistency, reduced-motion and performance.
