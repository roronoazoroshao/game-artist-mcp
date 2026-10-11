# GAME ARTIST MCP — PHASE 3 / R5 INDEPENDENT SECURITY REVIEW HANDOFF

**Repo:** `roronoazoroshao/game-artist-mcp` · **PR:** [#29](https://github.com/roronoazoroshao/game-artist-mcp/pull/29) · **Branch:** `product/phase3-spirit-lantern-v2` · **Communication:** Vietnamese.

**State:** `DRAFT / NO MERGE / EXTERNAL_REVIEW_PENDING`. GitHub LIVE is the source of truth. Do not restart Phase 3 or overwrite `main`. The project owner approved advancing to an independent AppSec code review, fixing any P0/P1 by TDD, re-running exact-HEAD CI and conditional technical-only merge **only if the mandatory independent gate is truly satisfied**.

## Previously completed and still relevant

- Phase 3 written spec PR #27 and implementation plan PR #28 were merged. Product PR #29 implements opt-in deterministic Cutout v2, 64/128 preview, Godot atlas/animation/light, last-good immutable v2 package publisher and preserves legacy POC004.
- R4 bounded cross-process safety: [Security contract + crash recovery](R4_SECURITY_CONCURRENCY.md), [CI #38144736859](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38144736859) PASS 193/193 Node +13/13 synthetic, original and Phase3 pinned Godot4 runtime PASS, FolderForge PASS.
- Supported filesystem model: **one trusted host, local filesystem and cooperative processes**. No guarantee for NFS/SMB/multi-host/uncooperative same-UID actor, whole-host power-loss durability or arbitrary ancestor symlink TOCTOU. Do not quietly widen this contract.

## R5 code review and TDD evidence

Actual **AI_SELF_REVIEW** of changed files, NOT independent security review. It identified a concrete legacy `src/mcp/server.mjs` export risk:

1. `export_asset` accepted symlinked `output/` directory and `asset.svg` destination and could write outside the asset workspace. Two targeted failing tests in `test/r5-legacy-export-boundary.test.mjs` at [RED CI #38147040443](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38147040443).
2. Added directory and file preflight `lstat` checks and no-follow file opens: [GREEN CI #38147152424](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38147152424) SUCCESS.
3. Adversarial hardlink regression proved that truncating an existing regular output file mutates a linked file outside the workspace: [RED CI #38147247614](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38147247614), one real failing case.
4. Fixed by creating exclusive random temporary files and atomically `rename`ing their directory entries rather than truncating existing inodes. Fix commit `5222ba788eeb4e181389ec5a5d8be2c33241e10e`; [CI #38147327418](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38147327418) **SUCCESS**: 196/196 Node, 13/13 synthetic, `npm audit` reported zero detected vulnerabilities; POC004 and Phase3 Godot runtime markers PASS; FolderForge integration PASS.
5. These patches keep the v1 MCP tool name and output layout; do not mistake mechanical verification for a human-reviewed security certification. The trusted-host model remains. The three sequential v1 output files are individually atomically replaced, **not** an atomic multi-file transaction.

## Independent AppSec reviewer gate (still OPEN)

Created [Issue #30 — Independent AppSec review of exact PR #29 HEAD](https://github.com/roronoazoroshao/game-artist-mcp/issues/30) with an independently executable reviewer packet, threat model, scope, evidence and deliverable rubric.

- PR author is `roronoazoroshao369`; the author (or any assistant acting on their credentials) MUST NOT count as an independent reviewer.
- At latest verified R5 review inquiry, PR had **zero review submissions**, **zero review threads** and no requested reviewer, and the repo has no `.github/CODEOWNERS`. No eligible reviewer username had been supplied. Do not invent an identity, approval or review artifact.
- A qualified non-author reviewer must submit a genuine attributable GitHub review of the **current exact HEAD** across the entire PR diff, including core v1/v2 workflows, and explicitly assess whether P0/P1 are closed **within the declared threat model**.
- If P0/P1 is reported, reproduce it with a failing test → fix → full exact-head CI → request another review on the new HEAD. A green workflow alone does not satisfy reviewer independence.
- All branch protection and exact-HEAD CI requirements must also pass before technical-only merge. If reviewer gate is not met, remain **NO MERGE**, keep product branch and PR Draft; do not delete work.

## Independent production/art gates remain unchanged

- [Issue #21](https://github.com/roronoazoroshao/game-artist-mcp/issues/21): two actual independent, non-author human blind 64/128px art reviews, pending.
- POC005C2 authentic provider-origin attestation, unavailable. Neither can be replaced by agent simulation, self-review or synthetic artifacts.
- No stable/production release, no ART-GO claim. A technical-only merge (after eligible gates) is distinct from production release.

## Next execution

1. Re-check live PR #29 HEAD, requested/actual reviewers, GitHub Actions, open threads and [Issue #30](https://github.com/roronoazoroshao/game-artist-mcp/issues/30).
2. Identify and **actually request** a distinct eligible GitHub reviewer when the real identity and repo permission are known; do not guess a username. Send the Issue #30 packet and bind review to exact HEAD.
3. Close only independently supported P0/P1 with reproducible TDD and exact-head verification. Keep the PR Draft / NO MERGE until independent AppSec gate is fulfilled. Leave art/provenance as separate downstream gates.

**This handoff file is committed after the R5 green commit. Run and inspect GitHub Actions for the **new resulting exact HEAD** before reporting it green.**
