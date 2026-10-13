# GAME ARTIST MCP — PHASE 3 TECHNICAL MERGE HANDOFF

**Repo:** `roronoazoroshao/game-artist-mcp`. **PR:** [#29](https://github.com/roronoazoroshao/game-artist-mcp/pull/29), product branch `product/phase3-spirit-lantern-v2`. Vietnamese. GitHub LIVE is the sole source of truth.

## Owner's explicit governance decision (2026-10-13)

The owner **replaced the independent non-author AppSec sign-off as a PR #29 technical-only merge gate** with a transparent AI multi-role security, architecture, SRE, Godot and QA review, and authorized approval/merge through the owner's GitHub identity. AI self-review is **NOT** a real independent security review; do not impersonate a distinct reviewer. GitHub may prevent same-author APPROVE; a real COMMENT review + owner's merge is acceptable if GitHub permits and all other technical gates are green.

This exception is **specific to technical integration of PR #29**. It does **not** waive P0/P1 fixes, green exact-HEAD CI, branch-protection requirements, production release restrictions, independent 64/128 blind art review [Issue #21](https://github.com/roronoazoroshao/game-artist-mcp/issues/21), or POC005C2 provider attestation.

## Implemented and verified

- Approved design PR #27 and TDD plan PR #28; opt-in strict CutoutManifest v2, deterministic content/revision compiler; 64/128 visual artifacts, 4 authored flame poses, loop QA, bounded raster, atlas/pivot, Godot4 scene and light energy.
- Backward-compatible POC004 exports; immutable hash-named Godot packages; shared per-asset writer/export lock and last-good pointer.
- R4: symlinked workspace creation rejected; 16MiB bounded state; cross-process compare-and-swap and SIGKILL stale-lock fail-closed; local host-only documented scope [R4](R4_SECURITY_CONCURRENCY.md).
- R5: legacy export directory/file symlinks and hardlinked external targets prevented by preflight plus randomized exclusive tempfile and per-file rename; RED/green evidence [CI #38147040443](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38147040443), [#38147247614](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38147247614) and [#38147327418](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38147327418).
- Prior exact product HEAD `000504fc8ddc7c6e0111d922d4af48b1ceab9110` [CI #38147510986](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38147510986): SUCCESS 196/196 Node, 13/13 synthetic, original POC004 + Phase3 pinned Godot4, FolderForge child MCP, npm audit 0 detected vulnerabilities.
- GitHub **AI_MULTI_ROLE_SELF_REVIEW** by the owner-linked assistant is recorded as a `COMMENT` review (not external human APPROVE) on the specific reviewed HEAD and remains distinct from the owner merge.
- **This handoff update creates a new HEAD**, therefore re-check actual fresh exact-head CI after this change. Never treat the earlier HEAD CI as evidence for the new HEAD.

## Technical integration conditions

1. Verify latest product HEAD, PR changes, outstanding real review blockers/branch protection, and the full exact-head Actions run for Node/synthetic/npm audit/Godot POC004+Phase3/FolderForge.
2. No *known* open P0/P1 findings within the **trusted local single-host cooperating-process** runtime contract; keep residual filesystem race/power-loss/out-of-contract risks explicit. No pretending these are certified.
3. Mark PR ready for review only after internal gates; try the GitHub APPROVE action only if allowed (GitHub normally rejects author self-approval). Do not manufacture an APPROVED review.
4. Because the owner expressly authorized technical-only merge, merge with an exact expected HEAD if allowed by GitHub, even if independent human reviewer #30 was not supplied. Do **not** bypass enforced GitHub branch protection.
5. Verify post-merge `main` workflow on the actual merge SHA, preserve artifacts, and only clean up integrated branches when supported/safe.
6. **Do not deploy/release stable or claim ART_GO/PRODUCTION_READY.** Genuine non-author human art review #21 and provider-origin POC005C2 stay pending.

## Next primary goal after technical merge

Improve original Spirit Lantern cutout's game-feel, secondary motion, flame/light falloff and 64/128px silhouette inside a real scene; use image-grounded A/B, measured animation metrics, preserve copyright originality, and seek authentic external visual evaluation for production quality. Keep all claims evidence-scoped; no separate unrelated POC or new repository.

**Exact HEAD after this update is determined from GitHub live, not copied from a stale checkpoint.**
