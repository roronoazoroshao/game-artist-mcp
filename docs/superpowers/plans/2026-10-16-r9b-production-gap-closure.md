# R9b production-gap closure — approved implementation plan (PLAN ONLY)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the difference between merged R9b's secure, flat, legacy-derived 256×320 ORA demonstration and the already approved R9 first-slice requirements for editable 1024×1280 artist layers, explicit rig ownership, editable masks, hierarchy, audit-bound sources and seam QA.

**Architecture:** Keep `src/ai-art` as an opt-in subsystem. Preserve existing `writeOpenRaster/readOpenRaster` flat-stack compatibility, reject unknown input, and add separate, strictly validated **source-art package** boundaries. Use baseline OpenRaster nested `stack` groups for editor layer hierarchy only after group compositor semantics are tested; preserve masks as separate immutable RGBA/alpha PNGs plus a hash-bound sidecar manifest, not a fictitious interoperable native ORA-mask feature. No source raster flows directly into legacy Cutout v2.

**Tech Stack:** Node.js 22+, `node:test`, pngjs 7, node:zlib, node:crypto, GitHub Actions and pinned Godot downstream.

**Spec:** `docs/superpowers/specs/2026-10-16-r9-ai-assisted-layered-art-production-design.md`; tracking `#36`. R9b original implementation plan is `docs/superpowers/plans/2026-10-16-r9b-openraster-layered-art.md`.

