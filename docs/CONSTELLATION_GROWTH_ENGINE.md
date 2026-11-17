# V3.2 growth engine — recording and provenance contract

Status: code-only PR for calculation; **not yet connected to UI**.

- Calculate from one authenticated/guest `Snapshot` only. Do not mix accounts, introduce a persisted counter, or infer missing dates.
- `completed === true` qualifies regardless of rating or repeat schedule; distinct habit IDs per local day contribute a maximum of 3 points.
- Today's `Snapshot.habits` overrides any history row for the same date; historical snapshots come from the same repository scope.
- Editing an existing completion (including undo) recalculates total and current Stage. No activity on a day never deducts accrued points.
- A newly installed guest receives pre-completed **demo** habits. Their automatic completion must not create growth. `migration.backup.raw` distinguishes a brand-new guest from legitimate legacy data; `migration.entities` holds the baseline demo records.
- When the guest **deliberately** edits completion or rating, `demoConfirmedDailyEntryKeys` in local scope State marks that date/habit entry as user-confirmed. Config-only edits and memo changes are not evidence of completion. Removing actual completion still stops its score, regardless of marker.
- Historical guest snapshots created before this tracking can identify an edited demo by a rating difference; a fully reverted demo that predates the new tracking cannot be reliably distinguished. We favor excluding unconfirmed demo rather than manufacturing growth.
- This metadata is not written to Supabase. It is solely guest-installation demo provenance and must not influence another member's data. The real daily habit record remains the only growth scoring source.
- This change deliberately avoids schema/RPC changes and has no PWA or deployment changes.

Next PR: UI composition from `ConstellationArtwork` + external gold frame/text layer, progress indicator and growth view; confirm navigation/layout before integrating into `components/byeolharu.tsx`. Keep the existing daily completion interaction and StarlitHero.

Release checks: `pnpm typecheck`, `pnpm test`, `pnpm build`, GitHub Actions CI; browser visual testing after the UI PR. If results are unavailable, do not label them passed.
