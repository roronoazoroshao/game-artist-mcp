# R9d-06 Hybrid Flame Artistic Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development, task-by-task. Each step is a checkbox (`- [ ]`) tracked through RED → GREEN → REFACTOR and exact-HEAD CI.

**Status:** Owner-approved 2026-10-17 for Native execution. PR #43 remains Draft.

**Goal:** Smooth the original Firefly-painted flame's 2-second motion and cavity lighting while preserving eight original painted PNGs and ensuring actual Godot visual QA at 512/128/64px.

**Architecture:** A pure R9d-only flame planner measures real alpha/cyan pixels and computes bounded display corrections plus a derived underlight; a guarded R9d-only Godot scene transformer swaps the hard 8-FPS texture jump for two complementary-opacity sprites. Real Godot captures compare identical baseline and candidate shots.

**Tech Stack:** Node >=22, pngjs 7, original source custody/OpenRaster, existing Godot atlas/rigger, pinned Godot, Krita 5.2.2, Xvfb and GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-17-r9d-06-hybrid-flame-artistic-polish-design.md`.

## Global Constraints

- All eight original Firefly source PNGs and custody SHA256 remain byte-for-byte unchanged; master ORA SHA256 `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361` immutable.
- Keep five rig parts, nine atlas frames, R9d-05 `body/FrontCageRail` z=6 over flame z=4, collision/light/bob/swing unchanged. Never edit shared `src/export/godot-raster-cutout.mjs` or `src/export/godot-cutout-v2.mjs`.
- Original 16 poses at 8 FPS for 2 seconds: `A,B,C,D,B,C,D,A,C,D,A,B,D,A,B,C`; wrap **C→A**. Only final **55ms of each 125ms slot** crossfades. Sprite opacities complementary.
- Placement correction ≤2 runtime px per axis from original `localSpriteOffset`; per-pose brightness multiplier in [0.90,1.10], no anisotropic source scaling.
- Underlight is deterministic, derived, ≤46/255 alpha, confined to painted cavity, behind bronze rail, never a second PointLight2D.
- `artisticReview:UNSCORED`, `commercialRightsCleared:false`, `exportAllowed:false`, PR stays Draft and unmerged; owner-account review is self-review, not independent approval.
- Each task must record explicit RED, GREEN, test suite and exact-head GitHub CI. Use no production merge.

## Review Focus

1. Tampered PNG/ORA/atlas and false custody claims → fail closed (Task 1).
2. Underlight spilling onto opaque metal/exterior → reject (Task 2).
3. Duplicate/unrecognized Godot tracks, resource IDs or nodes → fail without partial transformation (Task 3).
4. C→A wrap, wrong pose offset or 100%+100% flash → reject and test in real Godot (Tasks 3–4).
5. Fake/static captures, mismatched engine/camera/crop/time or tiny 64px prop → fail (Task 5).

---

### Task 1 — Immutable flame measurements and baseline

**Files:** Create `src/ai-art/r9d-flame-polish.mjs`, `test/r9d-flame-polish.test.mjs`, `scripts/r9d-06-baseline.mjs`.

**Interfaces:** `planR9dFlamePresentation({master,atlas,rig,options?})` returns `{poseSlots,correctionByPose,underlightPng,provenance}`, where `rig` is compiled.manifest and atlas regions carry `partId,poseId,pixelRect,localSpriteOffset,textureRect`.

- [ ] Write RED tests `rejects_tampered_source_or_master_SHA`, `measures_actual_cyan_alpha_centroids_for_four_poses`, `rejects_missing_or_extra_pose`, `finite_bounded_offsets_and_brightness`, `master_and_atlas_immutability`. Load real eight PNG bytes, not fixture-only data.
- [ ] Run `node --test test/r9d-flame-polish.test.mjs`; record intended RED before adding implementation.
- [ ] Implement original pose pixel centroid, visible area and luminance in shared 1024x1280 master coordinates; record source hashes and deterministic corrections ≤2px and 0.90–1.10. Fail closed on malformed art/rig data; placeholder for Task 2 underlight is explicit.
- [ ] Run `node --test test/r9d-flame-polish.test.mjs test/r9d-actual-master.test.mjs test/r9d-real-godot.test.mjs`; require GREEN; write a distinct `R9D05_BASELINE` metrics artifact before choosing visual pass thresholds.
- [ ] Commit `feat(r9d-06): measure and guard original flame pose presentation` and review source hashes, units and offset math.

### Task 2 — Derived in-cavity underlight

**Files:** Modify `src/ai-art/r9d-flame-polish.mjs`, `test/r9d-flame-polish.test.mjs`; read `src/ai-art/r9d-depth-occlusion.mjs` without changing R9d-05 rail.

**Interfaces:** `underlightPng` = verified PNG 256x320; `provenance.underlight` records SHA, mask geometry, no metal/exterior spill, max alpha ≤46.

- [ ] RED: tests for visibly nonzero cyan interior, zero exterior/opaque-rail overlap, valid CRC/dimensions/SHA, rejected malformed cavity and out-of-bounds intensity.
- [ ] Verify RED via `node --test test/r9d-flame-polish.test.mjs`.
- [ ] Implement deterministic soft cyan field bounded by authored mask intersected with source-painted cavity and excluding true rail alpha. Preserve original `SpiritLight` and painting SHA.
- [ ] GREEN: `node --test test/r9d-flame-polish.test.mjs test/r9d-depth-occlusion.test.mjs`; require measured zero spill and unchanged rail.
- [ ] Commit `feat(r9d-06): add masked cavity underlight with provenance`; inspect halo behavior.

### Task 3 — Scoped two-sprite crossfade compiler

**Files:** Create `src/export/r9d-flame-crossfade.mjs`, `test/r9d-flame-crossfade.test.mjs`.

**Interfaces:** `transformR9dFlameScene({scene,atlas,rig,presentation,durationSeconds:2}) → {scene,trackEvidence}`, scene is R9d-05 after `FrontCageRail` insertion. Evidence includes exact authored sequence, 16×125ms phases with final 55ms fade, C→A seam and per-pose offsets.

- [ ] RED: tests for exact sequence; 55ms endpoint; complementary alpha at 0/.070/.125/1.945/1.999/2; correct atlas offsets; unchanged swing/light tracks; reject duplicate/unrecognized resource/NodePath, double opacity.
- [ ] Verify RED with `node --test test/r9d-flame-crossfade.test.mjs`.
- [ ] Validate unique known scene IDs/tracks; replace only existing flame texture and position discrete tracks. Retain primary sprite, add exactly one secondary under same flame parent; create texture/offset and two complementary opacity curves. Godot resource updates discrete, alpha interpolated; avoid changing other nodes, light or rig.
- [ ] GREEN `node --test test/r9d-flame-crossfade.test.mjs test/r9d-real-godot.test.mjs`; assert alpha sum 1 within 1e-6, no wrong texture at loop; validate generated Godot scene.
- [ ] Commit `feat(r9d-06): add guarded dual-flame 55ms crossfade`.

### Task 4 — R9d opt-in Godot runtime

**Files:** Modify `src/export/godot-r9d-candidate.mjs`, `test/r9d-real-godot.test.mjs`, `scripts/r9d-real-godot-demo.mjs`, `.github/workflows/ci.yml`; create `scripts/r9d-06-runtime-check.gd`.

**Interfaces:** Only R9d adapter calls Task 1+2 planner and Task 3 transformer. Emit `flame-underlight.png`, `r9d-flame-polish.json` and preserve atlas, source lineage, five-part rig and blocked rights.

- [ ] RED: tests assert two flames below z=6, one original SpiritLight, original frame+source SHA unchanged, rejecting invalid scene/custody and near-wrap seek/autoplay mismatches.
- [ ] Run `node --test test/r9d-real-godot.test.mjs` (RED).
- [ ] Integrate, emit source/derived hashes; actual Godot script compares `AnimationPlayer.seek` and playback at 1.945,1.999,0,.001 seconds, checking textures, offsets, alpha, light and foreground ordering. Preserve explicitly selectable development baseline.
- [ ] GREEN local Node + full pinned-Godot import/headless/Xvfb CI on exact HEAD; require logged `R9D06_GODOT_LOOP_WRAP_TECHNICAL_OK`.
- [ ] Commit `feat(r9d-06): integrate R9d-only hybrid Godot flame rendering`.

### Task 5 — Real baseline-vs-hybrid three-scale QA

**Files:** Modify `scripts/r9d-motion-capture.gd`, `scripts/r9d-motion-check.mjs`, `src/ai-art/r9d-motion-qa.mjs`, `test/r9d-motion-qa.test.mjs`, `.github/workflows/ci.yml`; create `docs/reviews/2026-10-17-r9d-06-hybrid-visual-qualification.md`.

**Interfaces:** Keep `auditR9dMotionScreenshots({frames,sourceSha256})` backward compatible. New `auditR9d06TransitionComparison({baselineFrames,candidateFrames,sourceSha256,framing,frameTimesMs})`; identical 512 full frame, 128/64 fixed crop `Rect2i(106,75,300,300)`.

- [ ] RED: reject static/blank PNG, time/crop/camera/Godot mismatch, loop teleport, rail halo and too-small 64px item; preserve R9d-05 original six sample contract.
- [ ] Run `node --test test/r9d-motion-qa.test.mjs` (RED).
- [ ] Capture original six times 0,.125,.375,.75,1.25,1.875 plus fade-window and C→A seam at 1.945,1.999,0,.001; derive regression thresholds from real baseline data before marking PASS.
- [ ] GREEN Node and real pinned Godot/Xvfb capture; archive actual before/after PNGs, 512/128/64 contact sheets, crop metadata, engine version, SHA and honest measured delta report. Technical QA ≠ ARTISTIC_GO.
- [ ] Commit `test(r9d-06): quantify actual Godot crossfade at three scales`.

### Task 6 — Exact HEAD review + handoff (no merge)

**Files:** Update visual qualification review, PR #43 description and owner self-review `COMMENT`; no production code change absent new RED→GREEN P0/P1 fix.

- [ ] Run `node --test test/r9d-flame-polish.test.mjs test/r9d-flame-crossfade.test.mjs test/r9d-real-godot.test.mjs test/r9d-motion-qa.test.mjs test/r9d-actual-master.test.mjs test/r9d-depth-occlusion.test.mjs` and `npm test`; retain totals and skips.
- [ ] Check exact-head full PR/push CI, actual Krita 5.2.2, Godot frame jobs SUCCESS; verify unmodified eight PNG/ORA SHA and R9c shared behavior.
- [ ] Review visual results at 512/128/64 for glow spill/ghost edges/seams; record unresolved art/rights, and TDD-fix any real P0/P1.
- [ ] Submit self-review as GitHub COMMENT with exact SHA, evidence links and honest `ART_UNSCORED` /`RIGHTS_UNVERIFIED`.
- [ ] Keep PR #43 Draft/unmerged, main untouched and `exportAllowed:false` until separate approvals.

## Plan self-review and rollback

- [x] Six tasks cover source SHA, raw pose metrics, constrained underlight, exact 16-frame timing/C→A seam, opt-in renderer, real Godot QA, Krita and blocked rights.
- [x] Every task has tests, RED, GREEN, commit and bounded interface.
- [x] All five review-focus failure modes have negative tests.
- [x] Rollback: remove R9d-only presentation/underlight/scene transformer and restore R9d-05 renderer without changing original PNGs or shared R9c.
- [x] **Owner approved Implementation Plan 2026-10-17**; Native execution selected from the preceding recommendation.

**Current gate:** owner approved implementation; technical implementation must still prove each RED → GREEN and exact-head CI before any success claim.
