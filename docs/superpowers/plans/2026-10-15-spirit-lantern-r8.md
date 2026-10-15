# Spirit Lantern R8 — Premium Godot Game Art Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise original Spirit Lantern gameplay-art quality toward a credible 9–10/10 target via a more tactile cutout, demonstrable environment illumination, disciplined VFX, and actual Godot A/B visual evidence, without manufacturing a numeric art score.

**Architecture:** Incrementally improve the existing 5-part Cutout v2 source and generated **playable** Godot showcase, not its immutable MCP export interface. Use Godot 4.7.2 pinned renderer and real framebuffer probes for visual acceptance; preserve the R7 baseline for human review.

**Tech Stack:** Node.js >=22, `node:test`, `pngjs@7.0.0`, `rsvg-convert 2.58.0`, Godot 4.7.2-stable pinned hash, Xvfb/llvmpipe CI, GitHub Actions.

**Spec:** [`docs/superpowers/specs/2026-10-15-spirit-lantern-r8-design.md`](../specs/2026-10-15-spirit-lantern-r8-design.md); approved source [Issue #33](https://github.com/roronoazoroshao/game-artist-mcp/issues/33).

## Global Constraints

- Baseline `main@2efb6eeb502eaa0fa7def55face68d355c463931` at design approval; **re-check actual live main HEAD before every write**.
- Existing v2 schema; 5 parts `body`, `flame`, `talisman_left`, `talisman_right`, `tassel`; 4 authentic flame pose variants; 2s seamless `idle`. Preserve POC004 v1 and existing v2 immutable package layout.
- Do not introduce external/proprietary art or new network-loaded textures.
- Keep `scripts/phase3-godot.mjs`'s extracted showcase separate from the immutable MCP package, with playable `showcase.tscn` as default and `main.tscn` as explicit validation scene.
- Compare **actual Godot framebuffer** at 512x512 and derived 128x128 / 64x64; identical exposure, timeline and camera for paired variants. Shader source compilation alone is inadequate.
- Numeric 9–10 = **target only**. Always mark visual review `UNSCORED` until identifiable review and rubric actually support a score.
- Technical integration: exact-HEAD CI, self-review disclosed, no P0/P1 known blockers and owner's merge approval. Stable/art release remains gated by Issue #21 and provider-origin attestation.
- Branches: ephemeral `feat/r8-<milestone>`; after verified PR merge **and main push CI**, let existing `cleanup-merged-branches.yml` delete the verified merged branch; inspect GitHub branches and settle on **main only**. Never auto-merge/diverge/delete unknown branches.

## Review Focus

1. **Sprite crop/alpha edge** (64px icon and 512px gameplay): tests must reject missing/flame-only or clipped tassel, not merely count PNG bytes; pin in Task 1.
2. **Lighting false-positive** (static cyan artwork with `PointLight2D` disabled): explicitly compare lit/unlit real framebuffer outside lantern silhouette; pin in Task 2.
3. **Renderer/environment variability** (Mesa notices, differing viewport/exposure): verify requested 512x512 and fixed time/camera; no silent falling back to an old artifact; pin in Tasks 2 and 4.
4. **Brightness/photosensitivity** (rapid high-contrast pulse and bloom washout): compare temporal pixel extrema and regional changes at authored times; pin in Task 3.
5. **Baseline confusion / approval laundering** (R7 vs R8 artifacts from wrong SHA, automated 9+ score): require immutable SHA provenance and `UNSCORED` default; pin in Task 4.

---

### Task 1: R8a original lantern art and 64/128 readability

**Files:**
- Modify `examples/spirit-lantern/v2/source.json` (edit existing IDs before adding any new geometry)
- Modify `examples/spirit-lantern/v2/cutout.json` **only** if new authored nodes require explicit part ownership
- Create `test/spirit-lantern-r8-readability.test.mjs`
- Reuse `test/spirit-lantern-v2-art.test.mjs`

**Interfaces:** input `compileCutout(source,cutout,{revision:1})` and `renderCutoutPreview({compiled,clipId:'idle',timeSeconds})`; output unchanged strict Cutout v2 source and manifest.

- [ ] **Step 1 — RED:** Add test `R8 64px lantern keeps distinct flame, paper and tassel while preserving alpha margins`; render 0.0 and 0.375 s through existing SVG/PNG preview, resize deterministically with `pngjs` to 64 and 128 (reuse sizing logic in `scripts/phase3-preview.mjs` where practical). Check detectable cyan pixels in central flame region, warm paper in left and right regions, red tassel below body, no nonzero bottom-row alpha. Assert intended material layer semantics by asserting the changed authored stroke/fill geometry or desired original-owned region; design the assertion **to fail against frozen R7**. Do not accept tests that pass before implementation.
- [ ] **Step 2 — Verify RED:** Commit test, push ephemeral branch, inspect fresh `npm test` GitHub Actions log and failure assertion (not parse error).
- [ ] **Step 3 — GREEN:** Enhance roof rim/cage bevel values, oblique facet line, glass occlusion, low-frequency parchment crease and tactile thread in existing `source.json`. Preserve negative space and collision; if adding nodes, add each once to appropriate part in `cutout.json`; no unknown external asset or SVG URL.
- [ ] **Step 4 — Verify GREEN:** `node --test test/spirit-lantern-r8-readability.test.mjs test/spirit-lantern-v2-art.test.mjs`, `npm test`, `npm run poc:phase3`; pinned Godot import/runtime and 64/128 preview artifacts in CI. Compare images manually for excessive detail aliasing.
- [ ] **Step 5 — Commit and review** candidate against original silhouette with exact HEAD and PNG contact sheet. Remain `UNSCORED` pending visual judgment.

### Task 2: R8b prove genuine environment response to light

**Files:**
- Modify `scripts/phase3-showcase-capture.gd`
- Modify `scripts/phase3-showcase.tscn` and `scripts/phase3-showcase-world.gd` only as required to make light falloff affect altar, metal edges or paper spatially
- Create `test/r8-showcase-light-response.test.mjs`
- Modify `.github/workflows/ci.yml` to run real capture probe and upload images

**Interfaces:** existing `--capture-showcase` remains compatible with R7 4-frame captures and `GAME_ARTIST_R7_SHOWCASE_OK`; add isolated opt-in `--capture-r8-light-probe` producing `r8-light-probe/lit.png` and `r8-light-probe/unlit.png`, with exact authored time 0.875s, same root/viewport/camera/time. Both PNGs should be 512x512 and written through `Image.save_png()` following `RenderingServer.frame_post_draw`.

- [ ] **Step 1 — RED:** Create probe tests asserting two actual PNG captures exist, are 512x512, pixel hashes differ, and altar-only mask `x=176..336,y=366..422` has a bounded increase in cyan-luminance with lights on (e.g. at least 0.5 mean green channel and detectable subregion change; explicitly exclude the center lantern sprite). Require a 20%-minimum pixel-change region but avoid false pass from dynamic shader `TIME`: freeze scene animation and probe same frame state for both images. Verify lantern-on mask does not merely change global background brightness.
- [ ] **Step 2 — Verify RED:** Test fails because opt-in probe files/features do not yet exist; capture remote failing run link.
- [ ] **Step 3 — GREEN:** Extend capture controller with opt-in probe; hide/disable `Lantern/body/flame/SpiritLight` and `GroundBounce` in unlit pass, restore in lit; use frame_post_draw. If current `Ground` material lacks dynamic light response, add local Godot-ground shader/material interaction that varies with real authored light energy, is spatially anchored near the 512px altar and disabled with both lights. Do not claim physical GI or ray tracing.
- [ ] **Step 4 — Verify GREEN:** Regenerate showcase `npm run poc:phase3`; invoke pinned Xvfb Godot CLI exactly as in `.github/workflows/ci.yml` with `-- --capture-r8-light-probe`; run `R8_CAPTURE_VERIFICATION=1 node --test test/r8-showcase-light-response.test.mjs`; confirm lit/unlit on real framebuffer, while all original R7 tests still PASS.
- [ ] **Step 5 — Commit and review** actual image pairs, check no giant teal fog washout, no parse errors, no silent fallback artifacts.

### Task 3: R8c textured shrine, controlled VFX and temporal safety

**Files:**
- Modify `scripts/phase3-showcase-world.gd` (existing `_shrine`, `_rock`, `_motes`)
- Modify `scripts/phase3-showcase-surface.gdshader` and optionally `phase3-showcase-atmosphere.gdshader`
- Modify `scripts/phase3-showcase.tscn` only for local sprite/light layering
- Create `test/r8-showcase-temporal.test.mjs`
- Reuse `test/r7-showcase-framebuffer.test.mjs`

**Interfaces:** preserve `--capture-showcase` four timestamps `[0,0.375,0.875,1.375]`, four 512x512 PNGs and `GAME_ARTIST_R7_SHOWCASE_OK` for backward-compatible CI; optional additional R8 controls may be additive only.

- [ ] **Step 1 — RED:** Author regional-temporal assertions comparing fixed-size pngs for alpha clipping, dominated/cyan-saturated frames, lack of temporal variation and abrupt full-scene flashes (e.g. cap whole-frame changed-luma area; check 64px downsample flame still visible); freeze camera and use previous exact R7 snapshots for trend comparison. Assert explicitly intended new textured-rock treatment in bounded altar/stone mask, not shader existence.
- [ ] **Step 2 — Verify RED:** Record actual failing Node/CI output for the current R7 material/lighting.
- [ ] **Step 3 — GREEN:** Introduce faceted stone roughness and contact shadow detail, low-contrast specular edge, restrained cyan reflections near the lamp, asynchronous sparse motes and controlled parallax/ink-wash haze. Do not obscure talismans/tassel or inflate GPU draw count without justification. Keep Godot typed GDScript and no external texture downloads.
- [ ] **Step 4 — Verify GREEN:** Execute original R7 framebuffer test and new R8 temporal test on real captured frames, `npm test`, Godot POC004/Phase3, and inspect 512/128/64 images and four-frame transitions.
- [ ] **Step 5 — Commit and review** the content change; document any deliberate artistic trade-offs rather than convert taste into a synthetic PASS.

### Task 4: R8d frozen A/B artifact, rubric and integration gating

**Files:**
- Create `scripts/r8-review-packet.mjs`
- Create `test/r8-review-packet.test.mjs`
- Modify `.github/workflows/ci.yml` to publish review packet + provenance
- Create `docs/project/R8_VISUAL_REVIEW.md` only when real A/B artifacts exist; point to artifact URLs

**Interfaces:** `scripts/r8-review-packet.mjs` consumes explicitly supplied `baselineDir`, `candidateDir`, `baselineSha`, `candidateSha` and writes `review.json`, paired image contact sheets at 512/128/64 (PNG), captured times, image SHA256, `reviewStatus:'UNSCORED'`. No `score` or `visualGo:true` without accepted external evidence.

- [ ] **Step 1 — RED:** Test rejects missing baseline, identical input directories mislabeled as A/B, wrong 512 dimensions, unrecognized timestamp/frame indices, mismatched expected SHA, and fabricated `APPROVED` visual state. Assert packet has `UNSCORED` and links evidence to original exact GitHub SHA.
- [ ] **Step 2 — Verify RED:** Commit tests and confirm expected fails before implementer touches the generator.
- [ ] **Step 3 — GREEN:** Use reproducibly regenerated frozen R7 `2efb6eeb...` scene or artifact from GitHub run [#38607190380](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38607190380) **only if provenance is verified**; fail closed if the artifact expired. R8 frames must come from candidate exact HEAD CI. Generate fixed pairing, scale views, hashes and blinded review checklist. Keep review sources distinct, don't clone comments into independent reviewers.
- [ ] **Step 4 — Verify GREEN:** `node --test test/r8-review-packet.test.mjs`, `npm test`, pinned Godot real capture and `npm run poc:phase3`. Upload R7/R8 A/B with `UNSCORED` label and checked exact SHA provenance; include art rubrics: silhouette, identity, materials, lighting, cohesion, clarity 64px, animation and restraint.
- [ ] **Step 5 — Review gate:** Do disclosed AI multi-role art/tech self-review, optionally actual user or independently identified human assessment. Numerically mark 9+ only if independent/human review evidence exists; otherwise `VISUAL_PENDING`. Separate technical merge from stable art GO.

### Task 5: Safe merge, main post-merge proof and branch cleanup

**Files:** No production code required. May amend `docs/project/R8_VISUAL_REVIEW.md` with verified final URLs and known limitations.

- [ ] **Step 1:** Enumerate live GitHub branches and open PRs; compare base/head SHA with reviewed CI, verify no unresolved P0/P1 and applicable branch protection; do **not** merge if head moved or CI red.
- [ ] **Step 2:** Merge only an owner-authorized, exact-HEAD GREEN technical PR. Never submit a fake author-approved independent review; document AI self-review as `COMMENTED`.
- [ ] **Step 3:** Inspect **actual merge commit** and `push main` CI, including Godot/Xvfb screenshot and FolderForge jobs. If red, do not delete working branch until failure triage.
- [ ] **Step 4:** Trigger/observe existing `cleanup-merged-branches.yml` on successful main push, then query `GET /repos/roronoazoroshao/game-artist-mcp/branches?per_page=100`; require only `main` or enumerate any separately justified active branch. Do not delete work unmerged or divergent.
- [ ] **Step 5:** Record exact SHA, CI URLs, 512/128/64 evidence, review state, and any production gate blockers in Issue #33 and R8 review document. No production/stable release.

## Plan Self-Review / Coverage

- Spec R8a (source + readability) → Task 1.
- R8b spatial light response with lit/unlit evidence → Task 2.
- R8c temporal/texture/VFX restraint → Task 3.
- R8d source-verified A/B visual qualification → Task 4.
- GitHub main-only settled branch policy, exact-head merge + CI → Task 5.
- All review-focus failure classes are assigned to test-first steps. No tasks may claim grade 9–10 from technical metrics alone.

## Execution handoff

**Stage at document creation:** Approved design → written spec + implementation plan, **awaiting owner review of this exact plan**. Previous execution preference: Native, GitHub-live, RED→GREEN, AI role-based review with no fabricated external sign-off. Once the owner approves this written plan, execute Tasks 1–5 autonomously on short-lived work branches and return to `main` only at the end. Do not invent background tasks; all writes and test evidence must be verifiable in the current execution session.
