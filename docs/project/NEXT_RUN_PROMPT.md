# GAME ARTIST MCP — PHASE 3 / R4 SECURITY QUALIFICATION HANDOFF

**Repository:** `roronoazoroshao/game-artist-mcp` · **PR:** [#29](https://github.com/roronoazoroshao/game-artist-mcp/pull/29) · **Product branch:** `product/phase3-spirit-lantern-v2`.

Language: Vietnamese. **Source of truth: GitHub LIVE.** Reconfirm HEADs, PR, reviews and CI before all actions. **Do not restart Phase 3.** Keep PR Draft unless every technical merge gate is proved. Technical-only merge and production art release remain separate decisions.

## Already owner-approved

- PR #27 Phase 3 written spec and PR #28 TDD plan are merged; Native execution approved.
- Owner approved R4 focused security and concurrency qualification on 2026-10-11. No unrelated POC or repo replacement.
- Original Phase 3 v2 build consists of CutoutManifest v2, 4 flame poses, optimized atlas, bounded raster, MCP image previews and pinned Godot runtime; original v1 stays compatible.

## R3 checkpoint / baseline

- Previous R3 product HEAD: `a11c6a7ec8553a9cd234f596ddab0d1bf1a639fc`.
- R3 full [CI #38140987073](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38140987073): 186/186 Node, 13/13 synthetic, original POC004 and Phase3 real Godot PASS, FolderForge integration PASS.
- R3 found and corrected stale revision overwrites, inter-process lost updates, exported pointer mutation concurrent with writes, state symlink reads, predictable symlinkable tmp files. Existing shared `.asset-write-lock` is fail-closed and requires controlled recovery after a killed writer.

## R4 executed and evidence

- RED commit `a59ee8f38801b6779d08fb9810abda9db136ccef`, [CI #38144147784](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38144147784): four reproducible failures — asset creation through symlinked root, asset creation through symlinked assets directory, oversized state read and oversized state save.
- GREEN `e5d4fe9202781fcb5acbce040738c3d0b2807560`, [CI #38144231621](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38144231621): full workflow SUCCESS. `AssetStore.init` rejects checked symlink root/assets; state read and serialized writes enforce a 16 MiB cap.
- Multi-process cross-check `6bb3f90b397e125560c9535a09312c2ad62a1f78`, [CI #38144362650](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38144362650): SUCCESS, 192/192 Node and 13/13 synthetic; real two-OS-process CAS and SIGKILL stale-lock recovery simulations passed; original POC004 and Phase3 Godot runtime markers PASSED; FolderForge child plugin PASSED.
- Security contract and manual recovery documentation added: `docs/project/R4_SECURITY_CONCURRENCY.md`. **That document itself must be checked under the latest HEAD CI.**
- Test suites: `test/r4-workspace-boundary.test.mjs` and `test/r4-cross-process.test.mjs`. Do not confuse synthetic or AI self-review with external independent security evidence.

## Residual scope and gate status

1. **Trusted local host/filesystem only:** Test-covered cooperative Node processes on one host. This does not certify distributed/NFS/SMB, hostile same-UID path-swap TOCTOU or generalized sandbox escapes.
2. **Crash/power:** A killed writer leaves an intentional orphan lock and fails closed. Only verified operator-exclusive recovery is supported. Full-host sudden power loss and nested directory durability are **not** qualified.
3. **Independent review:** No genuine independent PR code/security review submission was present at prior verified HEAD. Obtain an eligible non-author review or document an explicitly permitted technical exception only if repository rules allow it; no fabricated review.
4. **Visual:** [Issue #21](https://github.com/roronoazoroshao/game-artist-mcp/issues/21) remains open for **two authentic non-author human** blind art reviews. No `VISUAL_GO`/production art claim.
5. **Provider:** POC005C2 provider-origin attestation unavailable; no autonomous artist full-pass claim.

## Next action after this handoff

1. Verify live PR #29 exact latest HEAD, review submissions/threads/branch protection and exact HEAD CI.
2. Perform bounded AI_ROLE_BASED adversarial re-review of the R4 product diff; seek a genuine independent security code-review submission when available. Evaluate whether all applicable P0/P1 technical findings are closed **under the documented supported filesystem contract**.
3. If any P0/P1 appears, do TDD RED→GREEN on the same product branch, then full exact-HEAD Node/synthetic/npm/POC004/Phase3 Godot/FolderForge CI.
4. Technical merge only if all mandatory gates have genuine evidence and GitHub rules allow. Otherwise: **NO MERGE**, preserve Draft branch/PR and log unresolved blockers.
5. Never auto-release stable/production, fake human art review/provider proof, delete unfinished work or weaken acceptance thresholds.

**Last evidence snapshot:** R4 functional tests were green at `6bb3f90b`. This handoff file is subsequently committed on the product branch; **reverify its exact current HEAD and CI**, do not assume it is already green.
