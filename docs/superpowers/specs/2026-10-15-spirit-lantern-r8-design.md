# Spirit Lantern R8 — Premium In-Game Art Direction (Approved Design)

**Status:** DESIGN APPROVED by owner on 2026-10-15, implementation plan review pending.  
**Source-of-truth approval:** [GitHub Issue #33](https://github.com/roronoazoroshao/game-artist-mcp/issues/33).  
**Baseline at approval:** `main@2efb6eeb502eaa0fa7def55face68d355c463931`, R7 merged with successful [post-merge push CI #38607190380](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38607190380). Reverify live HEAD before execution.

## Intent and boundaries

Deliver an **original**, visually exceptional xianxia survival-game Spirit Lantern in a real 2.5D Godot context. Treat 9–10/10 as a **target**, not an automatically earned score: visual grade is withheld until review evidence exists, and GitHub Actions or pixel-count tests never substitute for art judgment.

Keep the cutout export pipeline reusable and deterministic; retain existing CutoutManifest v2 schema, source node ID ownership, four authored flame poses, 2-second seamless idle clip, atlas/pivots, POC004 v1 compatibility, immutable content-addressed MCP export and existing security limits. Do not replace the asset with model-generated images or copy another game's IP. R8 may improve shapes/materials and the *extracted showcase project*, not the exported generic MCP package interface.

## User-facing visual contract

- **Framing and perspective:** Recognizably lantern-shaped at native source 256x320, 128px, and 64px; roof rim, central cyan flame, flanking paper talismans and red tassel remain distinguishable. Introduce 3/4 cues to roof/cage/base but never break part pivots or silhouette/collision placement.
- **Material language:** Layered dark metal with edge highlights/bevels, credible parchment folds/ink/seals and tactile but uncluttered red thread. Reserve brightest values for spirit flame; maintain tonal hierarchy on low-brightness screens.
- **Light/material interaction:** The existing cyan `SpiritLight` and `GroundBounce` must produce a spatially plausible, temporally responsive pool on the altar and a restrained reflected cyan edge on nearby materials. A static full-scene teal overlay does **not** count. Use a captured **lit vs explicitly unlit** control on identical Godot scene state to demonstrate environment response outside the lantern sprite.
- **Motion/VFX:** Preserve the R6 authored frame/secondary-motion/energy curves; add only subtle scene-coupled reactions, grounded mote paths and restrained parallax. Motion must read without violent flashing, excessive neon or performance regressions.
- **Actual-game evidence:** Pinned Godot 4.7.2-stable with checksum, Mesa/Xvfb 512x512 framebuffer capture, same fixed camera/exposure/timeline for R7 vs R8. Generate 512, 128 and 64 scaled review views without mistaking nearest/bilinear scaling for a render at a different camera zoom.

## Existing implementation anchors

- Asset source `examples/spirit-lantern/v2/source.json` and rig `examples/spirit-lantern/v2/cutout.json` (5 parts: body, flame, two talismans, tassel; 4 flame poses).
- `scripts/phase3-godot.mjs` compiles through actual MCP and copies immutable export into a **separate** generated playable showcase, selecting `showcase.tscn` as its default scene.
- `scripts/phase3-showcase.tscn` defines `Lantern`, `Ground`, `GroundBounce`, `Foreground`, `Atmosphere`; `scripts/phase3-showcase-world.gd` draws ground, altar and motes; `scripts/phase3-showcase-surface.gdshader` and `phase3-showcase-atmosphere.gdshader` control texture/atmosphere; `scripts/phase3-showcase-capture.gd` supports opt-in framebuffer extraction.
- `test/spirit-lantern-v2-art.test.mjs`, `test/r7-showcase-framebuffer.test.mjs`, and `.github/workflows/ci.yml` already validate strict manifest, loop/poses and actual Godot viewport. Extend rather than replace these paths.

## Architecture and stage boundaries

1. **R8a — lantern source and small-scale reading:** enhance source geometry/material expression without new schema/API. Build focused asset tests plus 64/128 review images; do not claim visual quality simply because all tests pass.
2. **R8b — verified environment light response:** make light-on vs light-off capture in the existing showcase controller under the same frame/camera, and verify changes in a stable environment region **not including lantern pixels**. Ensure dynamic response follows authored light energy. Restrict shader changes to the showcase.
3. **R8c — material and cinematic restraint:** refine ground facets, localized cast/occlusion, subtly reactive stone and fog while preserving simple reproducible authored geometry. Capture camera-locked temporal frames and check readable negative space and soft illumination.
4. **R8d — reviewed A/B decision:** package **baseline R7 vs candidate R8**, 512/128/64, hashes, frame timestamps and explicit test provenance. Solicit blind scored rubric for silhouette, material, lighting, spatial cohesion, original identity, animation/game-feel, low-resolution legibility. Separate AI self-review, user visual feedback and actual independently identifiable human reviews. Mark `UNSCORED` until reviewer reports exist.

## Required quality gates

**Technical:** Test-first RED→GREEN evidence for each behavior change. `npm test`, `npm run poc:phase3`, pinned Godot imports/runtime/capture, `R7_CAPTURE_VERIFICATION=1 node --test test/r7-showcase-framebuffer.test.mjs`, additional lit/unlit review gates, FolderForge integration, zero new blocking regressions. Compare exact pushed HEAD; repeat CI on merged `main`.

**Visual:** Compare original actual Godot captures (not only source SVG), no clipped tassels/rims, no washout, no dominant glow masking the underlying drawing, usable at 64/128px, 9–10 only if scoring evidence supports it. No numerical grade may be inferred from code coverage or CI pass.

**Release:** Technical integration may use owner-authorized AI role-based review with disclosure. No impersonated independent approval, no production deployment, no stable art GO without genuine external visual evidence tracked by [Issue #21](https://github.com/roronoazoroshao/game-artist-mcp/issues/21) and provider-origin proof if applicable.

## Branch hygiene — owner requirement

The settled repository state must be **main-only**. Use task-specific short-lived branches only when implementation starts. Never blindly merge unfinished branches. Before each merge: inspect exact branch HEAD, diff, open PRs, status and applicable protection; merge only a passing, authorized PR; verify the resulting `main` push CI; delete the successfully integrated source branch by verified safe cleanup (automated `cleanup-merged-branches` workflow or authorized GitHub action); verify branches list. Preserve any unmerged or divergent work for review, not force-delete. An intentionally active WIP PR is the one exception while work is in progress.

## Explicit exclusions

No rewrites of MCP protocol, trusted-local-host locking, multi-host behavior, new paid/uncleared art resources, proprietary assets, deployment, or automatic numeric quality certification. This design approves the **quality objective and architecture**, not an unreviewed implementation plan.
