# R9c — Raster source-to-Godot 4-pose vertical slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, with RED → GREEN → REFACTOR and exact-HEAD CI for each stage.

**Goal:** Use actual frozen PNG source layers (not SVG rasterization at runtime) as the cutout's atlas frame inputs, preserving the Spirit Lantern v2 rig/animation, and execute the output in pinned Godot.

**Architecture:** A new opt-in `RasterFrameProvider` takes a verified editable ORA + explicit part/pose-to-layer bindings, composites only the bound raster layers, downscales from 1024×1280 to 256×320 using straight-alpha-safe averaging, crops and returns the established `renderCutoutFrames` frame shape. Reuse `packAtlas` and the unchanged Godot scene/AnimationPlayer writer, but never pass raster data to the vector compiler. The existing compiled v2 cutout remains only the trusted **rig/animation manifest** and validation shell. Remove backup SVG paint sources from the raster project and visibly tag provenance as `LEGACY_VECTOR_RASTER_TECHNICAL` for the first demo; genuine R9d painting is out of scope.

**Tech Stack:** Node 22, pngjs 7, strict R9b ORA, immutable Spirit Lantern rig v2, existing atlas/Godot v2 writer, Godot 4.7.2 pinned by SHA256 via GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-16-r9-ai-assisted-layered-art-production-design.md`

## Global constraints
- Opt-in route only; do not change legacy `compileCutout`, SVG raster exporter, or MCP `export_godot_cutout` semantics.
- Full source rights and artistic evaluation remain `BLOCKED / UNSCORED`; no painted AI-origin claim.
- All layer bindings are exact and explicitly part-owned; reject missing, duplicate, foreign, malformed or stale binding/source hash.
- No filesystem path injection and no command-shell execution. Resource memory bound; frame count = 9 (5 base + 4 flame alternatives), atlas max 2048.
- Master = 1024×1280, runtime = 256×320; source demo may be explicitly labeled legacy runtime 256×320 until R9d master exists.
- Real 2-second idle, four flame poses at Godot texture nodes, light motion, pivot matching, and alpha crop checks.

## Review focus
1. Frame ownership and pose leakage: each flame variant maps to only its approved source.
2. Straight/premultiplied alpha and downsample halos.
3. Crop sourceRect and pivot offsets under frame changes.
4. Fail-closed hash/rights/source provenance and synthetic-art distinction.
5. Existing Godot scene writer only uses generated raster atlas for part textures, no vector paint frames in runtime.

## Task 1 — RasterFrameProvider (tests-first)
- [ ] RED: 9 fixtures, missing/duplicate pose, foreign owner, malformed PNG, invalid scale, crop and pivot.
- [ ] Implement `src/ai-art/raster-frame-provider.mjs` -> `renderRasterFrames({ora,bindings,parts,sourceSha256,sourceRevision,runtimeCanvas})` and a small compositing/downsample utility.
- [ ] GREEN: deterministic PNG hash and exact crop/pose owner checks, full Node tests.

## Task 2 — Opt-in Godot project bridge
- [ ] RED: rejected missing atlas regions and tampered source binding; no vector frame PNG generation; preserve legacy outputs.
- [ ] Implement `src/export/godot-raster-cutout.mjs`: render frames -> packAtlas -> verifyAtlas -> build Godot project using rig-only compiled authority. Strip per-part SVG backup paint sources from returned project; retain light.svg if Godot requires it. Add explicit `asset.json` evidence `paintedByAI:false;artisticReview:'UNSCORED';exportAllowed:false`.
- [ ] GREEN: assert 5 animated parts, 4 flame poses, 2-second idle, light, actual PNG hash on packed atlas.

## Task 3 — Actual pinned Godot runtime evidence
- [ ] RED: runtime script verifies AtlasTexture texture frame changes across 0, 0.125, 0.375, 0.75, 1.875 seconds; pivot offsets and light response; no frame is a vector fallback.
- [ ] Implement `scripts/r9c-godot-demo.mjs`, `scripts/r9c-godot-runtime-check.gd` and scoped CI stage with pinned Godot from existing CI.
- [ ] GREEN: remote Godot --editor import + --headless run and check real diagnostic success. Upload project/atlas/pixel screenshot evidence clearly marked technical; image similarity/seam motion and new AI artwork require later real gameplay capture/independent review.

## Merge and rights gate
R9b PR #40 remains Draft until independent exact-HEAD review and compatible merge policy. R9c PR is stacked on R9b branch until R9b is safely integrated. Do not merge/release without required independent review and exact-head CI, and never claim `ARTISTIC_GO`, `PROVIDER_ATTESTED`, or commercial rights from fixtures.
