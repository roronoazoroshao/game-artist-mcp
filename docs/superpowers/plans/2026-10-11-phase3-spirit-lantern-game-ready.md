# Phase 3 Spirit Lantern Game-Ready Cutout v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an original material-aware Ancient Spirit Lantern with 5 cutout parts, 4+ authored flame poses, deterministic animation, optimized PNG atlas, actual image-visible MCP previews and a verified Godot 4 game-ready demo.

**Architecture:** Opt-in CutoutManifest v2 validates and compiles a revision-bound ArtDocument v1 into pose-selected SVG/PNG, crop and atlas metadata, animation clips and immutable Godot export packages. Preserve legacy v1 behavior and reuse FolderForge only as host/control plane. Technical/visual/provenance gates must remain distinct.

**Tech Stack:** Node.js >=22, ES modules, node:test, pinned librsvg `rsvg-convert version 2.58.0`, `pngjs@7.0.0` with exact npm package-lock and dependency security gate, Godot 4.7.2-stable from pinned SHA-256 `cadd3204e728a35d3f13adb7fd0d7902636b79f6b95c40c265eb73b6c35329e4`.

**Spec:** `docs/superpowers/specs/2026-10-11-phase3-spirit-lantern-game-ready-design.md`, approved and merged as PR #27, current main `d968b05544e789829ea05562c05755e82917de1a`.

**Current authorization:** Documentation plan-writing only. This is a **PROPOSED implementation plan**; no product code, new runtime dependency, merged PR or deployment is authorized until this plan is reviewed and a distinct execution approach is approved.

## Global Constraints

