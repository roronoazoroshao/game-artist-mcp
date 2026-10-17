# R9d-06 — Hybrid Flame Artistic Polish Design

**Status:** Design APPROVED IN CHAT (2026-10-17; owner chose option C/Hybrid). Written-spec review **PENDING**. No implementation authorized by this document alone.

**Repository:** `roronoazoroshao/game-artist-mcp` · PR #43, branch `feat/r9d-firefly-original-concept`.

## 1. User intent and boundaries

Create a professional-looking, readable 2.5D isometric xianxia **Spirit Lantern** with a lively cyan flame truly *inside* the bronze cage, rather than a copied/static 8 FPS pose slideshow. Success means visually coherent lighting and silhouette in actual Godot gameplay at 512px full-scene and 128/64px fixed-asset crops; the 2.0-second looping animation should not show objectionable flicker, seams or pivot jumps at any transition.

**Already proven (not to be re-claimed as new art):** R9d has eight SHA256-frozen, newly Adobe Firefly-painted PNGs (body, flame A–D, two talismans, tassel); a 1024×1280 editable ORA with five rig groups; eight separate derived-alpha masks; actual Krita round-trip; R9c nine-frame atlas and Godot runtime. R9d-05 added a *derived* foreground rail sprite at z=6, over `flame z=4`, and real six-time/three-scale Godot screenshots. Current source art remains `ART_UNSCORED`, rights are `UNVERIFIED`.

**Hard constraints:**
- Keep original eight PNG **byte-for-byte** intact, preserve `source-custody-001.json`, original ORA master bytes/hash `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361`, and existing rig source.
- Limit new animation/compositing behavior to **R9d opt-in**. No behavioral changes to shared R9c `buildGodotRasterCutout`, legacy R8e, or R9b OpenRaster readers.
- Retain canonical five rig parts, four distinct flame poses, original palette and frame/pose hashes; no silent AI repaint or deterministic recoloring falsely called Adobe-painted artwork.
- Preserve original 2.0s loop, underlying existing swing/bob/light tracks, front bronze rail at z=6, atlas and collision. The implementation may add *derived* textures and metadata, clearly labeled non-original.
- Fail closed on malformed/unknown Godot scene structure, SHA mismatch, missing frames, source provenance or artwork/rights claims.
- `ARTISTIC_GO` and `COMMERCIAL_RELEASE_GO` remain **false** until distinct visual review and provider-rights evidence, respectively. Owner-account code review is a self-review, not independent verification.

## 2. Considered approaches and decision

**A. Rig-only transform/light tweaks:** no new animation system, low risk, but does not remove hard texture frame jumps or major pose-dependent bright-region changes.

**B. Regenerate all four flame paintings with a model:** potentially larger artistic improvement but high style/custody risk, expensive and weak comparability with the frozen original.

**C. Hybrid (approved):** retain originals, deterministically normalize *presentation* (pose placement and restrained intensity only), add gentle derived in-cage underlight, and crossfade neighboring textures in an R9d-only Godot animation extension. Recommended because it preserves all eight painted sources and makes changes measurable and reversible.

## 3. Architecture and contracts

### 3.1 Flame optical balance — opt-in and non-destructive

Add `src/ai-art/r9d-flame-polish.mjs` providing a pure:

`planR9dFlamePresentation({master, atlas, rig, options?}) -> {poseSlots, correctionByPose, underlightPng, provenance}`

- Input must be the validated R9d master and nine verified atlas regions. Four flame poses must match canonical IDs `flame_a`, `flame_b`, `flame_c`, `flame_d` and retain immutable SHA records. Never substitute generated vector paint or image-preview JPEG.
- Measure actual alpha-weighted emissive centroid, visible area and brightness for each pose in shared **master** coordinates; separate true emission pixels from bloom or background using transparent alpha and cyan-dominant detection. Record raw metrics before applying adjustments.
- Correct *presentation* only: a bounded common-pivot translation and restrained opacity/energy coefficients. Initial safety bounds are **≤ 2 runtime px translation** from its existing localSpriteOffset, **0.90–1.10 per-pose visual intensity**, no arbitrary anisotropic stretching that deforms individual brush strokes. Coefficients must be finite and audited. Do not hide structural pose defects by exaggerating brightness.
- The underlight is a deterministic soft cyan **derived** low-alpha field, confined to the real inner glass/fire cavity, beneath the front rail, driven by approved `SpiritLight` and bounded in strength. Input to its mask comes from frozen painted body/inner-fire masks. The source region must not illuminate exterior dark background or appear over opaque foreground bronze. Treat the cavity region and mask as a revisable authored assumption, not segmentation truth.
- Output includes SHA256 of every derived pixel buffer, authored mask geometry/algorithm version, original source hashes, and `exportAllowed:false` / `artisticReview:'UNSCORED'`. No native Krita mask claims.

### 3.2 R9d-only 2-sprite crossfade; keep R9c stable

Add `src/export/r9d-flame-crossfade.mjs` as a scoped scene transformer used solely by `buildR9dCandidateGodotProject`. It must check the expected Godot scene, original `body/flame/Sprite2D` path, atlas SubResources, `Animation_idle`, old discrete flame texture/offset track and `FrontCageRail`; unknown layouts fail closed.

