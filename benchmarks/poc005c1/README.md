# POC-005C1 — Hybrid independent visual evaluation (OFFLINE)

**Status:** Technical workflow only; no independent reviewer has rated the assets. Never infer VISUAL_GO, autonomy or production quality from CI.

Run `npm run poc:005c1:dry`. This reconstructs the three original POC-005A source asset categories (sword, medicinal pouch, stone censer), produces twelve true 64/128px PNGs and an OFFLINE human-only blind reviewer kit under `benchmarks/poc005c1/generated/review/`. A/B roles are randomized per session and the evaluator-private mapping lives only in an ephemeral temp root on dry runs. The GitHub artifact uploads **only** `generated/review/`. It must remain UNSCORED until real reviewers submit their assessments.

## Operator workflow (human review only)

**Official freeze source integrity prerequisite:** run `git fetch origin main`, check out `main`, and ensure `git status --porcelain=v1 --untracked-files=all` is empty. The official `freeze` requires a clean named main with matching `--source-sha` and local `origin/main`, **then performs a fail-closed LIVE `git ls-remote` check against the pinned repository `https://github.com/roronoazoroshao/game-artist-mcp.git`**. An unfetched local ref or network failure blocks official freeze. The live check is a point-in-time observation, not an immutable snapshot of remote main throughout rendering. Do not silently fall back to offline trust. `dry` remains UNSCORED.

**Private storage:** before freezing, create an **existing, operator-owned, 0700 directory OUTSIDE the Git repository**, such as `mkdir -m 700 -p "$HOME/private-game-artist-reviews"`. Point `--out` at a **new unique child** under that directory, e.g. `--out "$HOME/private-game-artist-reviews/review01"`. The CLI rejects output roots that already exist; missing/non-owner-only parents; symlink aliases; and any destination inside the tracked repo. Never use group-shared or public directories to store `internal/`. On Linux, use a dedicated operator UID and private mount or sandbox. **Threat model limitation:** these checks prevent accidental output placement and reject group/other-writable immediate parents, but cannot protect against a hostile concurrent process with the same UID, a privileged attacker, or arbitrary races in higher ancestors. For those environments, use a stronger descriptor-relative file API and an enforced isolation boundary instead of asserting TOCTOU safety.



- Run `node scripts/poc005c1-evaluate.mjs freeze --session-id <safe-unique-id> --out <new-child-of-existing-0700-parent> --source-sha <40-hex-main-sha> --quorum 1` (use 2 if two independent humans are available before the session is frozen). Prefer a private directory **outside any tracked repository**, never commit or share `internal/`.
- Give the reviewer **only** `reviewer-kit/`. Instruct them not to inspect the public code or other reviewers' scores, source files, author/AI critique, sealed A/B mapping or previews before submitting.
- Reviewer inspects all image pairs on checkerboard, light and dark backgrounds at both resolutions, rates five criteria 1–5 on **12 required rows**, personally checks the human/non-author/blind declaration, and returns the downloaded blind JSON. The exported JSON includes `evidenceKind="HUMAN_REVIEW"` and a reviewer-authored `reviewerDeclaration` with an acknowledgment timestamp. The offline HTML does not require network; JSON/CLI import is the fallback. When using the blank JSON template manually, complete those declaration fields before submission.
- A real independent evaluator verifies each reviewer is human, not involved in creation, and did not see the A/B assignment; retain an external confirmation privately. The `--verification` JSON MUST include frozen `sessionId` and `packageDigest`, along with `reviewerId`, `verificationStatus="VERIFIED_OUT_OF_BAND"`, `verificationMethod`, **per-reviewer distinct** `evidenceRef`, `verifiedBy` (not the reviewer), `verifiedAt` (at/after acknowledgment), `reviewerSignedOrAcknowledgedAt` (must equal the submission's `reviewerDeclaration.acknowledgedAt`), `realHumanConfirmed=true`, `notAuthorConfirmed=true`, and `blindExposure="NOT_EXPOSED"`. Reviewer acknowledgment must be no earlier than the session's freeze time. **Writing this file or ticking these fields does not itself prove human independence.** It is an operator-attested custody record; use real external evidence.
- Import after eligibility checks: `node scripts/poc005c1-evaluate.mjs submit --session <root> --submission <blind-scores.json> --verification <private-confirmation.json>`. Never import synthetic CI fixture data as human scores.
- Validate any time: `node scripts/poc005c1-evaluate.mjs validate --session <root>`. Decide only after the frozen 1/2-person quorum has submitted: `node scripts/poc005c1-evaluate.mjs decide --session <root> --evaluator-id <id>`. This locks scores, checks mapping integrity and produces private and redacted reports under `internal/`. Do not attempt re-locking an already decided session.
- **Compatibility:** Older reviewer packages without the explicit reviewer-authored declaration cannot be silently upgraded to a HUMAN_REVIEW. Reissue a newly frozen blind session and recollect the score sheet and verification references. Do not edit a previously signed review to make it pass.
- If reviewer is unavailable, declare **BLOCKED: INDEPENDENT_REVIEWER** and `REVIEW_PENDING`. 2-reviewer quorum is frozen and cannot be downgraded later. Do not use AI scoring to fill missing humans.

## Visual gate

Enhanced silhouette and style fit >=3/5 on all 3 categories at both sizes; >=2/3 categories improve material >=1 point at 64px **and** 128px; silhouette/style must not regress by more than 1. Two reviewers with any 2-point disagreement remain REVIEW_PENDING. AI advice is optional, labeled `ADVISORY_ONLY`, and never changes the verdict. This workflow does **not** verify agent-provider authorship. Keep `AGENT_PROVENANCE_PENDING` until a separately approved POC-005C2.

## Scope and evidence limitations

- Synthetic unit tests can exercise arithmetic but are NOT real blind human evaluations.
- Public source permits inferring some A/B assignments. Blinding is operational, not cryptographic.
- Identity is verified manually outside the repository, not proven by JSON flags. No secrets/contact details belong in GitHub artifacts.
- New appearance is still unsupported in the legacy Godot cutout exporter; POC-005C1 does not change that.