- Maintain ArtDocument v1, all POC-001/002/003/004 and POC-005A/B/C1/C2 behavior and original historical sources, output hashes and evidence. The existing 256×320 Lantern / CutoutManifest v1 / full-canvas SVG exporter / render_preview remain unchanged. The v1 `UNSUPPORTED_GODOT_APPEARANCE` assertion MUST continue to pass.
- v2 explicitly selected by manifest.version===2, with strict schema fields, owner uniqueness, no unowned visible nodes, finite source-space pivots, valid acyclic parents, validated materials and identical source revision + canonical document SHA on every output.
- v2 caps: 64 parts; 64 node IDs/part; 16 pose variants; 16 frame sequence entries/clip; 1–24 fps; 60-second clip; 128 tracks and 64 keys/track; atlas <=2048×2048; padding 2–8 px (default 4); positive scales; fixed raster memory/bytes/time budgets.
- Five mandatory Lantern parts: body, flame, talisman_left, talisman_right, tassel; 4–8 unique explicit flame pose drawings and coordinated cyan emission. Original art direction, no IP copying, no generative image/3D synthesis.
- Mechanical animation gate: >=2 loops at >=30 Hz and exact seam samples; seam translation<=0.5px, scale<=0.01, rotation<=0.01rad, light energy<=0.02; at 30 Hz step translation<=4px, scale<=0.05, rotation<=0.04rad, light energy<=0.15.
- Use vetted `pngjs@7.0.0` only AFTER lockfile integrity/license/advisory review; `npm ci --ignore-scripts` in CI. Reject malformed/inflated PNG before parsing and bound decoded RGBA size. Never manually infer alpha bounds from SVG path text. If the dependency cannot pass review, STOP and seek separate re-plan; do not silently substitute unsafe code.
- Godot resource mapping is **AtlasTexture** with region/filter_clip and precisely tested centered Sprite2D offset = source crop center minus part pivot. Do not mix with Sprite2D.region_enabled.
- v2 export writes immutable per-hash project directory and switches a small validated manifest pointer atomically. DO NOT destroy the existing v1 `godot/` directory or previously completed v2 exports. No untrusted scripts, custom GDScript, dynamic shader, shell interpolation, arbitrary URL/path, separate MCP control plane or paid inference.
- Image-visible preview must be real PNG bytes for exact asset revision/clip/time/pose, not base SVG text and not a fabricated provider image-delivery attestation. Existing `render_preview` stays unchanged.
- POC-005C1 [Issue #21](https://github.com/roronoazoroshao/game-artist-mcp/issues/21) remains `VISUAL_REVIEW_PENDING` absent two real non-author humans. POC-005C2 Task 8 remains `PROVIDER_ATTESTATION_UNAVAILABLE`. CI never grants `VISUAL_GO`, `PRODUCTION_READY` or authenticated agent-autonomy proof.
- Each implementation task follows TDD RED→GREEN, exact scoped commit, regression tests. Before merging later product PR: exact-HEAD PR CI success, code/security review with honest `AI_SELF_REVIEW` label when independent agent unavailable, owner-authorized integration, post-merge main CI success and safe cleanup to only main.

## File Ownership / Interface Map

| Owner | Exact files | Output consumed downstream |
| --- | --- | --- |
| T1 compatibility/dependency | `package.json`, new `package-lock.json`, `.github/workflows/ci.yml`, `test/cutout-v1-compat.test.mjs` | pinned PNG API, v1 golden hashes |
| T2 contract | new `src/cutout/validate-v2.mjs`; modify `src/cutout/validate.mjs`; new `test/cutout-v2-contract.test.mjs` | `validateCutoutV2(document,manifest): {ok,errors,warnings}` |
| T3 compiler | new `src/cutout/compile.mjs`, `test/cutout-compile.test.mjs` | `compileCutout(document,manifest,{revision}): NormalizedCutout`; `selectPartDocument(compiled,partId,poseId): ArtDocument` |
| T4 animation | new `src/cutout/animation.mjs`, `src/cutout/qa.mjs`, `test/cutout-animation.test.mjs` | `sampleAnimation(compiled,clipId,t): FrameState`, `auditLoop(compiled,clipId): QaReport` |
| T5 crop/raster | new `src/cutout/raster.mjs`, `test/cutout-raster.test.mjs` | `renderCutoutFrames(compiled,{rasterizeSvg}): Promise<FrameImage[]>`; `cropAlphaPng(png,{paddingPx}): CropImage` |
| T6 atlas | new `src/cutout/atlas.mjs`, `test/cutout-atlas.test.mjs` | `packAtlas(frames,opts): AtlasPackage`; `verifyAtlas(pkg): {ok,errors}` |
| T7 Godot compiler | new `src/export/godot-cutout-v2.mjs`, `test/cutout-godot-v2.test.mjs`; modify `src/export/godot-cutout.mjs` | `buildGodotV2Project(compiled,atlas,qa): Map<relativePath,Buffer|string>` |
| T8 immutable publishing | new `src/export/atomic-package.mjs`, `test/cutout-atomic-export.test.mjs`; modify `src/mcp/server.mjs` | `publishGodotPackage({store,assetId,expectedRevision,sourceSha256,files}): Promise<{projectPath,packageSha256}>` |
| T9 frame preview | new `src/cutout/preview.mjs`, `test/cutout-preview-mcp.test.mjs`; modify `src/mcp/server.mjs` | `renderCutoutPreview({compiled,clipId,timeSeconds,rasterizeSvg}): Promise<{png,frame,digest}>`, MCP `render_cutout_preview` |
| T10 original art | new `examples/spirit-lantern/v2/source.json`, `cutout.json`, `test/spirit-lantern-v2-art.test.mjs`, `scripts/phase3-preview.mjs` | styled, explicit vector Lantern + at-size real review bundle |
| T11 runtime+CI | new `scripts/phase3-godot.mjs`, `test/phase3-integration.test.mjs`; modify `package.json`, `.github/workflows/ci.yml`, `docs/ROADMAP.md` and `docs/project/NEXT_RUN_PROMPT.md` | run Godot4 2-cycle evidence, full gates and true handoff |

## Review Focus — five easy-to-miss failures and owning tests

1. Hostile SVG path/transform material escapes to URL, file, DTD or script. T2 enforces safe transform grammar, T5 renders only allowlisted output; assert no network/file side effects on injected inputs.
2. Half-transparent glow/glass strokes disappear because alpha crop ignores antialias pixels or off-by-one borders. T5 uses any alpha >0, T6 asserts odd-crop reconstruction and gutter bleed.
3. Variant flame nodes render together or leak across frames. T3 asserts mutually exclusive pose nodes, T9 compares actual PNG frames and selected pose ID.
4. NaN/duplicate times/negative scale/interpolated overshoot create a popping loop. T2 validates key structure, T4 samples 2 complete cycles and checks exact numeric limits.
5. Failed render/write, symlinked destination or concurrent document edit corrupts last-good Godot project. T8 injects failures and verifies old package/pointer unchanged.

---

### Task 1: Freeze v1 regressions and pin PNG dependency

**Files:** Modify: package.json, .github/workflows/ci.yml. Create: package-lock.json, test/cutout-v1-compat.test.mjs.

**Interfaces:** Use existing renderSvg and exportGodotCutout v1; lock pngjs@7.0.0 with documented npm integrity/Node22/librsvg/Godot versions. A golden test must compare outputs against previously frozen approved-main bytes, NEVER regenerate its expected hash from changed code.

- [ ] **Step 1 — Write failing test:** Create a v1 golden regression test: exact SVG and five full-canvas exported part SHA-256s from approved main; original cutout validates and v1 material-aware export throws UNSUPPORTED_GODOT_APPEARANCE. Deliberately start without recorded baseline so RED.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-v1-compat.test.mjs -> FAIL: no frozen golden yet.`
- [ ] **Step 3 — Implement minimum solution:** Record SHA-256 baselines from untouched approved main, pin pngjs@7.0.0 via npm install --save-exact pngjs@7.0.0 --package-lock-only --ignore-scripts; use npm ci --ignore-scripts. Audit dependency, license and lock integrity; fail/block on unaccepted advisories. Replace CI npm install --ignore-scripts with npm ci --ignore-scripts.
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-v1-compat.test.mjs test/cutout.test.mjs test/appearance-godot.test.mjs; npm audit --omit=dev; npm test -> PASS, 0 unaccepted advisories.`
- [ ] **Step 5 — Scoped commit:** `git add package.json package-lock.json .github/workflows/ci.yml test/cutout-v1-compat.test.mjs && git commit -m "test(cutout): freeze legacy output and pin PNG codec"`.


### Task 2: Strict v2 manifest, ownership, animation schema

**Files:** Create: src/cutout/validate-v2.mjs, test/cutout-v2-contract.test.mjs. Modify: src/cutout/validate.mjs.

**Interfaces:** validateCutoutV2(document,manifest) returns {ok:boolean, errors:string[],warnings:string[]}; validateCutout dispatches v1 unchanged or v2 strict, rejects other versions. v2 fields required: version=2, assetId, parts, animations, rendering, poseVariants, frameSequence; light/collision optional. Rendering format atlas_png/scale=1/padding 2..8/maxAtlasSize<=2048. FrameSequence(part,fps,frames,loop) and pose variants use snake_case IDs. v2 track properties rotation,position,scale,light_energy; linear|smoothstep interpolation.

- [ ] **Step 1 — Write failing test:** Test valid v2 fixture passes; extra field, duplicate part ID/part node/pose node, invisible-orphan node, wrong variant part, missing flame frame, unsafe ID/transform/script URL, parent cycle, out-of-canvas/NaN pivot, duplicate/unsorted times, zero scale, unknown light_energy target and limits (>64 parts, >64 nodes/part, >16 poses, >16 sequence entries, >24fps, >60s, >128 tracks, >64 keys) fail. v1 accepted unchanged.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-v2-contract.test.mjs -> FAIL: v2 formerly rejected, missing module.`
- [ ] **Step 3 — Implement minimum solution:** Implement required-key allowlist; base nodes uniquely assigned to one part, variant nodes uniquely assigned only to a variant owned by its part; any unowned visible source node ERROR, no warnings. Require continuous key first=0/last=clip.length for cyclic tracks; finite floats, strictly increasing times; scale >0, light energy 0..16, frame ids valid. Reject arbitrary SVG transform grammar or use a restricted numeric translate/rotate/scale AST parser.
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-v2-contract.test.mjs test/cutout.test.mjs test/appearance-godot.test.mjs -> PASS; preserve v1 hash.`
- [ ] **Step 5 — Scoped commit:** `git add src/cutout/validate-v2.mjs src/cutout/validate.mjs test/cutout-v2-contract.test.mjs && git commit -m "feat(cutout): validate opt-in v2 schema and ownership"`.


### Task 3: Deterministic revision-bound compiler and pose visibility

**Files:** Create: src/cutout/compile.mjs, test/cutout-compile.test.mjs.

**Interfaces:** compileCutout(document,manifest,{revision}) validates, returns frozen NormalizedCutout with canonical sha256 sorted-object-key JSON + unchanged-array-order, original canvas and sourceRevision. selectPartDocument(compiled,partId,poseId) yields valid ArtDocument v1 containing only selected base/variant part nodes in stable original z order; explicit base pose represented by null, not magic alias.

- [ ] **Step 1 — Write failing test:** For same inputs, exact sourceSha and normalized pose mapping repeat; no mutation; material edit changes digest; bad revision/pose rejected; select flame_b excludes base flame and other three flame poses, no duplicate anatomy, selected document's validators pass.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-compile.test.mjs -> FAIL missing compiler module.`
- [ ] **Step 3 — Implement minimum solution:** Use existing validateDocument+validateCutoutV2; normalized lookup maps enforce exclusive variants and guarantee v1 source remains untouched. Define stable canonical digest bytes, no dependency on host platform JSON key insertion. Keep document+manifest digests distinct.
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-compile.test.mjs test/cutout-v2-contract.test.mjs -> PASS.`
- [ ] **Step 5 — Scoped commit:** `git add src/cutout/compile.mjs test/cutout-compile.test.mjs && git commit -m "feat(cutout): compile exact revision and mutually exclusive poses"`.


### Task 4: Clip sampler, synchronized light and continuity QA

**Files:** Create: src/cutout/animation.mjs, src/cutout/qa.mjs, test/cutout-animation.test.mjs.

**Interfaces:** sampleAnimation(compiled,clipId,timeSeconds) -> {parts:{partId:{position:[x,y],scale:[x,y],rotation,poseId}},lightEnergy,timeSeconds}; missing transform defaults position [0,0], scale [1,1], rotation 0; light defaults to v2 manifest or zero. Frame selection frames[floor(time*fps)%frames.length]. auditLoop(compiled,clipId)->{ok,errors,metrics:{samples,cycles,maxSeamDelta,maxStepDelta}}.

- [ ] **Step 1 — Write failing test:** Check t=0/0.5/1/2 scalar and Vec2 samples, 4 unique frames at fps8, distinct talisman phases and delayed tassel; smoothstep bounded; duration modulo sequence period=0; 2x30Hz samples plus eps seam; fail seam >0.5px/0.01scale/0.01rad/0.02energy; fail step >4px/0.05scale/0.04rad/0.15energy; NaN time, negative scale and impossible clip fail.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-animation.test.mjs -> FAIL missing sampler.`
- [ ] **Step 3 — Implement minimum solution:** Use deterministic monotonic key interpolation linear/smoothstep u*u*(3-2*u) and numerical sampling at cycle boundaries; positive scale guaranteed. Distinguish discrete frame changes from continuous transform jumps, avoid claiming aesthetic quality from sampled physics.
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-animation.test.mjs test/cutout-v2-contract.test.mjs -> PASS.`
- [ ] **Step 5 — Scoped commit:** `git add src/cutout/animation.mjs src/cutout/qa.mjs test/cutout-animation.test.mjs && git commit -m "feat(cutout): sample animation and audit mechanical loop"`.


### Task 5: Guarded SVG->PNG raster, material rendering, alpha crop

**Files:** Create: src/cutout/raster.mjs, test/cutout-raster.test.mjs.

**Interfaces:** renderCutoutFrames(compiled,{rasterizeSvg}): Promise<FrameImage[]> uses renderSvg per selected part/pose. cropAlphaPng(png,{paddingPx}): CropImage{pixels,width,height,contentRect,sourceRect,sourcePngSha256}. Limit each PNG compressed <=8MiB, IHDR dimensions <=4096 and decoded RGBA <=16MiB, SVG <=1MiB and rsvg timeout <=8000ms/frame.

- [ ] **Step 1 — Write failing test:** PNG with 1 opaque pixel, odd dimensions, half-alpha fringe, glow extending beyond geometry, transparent borders must preserve every alpha>0; empty pixels fail; tampered signature/IHDR CRC, unsupported depth/interlace, excessive decompressed size, external SVG URL/script/DTD and path escape fail; gradients, hand-directed marks and glow remain after real rsvg render.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-raster.test.mjs -> FAIL missing raster module.`
- [ ] **Step 3 — Implement minimum solution:** Preflight PNG header and CRC/bounds BEFORE pngjs.sync.read; accept only modes emitted by pinned rsvg; execFile rsvg with argument arrays (no shell) and cleaned temp sandbox. Stable rendering order, caught timeout, no external refs. No manual SVG-bounds approximation.
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-raster.test.mjs test/appearance-render.test.mjs -> PASS, plus actual pinned rsvg integration.`
- [ ] **Step 5 — Scoped commit:** `git add src/cutout/raster.mjs test/cutout-raster.test.mjs && git commit -m "feat(cutout): safely rasterize and alpha-crop material parts"`.


### Task 6: Reproducible packed atlas and precise crop/pivot metadata

**Files:** Create: src/cutout/atlas.mjs, test/cutout-atlas.test.mjs.

**Interfaces:** packAtlas(frames,{maxAtlasSize=2048,paddingPx=4}) -> {png,atlasWidth,atlasHeight,regions,atlasSha256}; verifyAtlas(pkg)->{ok,errors}. Regions keyed partId+poseId with crop pixelRect, contentRect, atlas region, pivotSource, localSpriteOffset, sourceSvgSha256/sourcePngSha256. localSpriteOffset=cropCenterMinusPivot in source pixels.

- [ ] **Step 1 — Write failing test:** 10 randomized input orders yield identical PNG/hash; 5 parts+4 poses do not overlap; atlas max2048, padding 2..8, extruded gutter doesn't bleed into adjacent regions; odd x0=7,y0=9,w11,h13,pivot[12,15] reproduces center within 0.5px; duplicate keys/invalid rectangle/exceed-limit throw ATLAS_OVERFLOW.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-atlas.test.mjs -> FAIL missing packer.`
- [ ] **Step 3 — Implement minimum solution:** Deterministic lexicographic shelf pack, no rotation, transparent PNG RGBA, fail-closed on oversize, optional interior-gutter edge extrusion. Encode PNG with pinned pngjs, verify all rects/digests, choose only Godot AtlasTexture with filter_clip; never rely on Sprite2D.region_enabled.
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-atlas.test.mjs test/cutout-raster.test.mjs -> PASS.`
- [ ] **Step 5 — Scoped commit:** `git add src/cutout/atlas.mjs test/cutout-atlas.test.mjs && git commit -m "feat(cutout): pack bounded atlas with pivot-correct UVs"`.


### Task 7: Generate Godot 4 v2 resources and animation

**Files:** Create: src/export/godot-cutout-v2.mjs, test/cutout-godot-v2.test.mjs. Modify: src/export/godot-cutout.mjs for explicit manifest version dispatch only; v1 generation path remains byte-identical.

**Interfaces:** buildGodotV2Project(compiled,atlas,qa): Map<relativePath,Buffer|string>, no filesystem writes. Return resource files atlas.png/atlas.json, source SVG metadata, .tscn with 5 pivots and AtlasTexture subresources, AnimationPlayer clip with position/rotation/scale and discrete Sprite2D:texture tracks, PointLight2D:energy, fixed typed validation.gd.

- [ ] **Step 1 — Write failing test:** Five canonical part nodes, correct parent world positions and crop sprite offset, texture region/margin mapping, animated flame frame swapping (exactly one visible pose) and synced energy keys. Fail malformed NodePath/resource name or user-supplied script; no legacy v1 hash drift.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-godot-v2.test.mjs -> FAIL absent v2 generator.`
- [ ] **Step 3 — Implement minimum solution:** Use safe string templates with validated IDs, existing Node2D parent hierarchy, animation resource keyframes (discrete texture tracks and bounded continuous transforms), new v2-only PNG AtlasTexture sources; no arbitrary GDScript and no new Godot control plane.
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-godot-v2.test.mjs test/appearance-godot.test.mjs test/cutout-v1-compat.test.mjs -> PASS; actual Godot parse/run is a later hard gate, NOT replaceable with text-only checks.`
- [ ] **Step 5 — Scoped commit:** `git add src/export/godot-cutout-v2.mjs src/export/godot-cutout.mjs test/cutout-godot-v2.test.mjs && git commit -m "feat(godot): compile Lantern atlas and animation resources"`.


### Task 8: Immutable, race-safe v2 export publishing

**Files:** Create: src/export/atomic-package.mjs, test/cutout-atomic-export.test.mjs. Modify: src/mcp/server.mjs only v2 export dispatch.

**Interfaces:** publishGodotPackage({store,assetId,expectedRevision,sourceSha256,files}) -> {projectPath,packageSha256}. Publish validated regular files under assets/<id>/godot-versions/<packageSha256>/, then atomically replace fixed JSON pointer godot-v2-current.json via same-filesystem rename. MCP v2 response project points to immutable path; v1 returns original assets/<id>/godot.

- [ ] **Step 1 — Write failing test:** Render failure, failing fs write, wrong revision/source digest, duplicate or traversal filename, symlinked parent, concurrent mutation all leave existing pointer/version untouched; unknown manifest rejected BEFORE write; no files outside root; injected incomplete files never visible as 'current'.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-atomic-export.test.mjs -> FAIL missing publisher.`
- [ ] **Step 3 — Implement minimum solution:** Use bounded path allowlist, lstat/open nofollow for destination validation, private 0700 staging and 0600 files, digest verified and fsynced, exclusive staging publish, serialized per-asset v2 export within process, revision+SHA checked after building and immediately before pointer swap. Clarify cross-process limitation; if unable to maintain atomic published state, STOP rather than rm(godot).
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-atomic-export.test.mjs test/cutout-v1-compat.test.mjs -> PASS; inspect filesystem after simulated faults.`
- [ ] **Step 5 — Scoped commit:** `git add src/export/atomic-package.mjs src/mcp/server.mjs test/cutout-atomic-export.test.mjs && git commit -m "feat(export): publish revision-checked immutable Godot v2 packages"`.


### Task 9: Exact-frame MCP image preview without legacy breaking changes

**Files:** Create: src/cutout/preview.mjs, test/cutout-preview-mcp.test.mjs. Modify: src/mcp/server.mjs, tool declaration + read-only handler.

**Interfaces:** renderCutoutPreview({compiled,clipId,timeSeconds,rasterizeSvg}) -> Promise<{png:Buffer,frame:FrameState,digest:string}>. MCP render_cutout_preview accepts exactly {asset_id,cutout,clip_id,time_seconds}, returns text/structuredContent with asset_id,revision,clip_id,time_seconds,pose_ids,sha256 plus real {type:'image',mimeType:'image/png',data:base64}; never claims provider receipt.

- [ ] **Step 1 — Write failing test:** Actual stdio MCP tools/list includes tool; at t=0 vs .75 different PNG hash/pose; decoded PNG hash matches response; no overlapping alternative flames; NaN/negative/out-of-range time, invalid part/clip, unknown JSON field, stale source and duplicate JSON keys all fail; old render_preview remains identical/read-only.
- [ ] **Step 2 — Verify RED:** `node --test test/cutout-preview-mcp.test.mjs -> FAIL unknown MCP tool.`
- [ ] **Step 3 — Implement minimum solution:** Compose selected-part SVG in source-space transform hierarchy/z order with scoped defs, sample clip time, rasterize through bounded rsvg; no unsafe raw SVG injection. Reject old revision after concurrent edit; encode actual PNG image content. Maintain old tools/list entries unchanged.
- [ ] **Step 4 — Verify GREEN:** `node --test test/cutout-preview-mcp.test.mjs test/appearance-mcp.test.mjs test/cutout-v1-compat.test.mjs -> PASS.`
- [ ] **Step 5 — Scoped commit:** `git add src/cutout/preview.mjs src/mcp/server.mjs test/cutout-preview-mcp.test.mjs && git commit -m "feat(mcp): expose real pose-selected PNG preview"`.


### Task 10: Author original game-art Lantern, test quality recipe

**Files:** Create: examples/spirit-lantern/v2/source.json, examples/spirit-lantern/v2/cutout.json, test/spirit-lantern-v2-art.test.mjs, scripts/phase3-preview.mjs.

**Interfaces:** Use approved five parts, 4–8 explicit contour+core flame shapes, 8fps <=16-slot repeating sequence over 2s idle, non-symmetric hinged papers, delayed tassel and synchronized bounded emission. Keep old source.json/cutout.json unchanged. Render actual first/revised 64px/128px and two-cycle previews with SHA evidence.

- [ ] **Step 1 — Write failing test:** Style dark-cultivation-v1, base+variant node ownership, 4 distinct rendered flame shapes, mechanical 2-loop QA, asymmetry/readability checks and nonidentical talisman curves. Preview bundle must contain actual bytes and digest, not generated test fixtures labelled artistic PASS.
- [ ] **Step 2 — Verify RED:** `node --test test/spirit-lantern-v2-art.test.mjs -> FAIL missing v2 fixtures.`
- [ ] **Step 3 — Implement minimum solution:** Author explicit original Art IR geometry/material gradients/marks/glow, inspect actual PNG output via v2 tool and record targeted same-asset critique/correction IF genuinely image-visible workflow available. Otherwise label SELF_REVIEW/UNSCORED and keep visuals pending; never invent an independent critic.
- [ ] **Step 4 — Verify GREEN:** `node --test test/spirit-lantern-v2-art.test.mjs; node scripts/phase3-preview.mjs -> PASS technical and produce inspectable 64/128 preview files/contact sheet. If art not legible, improve in bounded edit loops and re-verify rather than asserting production quality.`
- [ ] **Step 5 — Scoped commit:** `git add examples/spirit-lantern/v2/source.json examples/spirit-lantern/v2/cutout.json test/spirit-lantern-v2-art.test.mjs scripts/phase3-preview.mjs && git commit -m "art(lantern): build original animated spirit flame and cutout layers"`.


### Task 11: Full MCP→Godot runtime verification, CI release discipline

**Files:** Create: scripts/phase3-godot.mjs, test/phase3-integration.test.mjs. Modify: package.json, .github/workflows/ci.yml, docs/ROADMAP.md, docs/project/NEXT_RUN_PROMPT.md.

**Interfaces:** Add npm run poc:phase3; script uses real child MCP, new preview+v2 export, frozen art source, SHA and actual pinned Godot 4.7.2 engine. Export new SUCCESS marker GAME_ARTIST_PHASE3_OK only after checking texture changes, 3 runtime transform/energy samples, 2 full cycles, proper RGBA/atlas and no import errors. Keep POC-004 gate GAME_ARTIST_POC004_OK.

- [ ] **Step 1 — Write failing test:** Capture new Godot headless failure before implementation; assert final scene has five parts, valid AtlasTexture, actual animated flame frame at 0/.5/1 second, bounded light, repeatable SHA and fail-closed bad resource; raw MCP preview delivered. Count all old tests and artifacts without tampering with POC-005C1/C2.
- [ ] **Step 2 — Verify RED:** `node --test test/phase3-integration.test.mjs -> FAIL missing integration; node scripts/phase3-godot.mjs -> FAIL until new runtime scenes correctly generated.`
- [ ] **Step 3 — Implement minimum solution:** Create typed GDScript verification/scene through bounded fixed generator; add CI npm ci, Node tests, original POC-004 headless, Phase 3 headless, FolderForge child plugin, synthetic POC005A/C1/C2 with unchanged labels, archive technical art previews only. Pin Godot, no hosted paid providers. Stage docs closeout only after actual verified merge.
- [ ] **Step 4 — Verify GREEN:** `npm ci --ignore-scripts; npm test; npm run smoke:mcp; npm run poc:004; npm run poc:phase3; npm run poc:005c2:capabilities; npm run poc:005c2:audit:dry; exact-head GitHub Actions CI SUCCESS. Real pinned Godot must print GAME_ARTIST_PHASE3_OK with zero parser warnings/errors; no skip or fake marker.`
- [ ] **Step 5 — Scoped commit:** `git add scripts/phase3-godot.mjs test/phase3-integration.test.mjs package.json .github/workflows/ci.yml docs/ROADMAP.md docs/project/NEXT_RUN_PROMPT.md && git commit -m "test(phase3): verify authored cutout end-to-end and hand off"`.

## Final product execution / merge rules (NOT authorized by this plan PR)

1. After separately approved written plan and explicit **Native** or **Subagent-driven** execution choice, verify live main, work in an isolated product branch `product/phase3-spirit-lantern-v2`. Use Superpowers TDD and systematic debugging.
2. Complete Tasks 1–11 in sequence; each is independently reviewable. If dependency/atomicity/Godot runtime assumptions are invalid, STOP and revise plan; do not quietly lower acceptance gates.
3. Run exact-head full tests, adversarial security checks, verified Godot headless and real art previews. Distinguish `TECHNICAL_PASS` from self-reviewed aesthetics; retain Issue #21 and C2 provider evidence blocks.
4. Open product PR, exact-head CI SUCCESS, independent review if actually available (otherwise label `AI_SELF_REVIEW`), owner release/merge authorization as required; merge and verify post-merge main CI + cleanup [main] only. Branch cleanup is an execution deliverable, not a plan-writing action.
5. Retain redacted handoff evidence: all commits/run URLs, SHA hashes, unfinished external gates and exact remaining risks. Never claim background autonomous operation.

## Written plan self-review against approved spec

- [x] Every major spec section maps to a concrete task: opt-in v2 schema (T2), revision/pose compiler (T3), authored animation/loop QA (T4), appearance raster and alpha crop (T5), atlas/pivot (T6), Godot resource export (T7), transactional safety (T8), time-selected image preview (T9), real art/correction artifacts (T10), runtime verification/CI (T11).
- [x] Five Review Focus hazards each have a named negative test (T2–T9).
- [x] Every task includes exact files, declared interface, RED/GREEN commands with expectations and scoped commit.
- [x] No implementation, plan-merge permission, paid inference, forged human reviewer or provider proof is inferred from this planning approval.
- [x] Existing v1 and synthetic/provenance regressions remain first-class CI gates.

**STOP HERE:** This PR is **documentation only**. Reviewer must APPROVE or REQUEST_CHANGES on this written plan and select **Native** or **Subagent-driven** execution method. Recommended: **Native**, because every task depends on the previous compiler interface; use independent technical review when real reviewer tooling is available. No product code until that next authorization.