- Reuse the existing flame `Sprite2D` as **primary** and add exactly one **secondary flame Sprite2D** under the same flame Node2D, same global pivot/z-order and localSpriteOffset logic; both remain strictly below `FrontCageRail z=6`.
- Replace only the original `body/flame/Sprite2D:texture` and `:position` discrete tracks with deterministic primary/secondary texture, sprite position and complementary modulate-alpha tracks. Do not duplicate `SpiritLight`, mutate the rig IR, or remove rotation/scale/position tracks authored for other parts.
- Use the current `frameSequence.fps=8` (16 phase intervals over 2.0s) and preserve its **exact authored order**: `A,B,C,D,B,C,D,A,C,D,A,B,D,A,B,C`. Each 125ms interval holds its current pose briefly then blends into the *next entry in this sequence* over a bounded **55ms** window, including the actual **C→A** periodic boundary (D→A also occurs within the sequence). Do not replace this authored pose order with a simple repeating `A,B,C,D` cycle. At any sampled time, primary/secondary alphas are complementary `(1-w,w)`, `w∈[0,1]`. Both atlas textures use their own stored offsets; keep parent scale/position coherent.
- The final 2.0s end state must match 0.0s visually within native rendering tolerance (e.g. source texture, opacity, pivot and light energy). `AnimationPlayer.seek(t, true)` and looping playback must both reproduce the same result; don't rely on timer, network or wall clock.
- Parse/serialize scene changes through bounded, exact-match anchored generation, or emit an isolated R9d Godot script with a deterministic interface; never use unrestricted string replacement that could partially modify unrelated Godot tracks. Fail closed on unknown node IDs, duplicate track paths, invalid resource IDs or contradictory z ordering.
- Changes to animation properties belong to a versioned `r9d-flame-polish.json` in the R9d project. Keep existing original texture frame/pose descriptors for debugging and rollback; do not remove audit metadata.

### 3.3 Visual QA and artifacts

Extend `scripts/r9d-motion-capture.gd`, `scripts/r9d-motion-check.mjs` and `src/ai-art/r9d-motion-qa.mjs` to capture/compare **baseline R9d-05** and new R9d-06 rendering on the **same camera, Godot build, lighting and input art**.

- Preserve the existing six time samples and frame size semantics: 512 full scene, 128/64 **fixed 300×300 item crop**; additionally sample enough moments around each 125ms crossfade boundary and loop wrap to catch a flash or discontinuity. Baseline and candidate use identical sampling and crop.
- Measure real frame-by-frame centroid, mask overlap against the rail, cyan bright-pixel area, local alpha/edge halos and adjacent-frame pixel differences at all three sizes. The previously observed bright-area **~2.9×** range is a diagnostic baseline, *not* a scientifically validated aesthetic threshold or a requirement to eliminate natural fire variation.
- Establish explicit **measured baseline** before setting numerical visual acceptance thresholds. Gate regression on no pixel teleportation at pose boundaries, no glow appearing on opaque front bronze, no persistent halo artifacts, and no loss of 64px item readability. Passing these metrics means **TECHNICAL_VISUAL_QA_PASS**, not `ARTISTIC_GO`.
- Emit an honest contact sheet and optional 2s looping preview along with machine-readable per-sample metrics, exact source and derived texture SHA256, Godot engine version, CI run/HEAD and pre/post comparison. Never substitute AI-generated illustrative pictures for actual engine framebuffers.

## 4. TDD and release/rollback gates

1. **RED:** source-SHA, pose-coefficient bounds, hostile/tampered source, mask spill, and emissive-centroid edge tests.
2. **GREEN:** pure presentation planner returns bounded values and derived underlight with exact auditable hashes; leaves original source and frozen ORA unchanged.
3. **RED:** scene transformation rejects unexpected old frame track, duplicate sprite/AnimationTrack, broken wrap and overexposed double-image blend.
4. **GREEN:** primary+secondary render exact dual poses, complementary alpha and seamless 2s wrap; run actual headless Godot `--editor`, runtime, real Xvfb framebuffer sampling and six-time original regression.
5. **QA:** side-by-side 512/128/64 comparisons at transition boundaries, quantitative before/after results with baseline; actual editor Krita 5.2.2 8/8 world-coordinate source RGBA still exact.
6. **Security/arts:** owner-account code/security self-review with exact-head logs, art review packet and explicit unresolved rights/visual findings. Do not manufacture an independent person/approval.

**Merge gate:** Keep PR #43 **Draft/unmerged** while `ART_UNSCORED`, `RIGHTS_UNVERIFIED`, `exportAllowed:false`. No automatic merging solely because technical CI is green.

**Rollback:** Remove R9d-06-only presentation planner, underlight and scene transformer while retaining the R9d-05 Godot output and all frozen source PNGs/ORA. Validate unchanged original 8 source SHA256, unchanged R9b/R9c tests and unchanged protected output claims.

## 5. Spec review checklist (pending owner review)

- [x] Agreed Hybrid C design, purpose and alternatives recorded
- [x] Isolated interfaces, canonical rig/pose IDs and 2s temporal schedule specified
- [x] Source immutability, editor semantics, rollback and rights gates explicit
- [x] Crossfade wrap, pose offset, depth ordering and hostile-scene failure modes covered
- [x] Technical vs subjective art acceptance separated
- [ ] Owner has reviewed this **written spec**, not merely the earlier in-chat idea
- [ ] After spec approval: write and submit implementation plan using Superpowers writing-plans, then obtain plan approval before TDD work
