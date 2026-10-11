# GAME ARTIST MCP — PHASE 3 PRODUCT RESUME / REVIEW GATE

Repository: roronoazoroshao/game-artist-mcp. Language: Vietnamese. Real GitHub is source of truth. Do not restart project.

## Approved inputs
- Spec PR #27 MERGED and implementation plan PR #28 MERGED.
- Owner selected Native execution.
- Product PR #29: https://github.com/roronoazoroshao/game-artist-mcp/pull/29
- Branch: product/phase3-spirit-lantern-v2. PR remains Draft until exact-HEAD gates and review.

## Work implemented (verify live)
TDD Tasks 1–11: frozen v1 hashes; strict Cutout v2 schema; SHA/revision compiler; explicit animation sampler/loop QA; material-aware raster+alpha crop; deterministic atlas/pivot accounting; Godot4 AtlasTexture scene/texture/energy tracks; immutable atomic publication; real MCP render_cutout_preview; 4 authored flame poses and 64/128 image bundle; raw MCP and pinned Godot headless runtime tests. Original POC004 remains intact.

- Full technical CI at commit 561812297854cb2b2b357b868320424d366bf626: https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38114061635 SUCCESS, including pinned Godot runtime.
- Subsequent RED regression https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38114176632 identified animation-position pivot bug. Fix at 9a8dfb1e04fea197735f9dde34344897402daa45. Verify LATEST exact HEAD CI before any green claim.
- CI also archives explicit Phase3 UNSCORED visual review images and actual Godot project/runtime logs.

## Remaining and stop
1. Check PR #29 HEAD, exact-head CI, unit tests, POC004 regression, pinned Godot4, FolderForge; troubleshoot any failures with Superpowers systematic-debugging and RED→GREEN.
2. Audit source-relative pivot animation, PNG decoder limits, symlink/TOCTOU and atomic-last-good recovery, resource shader/script path safety, and true render-preview image bytes. Review is AI_SELF_REVIEW unless a genuinely independent reviewer joins.
3. If tool access permits, actually inspect output 64px/128px/contact sheet from CI artifact, documenting exact self-critique rather than invented artistic approval.
4. Keep PR unmerged pending explicit user merge/release approval; after approval exact-head CI → merge → post-merge main CI → safe branch cleanup so only main remains.
5. Leave Issue #21 VISUAL_REVIEW_PENDING (2 actual non-author humans) and POC005C2 Task8 PROVIDER_ATTESTATION_UNAVAILABLE. No background work, paid model calls or synthetic full-pass claims.

Current plan: docs/superpowers/plans/2026-10-11-phase3-spirit-lantern-game-ready.md
