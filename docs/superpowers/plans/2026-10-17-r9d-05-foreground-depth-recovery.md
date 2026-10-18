# R9d-05 — Foreground Depth Recovery and Three-Scale Motion Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, RED → GREEN → REFACTOR, exact-HEAD CI, evidence-before-completion.

**Goal:** Correct the body/flame front-rail compositing error using **actual eight SHA-verified Firefly source PNGs**, and generate a reviewable 512/128/64 real Godot multiframe packet. Preserve source identity and production release guards.

**Architecture:** Existing ORA top-first layer order places body above flame; the Godot v2 runtime draws child flame at z=4 above body z=0, wrongly covering the physically foreground brass center rail. Create a *non-destructive, derived pixel foreground-rail overlay* sampled from original body paint at authored world coordinates, preserve eight editable original ORA layers, add a separately labeled Sprite2D occlusion node above flame in the R9d-only scene. No SVG/legacy R8e paint, new model image, or rights claim. Capture real Godot animation at multiple times/scales and record objective pixel QA separately from visual/artistic approval.

**Tech Stack:** Node22, pngjs7, R9d source custody, OpenRaster, R9c Godot builder, pinned Godot, CI Xvfb and PNG QA.

**Spec:** `docs/superpowers/specs/2026-10-16-r9-ai-assisted-layered-art-production-design.md`; approval: owner 2026-10-17 explicitly approved R9d-05 technical plan.

## Fixed evidence / ruling
- Existing `cutout.json`: body `zIndex:0`, flame `zIndex:4`. Existing `src/ai-art/r9d-master.mjs` ORA stores `body_base` top-first, then four flames. Real painted 1024x1280 source and GitHub screenshot show a near-centered foreground bronze rail.
- Physical rail position from magnified real master: approximately x=475–510 and y=532–909 in master coordinates, while all flame placements occupy x≈439–585 and y=520–770. This is an **authored conservative polygon**, not a trustworthy auto-segmentation; professional 2.5D polishing remains P1.
- Preserve original OpenRaster SHA/source sidecars. Add only a separate derived overlay texture to Godot, no source-layer mutation or pretending native masks.
- `ARTISTIC_GO=NO`, `RIGHTS_UNVERIFIED`, `exportAllowed=false` even on technical PASS.

## Task 1 — Root cause / fail-first occlusion
- [ ] RED: `test/r9d-depth-occlusion.test.mjs` asserts original body pixels are unchanged, foreground-rail alpha is visible over all real four flame candidates in center, no foreground pixels outside authored conservative polygon, overlay RGBA matches original body at opaque interior and source hash remains unchanged; initially fail for missing module.
- [ ] Implement `src/ai-art/r9d-depth-occlusion.mjs` to derive the foreground PNG from the original body layer at known offsets with anti-aliased edge and exact source SHA, downsample RGBA safely 4x. Ensure minimum pixel overlap and fail closed on invalid/missing source.
- [ ] Full Node test GREEN; commit exact revision.

## Task 2 — Godot depth integration
- [ ] RED: assert exported R9d scene includes a separate `FrontCageRail` Sprite2D anchored at master-runtime origin, `z_index > flame.z_index`, texture from actual derived PNG, immutable source/derived hashes and export false; legacy R9c scene unchanged.
- [ ] Update only `src/export/godot-r9d-candidate.mjs`, preserving nine packed source atlas frames and all original R9d painting hashes.
- [ ] Full Node test GREEN, pinned Godot --editor/--headless real runtime GREEN.

## Task 3 — Real multi-time / 512-128-64 evidence
- [ ] RED: frame capture manifest contract (time set: 0, .125, .375, .75, 1.25, 1.875 sec), mandatory 512/128/64 screenshots per time, spatial nonblank and temporal changes; no fabricated "smoothness" score.
- [ ] Implement scoped `scripts/r9d-motion-capture.gd`, `scripts/r9d-motion-check.mjs` and CI step using actual scene/Xvfb; capture 18 PNGs and objective transition metrics.
- [ ] Preserve artifact (with exact HEAD, original SHA and mask polygon), visually inspect actual images and report `VISUAL_REVIEW_PENDING` until evidence merits qualified rating.

## Task 4 — Verify and review
- [ ] Actual Krita master interop unchanged; full exact HEAD PR CI and source-provenance CI GREEN.
- [ ] Same-account author technical code/security/visual self-review with real sample images; never call it independent.
- [ ] Keep PR #43 Draft; no merge, production release or commercial rights claims.