**Approval update (2026-10-18):** The owner approved the next integration sequence. This PR remains **documentation-only**: it neither implements the R9b closure tasks nor changes production runtime, ownership, licensing or release gates. The dated assessment below describes the earlier `main` snapshot; actual R9d candidate work now lives in [Draft PR #43](https://github.com/roronoazoroshao/game-artist-mcp/pull/43), still `ART_UNSCORED`, `RIGHTS_UNVERIFIED`, `exportAllowed:false`. R9c has since landed on `main`. Execution of R9b source-hardening remains a separate implementation/review flow. Do not interpret merging this plan as implementation acceptance.

**Source of truth at plan creation:** `main@365291470cb33eefffe763cda6b01669980c540f`; PR #38 merged, 0 open PR, only `main` branch before this planning branch. This file is **not** evidence of implemented work.

## Confirmed gaps against owner requirements

| Requirement | Merged R9b reality | Acceptance still missing |
| --- | --- | --- |
| 1024×1280 painted source / 256×320 runtime | demo asserts 256×320; built from R8e legacy vector frames | original **master-resolution** package and honest provenance |
| Editable masks | `applyAlphaMask()` performs an in-memory multiplication | preserved **independent mask bytes**, hash validation and round-trip |
| Layer hierarchy | OpenRaster reader accepts flat `<stack>` and rejects nested stacks | bounded nested group semantics and editor interoperability tests |
| Rig ownership | demo infers ownership from layer names | validated machine-readable `partId` / `poseId` metadata and checks |
| SHA256 provenance | per-document ORA SHA and R9a's separate raster contracts exist | actual link from every ORA source PNG and mask to R9a package, operations and rig hash |
| Edge / seam QA | alpha compositor tests cover numeric sample pixels | static edge/halo/occlusion reports + controlled rotated-pivot tests in R9c |
| Professional art | `LEGACY_VECTOR_ORA_TECHNICAL`, `paintedByAI:false` | R9d prototype artwork exists in Draft PR #43; R9e independent visual review and commercial-rights gates remain BLOCKED |

**Important interoperability decision:** Baseline OpenRaster v0.0.6 supports nested `stack` groups but does **not guarantee portable editable native masks** across GIMP/Krita. Preserve mask PNG bytes plus canonical companion manifest and optionally expose a hidden editor-preview layer; never claim universal native-mask editing. No authenticated rights approval is created by storing sidecar metadata.

## Global constraints

- R9a unchanged: `assertRasterExportable` still rejects self-attested `COMMERCIAL_REVIEWED`; import never grants release/export.
- Maintain `body,flame,talisman_left,talisman_right,tassel`, all `flame_a..flame_d`, existing pivot and 2-second animation invariants. No edits to Cutout v2 schema, legacy MCP export or historic benchmarks.
- Work only on `feat/r9b-master-source-hardening` after plan approval; preserve current 256×320 technical ORA and CLI output so historical artifact hashes remain reproducible.
- Model edits and rights evidence are never inferred from source names, repo owner or local SHA256. No live model API calls, credentials, external URLs or automatic rights approval.
- Reject malformed archive, ZIP aliases, CRC/hash mismatch, unsafe XML, unbounded groups/layers/total decoded RGBA size, duplicate sources, out-of-range offsets, unknown blends, unsupported color modes.
- Treat `ArtisticReview=UNSCORED` until actual provider art and eligible independent assessment. An automated seam report is technical evidence only.
- No `main` merge or production deploy without exact-head CI and the applicable approval gates.

## Review focus — highest risk inputs

1. A group stack with hidden children / partial opacity must composite correctly rather than silently flatten as visible.
2. A tampered mask PNG or swapped part ID must fail source-hash and ownership checks before ORA output.
3. A 1024×1280 mask/PNG pair must stay at **true native resolution**; never upsample 256×320 legacy art and label it master-generated.
4. A source image with transparent RGB fringe around a moving rig part must be flagged and exercised on shifted / rotated fixture layouts.
5. A GIMP/Krita resave changing `stack.xml` attrs, group structure, layer PNGs or archive layout must not be silently treated as a pixel-identical original or a cleared rights attestation.

## Task 1 — R9a-to-R9b immutable ownership and mask source envelope

**Files:** Create `src/ai-art/layered-source.mjs`; create `test/r9b-layered-source.test.mjs`; no edit to legacy modules.

**Interfaces:** `validateLayeredSource({brief,pkg,layerPngs,maskPngs,rigManifestSha256}) -> {ok,layerDigests,maskDigests,coverage,exportAllowed:false}`. In-memory Maps keyed by exact R9a canonical paths; masks keyed by independently canonical `masks/<layerId>.png` paths. Exact input byte SHA256; actual `partId` / `poseId` from R9a manifest (not filename heuristic). Require `ArtBrief` master 1024×1280 and runtime 256×320 with five parts and four flame poses. Validate source and mask dimensions/ownership, permit layer subrect only with explicit bounded offsets, duplicate identity rejection.

- [ ] Write failing Node tests for accepted 5-part/4-pose layer package, tampered alpha-mask hash, swapped `partId`, missing flame pose, forged `COMMERCIAL_REVIEWED` and wrong master size; require zero false-positive rights release.
- [ ] Commit test-first, capture exact-head GitHub Actions **RED** with expected missing interface/functional failures; do not alter legacy test assertions.
- [ ] Implement minimal fail-closed source envelope using `validateArtBrief`, `validateRasterPackage`, `inspectAiPng` and `digestProvenanceEvents` without duplicating existing contract rules.
- [ ] Run targeted Node tests + complete repo CI; record exact-head **GREEN**; commit.

## Task 2 — deterministic master-resolution ORA and source-sidecar

**Files:** Create `src/ai-art/layered-project.mjs`, `test/r9b-layered-project.test.mjs`; extend `scripts/r9b-spirit-lantern-ora.mjs` only with a **new opt-in mode**, preserving historical default mode and its output SHA.

**Interfaces:** `writeLayeredProject(validatedSource) -> {ora, manifestJson, layerPngs, maskPngs, evidence}`, `verifyLayeredProject(files) -> {ok,manifest,sourceDigests,mergeDigest,exportAllowed:false}`. Explicitly store every original PNG/mask in independently editable files and canonical JSON sidecar with sorted IDs, part ownership, pose, layer order, canvas-aligned offsets, parent stack, and digests. `ORA` alone is an editor source, never sufficient proof of provenance or rights.

- [ ] RED: tampered sidecar digest, missing original mask, unrelated-part edit, nondeterministic ordering, wrong master resolution, visible fake flame-pose merge.
- [ ] Implement frozen deterministic package; do not pad, fake paint, or upscale legacy 256×320 frames to claim master artwork. Use controlled 1024×1280 authored **fixture** for contract tests only, explicitly tagged `TEST_FIXTURE`.
- [ ] GREEN: pixel-accurate ORA read-back, SHA verification and full CI; commit.

## Task 3 — bounded nested OpenRaster groups (separate adapter, no silent regression)

**Files:** Extend `src/ai-art/openraster.mjs` and/or create `src/ai-art/ora-stack.mjs`; extend `src/ai-art/layer-composite.mjs`; add `test/r9b-ora-groups.test.mjs`.

**Interfaces:** `readOpenRaster()` preserves a typed `stackTree` for nested groups; `writeOpenRaster()` adds an opt-in `stackTree` while preserving old flat signature. Permit only `svg:src-over`, `isolation=isolate` first, with bounded depth (max 4), max 24 paint layers and strict group alpha/visibility. Reject `isolation=auto` until mathematically specified and tested; preserve group order.

- [ ] RED: visible nested group/hidden parent/opacity and isolated group above colored background; malformed nesting, excessive depth, DTD/XXE and unknown blend-mode rejection.
- [ ] Implement safe token/DOM parsing without external entity resolution or network; avoid fragile regex extension; maintain fixed ZIP budgets.
- [ ] GREEN: composite pixel equality and deterministic ORA round-trip; historical tests/full CI unchanged; commit.
- [ ] Obtain a **real GIMP/Krita editor open/save/reopen run** in a supported remote environment, capture input/output bytes and screenshots. If unavailable, record `EDITOR_INTEROP_UNVERIFIED` (not PASS).

## Task 4 — alpha edge / seam QA (static scope only)

**Files:** Create `src/ai-art/edge-qa.mjs`, `test/r9b-edge-qa.test.mjs`; generate machine-readable reports in `scripts/r9b-spirit-lantern-ora.mjs` opt-in mode.

**Interfaces:** `analyzeLayerEdges({width,height,layers,ownerMasks}) -> {status,findings,metrics}`. Reject alpha-color fringes against configurable dark/light checker backgrounds, unexpected color outside part ownership, inconsistent mask edges and cropped opaque pixels. Define thresholds in fixtures; separate WARN vs hard INVALID findings. Do not equate static edge checks with motion seam verification.

- [ ] RED for deliberate semi-transparent saturated edge halo, hidden pixels outside part mask, cropped margin and valid intentionally soft emissive glow.
- [ ] Implement deterministic checks with unambiguous metrics; avoid flagging legitimate glow as a guaranteed artistic defect.
- [ ] GREEN: target + full CI, attach report and fixture images. Dynamic pivot/underlap/framebuffer tests remain an explicit **R9c** gate.

## Task 5 — evidence and review

**Files:** Update `docs/project/R9B_LAYERED_ART.md`, task-related tests/CI, add Issue #36 evidence comment.

- [ ] Gather exact PR HEAD, test-first RED/GREEN workflow runs, Node summary, real ORA bytes, hashes and independent ZIP reader/PNG pixel evidence.
- [ ] Perform focused self-review for archive, XML, opacity, provenance, rights and legacy regression; distinguish it from independent reviewer.
- [ ] Mark every requirement `PASS / PARTIAL / UNVERIFIED / BLOCKED`; never assert full R9b or art GO from the legacy-derived demo.
- [ ] After approved plan and all exact-head CI gates, raise PR; merge only within owner-authorized integration rules; verify post-merge main CI, safely remove only merged branch and verify only `main` remains.

## Gates and ownership

- **Planning checkpoint:** the owner approved the 2026-10-18 integration/action plan. Merging this document only approves a bounded implementation roadmap; it is not evidence of completed R9b work, artistic approval or rights verification. Execution method: **Native**.
- **R9b closure gate:** source package, masks, hierarchy, origin/rig verification, master canvas and static seam QA all have real test evidence and no P0/P1; external editor interoperability separately reported.
- **R9c:** raster-to-rig atlas/pivot/Godot/runtime seam animation tests, not falsely considered completed here.
- **R9d:** actual approved model-generated paintings/edits and their immutable byte provenance.
- **R9e:** real same-camera A/B, independent visual review, rights and release gates; `ART_UNSCORED` until then.

**Rollback:** all changes confined to opt-in `src/ai-art` / new tools and explicit tests. Preserve the known-good `main@36529147`, archive and SHA of the existing R9b technical artifact; revert only the task branch if security checks regress. Never rewrite benchmark history or manufacture reviewer approvals.
