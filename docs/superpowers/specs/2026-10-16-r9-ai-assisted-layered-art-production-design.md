# R9 — AI-Assisted Layered Art Production (Architectural Design v0.1)

**Status:** OWNER SELECTED OPTION B / WRITTEN SPEC PENDING OWNER REVIEW — **not an approved implementation plan**.  
**Date:** 2026-10-16. **Tracking:** [Issue #36](https://github.com/roronoazoroshao/game-artist-mcp/issues/36), continuation of [R8/R8e art critique in Issue #33](https://github.com/roronoazoroshao/game-artist-mcp/issues/33#issuecomment-6189379168).  
**Live baseline at research:** `main@4e2ab756a6a048d9a9bc31c49c164b3c9b926d85`; one `main` branch, zero open PR. Revalidate live HEAD before any future write.

## 1. User intent, outcome, and invariant

The owner explicitly chose **Option B: AI-assisted art production**. Objective: AI participates **directly in authored pixels**—from concept, silhouette, material studies and masked micro-detail passes to editable, animated asset files—rather than merely evaluating deterministic vector shapes.

**First vertical slice is ONE Spirit Lantern**, not a general-purpose character/monster/environment studio. It must produce an original xianxia prop recognizable at 512px in a real Godot gameplay viewport, at 128px and 64px, with editable high-resolution source, separated functional layers, existing cutout pivots and flame poses, usable runtime animation, and real A/B evidence. Professional artist quality/9–10 is an **aspiration**, never CI-derived.

**Keep two explicit, distinct lanes:**

- `deterministic-legacy`: existing strict ArtDocument/Cutout v2/MCP POC workflows; `README.md`'s no-generative-core claim and benchmarks POC005A/B/C1/C2 must retain exact historical meaning. Their existing validation, immutable export packages and security/policy checks may not change as an accidental side effect.
- `ai-assisted-raster`: new **opt-in** pipeline using external model output bytes plus deterministic transformation and verification. User's Option B selection approves the new lane's concept; it is not permission to turn generative work on for all callers or to overwrite older benchmark evidence. Every generated item is labeled AI-assisted.

## 2. Options and architecture decision (ADR-R9-001)

| Option | Strength | Weakness | Decision |
|---|---|---|---|
| A: One-shot AI full PNG as final | Easy, striking standalone concepts | Flattened image: unreliable separated moving parts, alpha seams, occluded geometry, flame continuity | REJECT as final pipeline; useful only for exploration |
| B: Masked per-part AI paint passes + editable layered raster | Fine detail and material hierarchy, reparable local flaws, still cutout/animatable | Needs part locks, seam cleanup, source/provenance and style consistency | **SELECTED** for R9 |
| C: Blender blockout + deterministic paintover only | Predictable volume/lighting | More artist/tools effort and can stay mechanically sterile | OPTIONAL pose/light reference when B has difficult perspective |

B is recommended for its reversible **paint-by-part** design. Do not promise Photoshop/Firefly or any particular provider directly produces valid ORA/PSD rig layers; the local importer/compositor must create and validate those layers from provider output/masks.

## 3. Producer flow and stages

```text
ArtBrief v1 + style references (licensed) + existing rig/pivots
    │
    ├─ concept candidates (generated, frozen + labeled) → selection
    └─ chosen silhouette + shape/value control sheet
        ↓
part layout & silhouette masks (body / two talismans / tassel / flame)
        ↓
AI masked PAINT loop: major forms → materials → reflected light → micro-detail
        ↓
geometric/alpha seam cleanup and consistency QA per part
        ↓
editable raster source (ORA) + RGBA part/pose layers + ArtProvenance v1
        ↓
deterministic raster frame adapter → atlas pack → Godot cutout runtime
        ↓
pinned Godot framebuffer A/B (R8e baseline vs R9) + human review
```

Iteration is **hierarchical**: quality of silhouette, large values and part occlusion is reviewed before material texture and microdetail. A model may propose targeted mask edits, but must not mutate locked geometry, pivots, rig IDs, or unselected parts. A flawed edit is discarded by reverting to its previous immutable snapshot; no painting destructively over the only retained version.

### Stage A — brief, concept and style board

`ArtBrief v1` specifies `assetId`, scene/style target, original/non-infringing reference rules, visible 3/4 angle, core mood, palette intent, required parts/poses, layer source resolution, 64/128px presentation, allowed image providers and budget ceilings. Three concept candidates maximum in the first slice, each frozen with bytes SHA256. Selection is explicit, and no blank result is silently treated as approved. AI aesthetic critique is `ADVISORY_ONLY`.

### Stage B — layer contract and masked repaint

Canonical `LayerPackage v1` uses a **master 1024×1280** (4× existing 256×320) in sRGB with explicit per-part, canvas-aligned RGBA PNG masks and color layers, where each layer has a unique ID and `partId` owning it. Production frames downsample to the existing 256×320 coordinate system **before** deterministic atlas packing, preserving original pivots and z-index. Keep separate `body`, `talisman_left`, `talisman_right`, `tassel`, and `flame` ownership; retain four existing flame pose IDs and 2-second seamless idle semantics. Nested painterly layers (albedo, shadow, highlights, emissive accents, localized wear) are editable *within* these five rig parts. Drawing masks must not expose adjacent hidden layers and must contain enough underlap to prevent seams during movement. Alpha premultiplication mode must be declared and conversion tested; do not assume model output uses transparent premultiplied pixels.

For each AI paint operation: require `inputSha256`, `targetPart`, `maskSha256`, bounded `prompt` or prompt digest and version, `modelProvider`, `modelId`, `operationId`, `outputSha256`, creative revision and acceptance `accepted/rejected` with reason. Exact source bytes are frozen; subsequent CI tests deterministic stages, **not reproducibility of the stochastic model generation**. No masked edit may overwrite unrelated parts. Track corrections and model-spent budget; cap iteration count explicitly in the future plan.

### Stage C — editable source and material outputs

Use **OpenRaster (.ora)** for an interchangeable editable layered source and export unpacked PNGs for tools that do not support ORA. Baseline ORA: ZIP `mimetype` first and uncompressed, `stack.xml`, `data/*.png`, `mergedimage.png`, and `Thumbnails/thumbnail.png`. The importer must check referenced layer order/offsets/visibility and independently compose a test image; no support implied for every nonstandard ORA extension. An art project can additionally retain optional native Krita/Blender sources with separate hashes, but ORA + PNG and metadata are the first-slice interchange contract.

For the first vertical slice **do not add arbitrary model prompts or raster image URLs inside the current ArtDocument/Cutout v2 schema**. Keep the existing manifest as authority for rig part IDs, pivots, roles and animation timelines; attach a separate `rasterSource` reference in a new packaging layer **outside** the validated Cutout v2 object. No breaking changes to legacy MCP `export_godot_cutout`. Optional normal/roughness/emissive maps may be derived later after the base appearance is confirmed; do not require these for R9a.

### Stage D — deterministic Godot adapter

Introduce a new `RasterFrameProvider` boundary: `(partId,poseId) -> {rgbaPng,sourceRect,pivotSource,sha256}`. The provider loads frozen RGBA layers, validates alpha/dimensions, composites agreed sub-layers, crops deterministically and supplies frames to the existing `packAtlas`/verification seam. Build a separate `buildGodotRasterCutout` adapter or factor reusable scene/animation writer routines **without changing legacy export semantics**. Preserve `SpiritLight`, `GroundBounce`, deterministic 4-pose `flame` and 2s idle, z-order, collision/interaction and Godot scene paths. Confirm fidelity using exact pinned Godot + actual 512×512 frame capture, not SVG-only previews.

**Known compatibility gap:** `src/cutout/compile.mjs` and `src/cutout/raster.mjs` select vector ArtDocument per part; `src/export/godot-cutout-v2.mjs` additionally expects compiled vector source and renders SVG backups. Therefore new raster input **cannot** be passed directly to current `compileCutout` or `buildGodotV2Project` and advertised as supported; create an explicit isolated seam and prove unchanged legacy outputs with regression tests.

## 4. Data contracts (proposal, JSON schemas to be made test-first)

- `art-brief.json`: `version:1`, asset ID, palette/story/style, license/source-reference declarations, part/pose/animation requirements, chosen output scales and approved provider IDs.
- `model-operations.jsonl`: immutable append-only operation audit, prompt/negative-mask hashes, invocation (when available), provider and model version, commercial-use policy reference, artifacts SHA256, accept/reject decisions, input/output lineage; potentially sensitive prompt content can be stored encrypted/omitted from public artifacts while preserving digests.
- `raster-package.json`: `version:1`, `assetId`, `rigManifestSha256`, `masterCanvas`, `runtimeCanvas`, `layers` with `layerId,partId,poseId,blendMode,alphaMode,sourceSha256,maskSha256,order,visible`, `operationsAuditSha256`, `oraSha256` and `rightsDecision`. File paths must be canonical relative paths rooted in a dedicated asset workspace; no symlinks or URLs.
- `review.json`: baseline exact SHA, candidate exact SHA, captured PNG hash per time/scale, `UNSCORED` by default, clearly separated technical evidence vs independently sourced artistic assessments.

All IDs use strict allowlists, hashes are 64-digit lower-case SHA256, input sizes and per-batch uncompressed byte budgets are bounded; external model output is **untrusted user-supplied media**, even when generated on the owner's behalf.

## 5. Security, rights, provenance and access

- The generative provider is selected/configured **outside the GitHub repository**. The connected Photoshop/Adobe tools may generate visual outputs interactively, but availability in ChatGPT does **not** mean an API can automatically run inside GitHub Actions. MVP supports **import-first**; live provider adapters are separately authorized and require supported runtime execution and explicit credentials access. No secrets in the repo, CI logs, prompts exposed by accident, or model calls in default PR CI.
- Require signed-off origin/rights policy fields for each asset: own or licensed references, commercial permission status, provider terms/version, output model/feature designation, scope of permitted modification and attribution, and unresolved `RIGHTS_UNVERIFIED` fail-closed for release. Terms change; do not hardcode that every generative feature is commercially usable.
- Decode only bounded **PNG** in controlled worker/process; verify signature/CRC/header, pixel count and decoder memory. Reject path traversal, duplicates, zip-bomb entries, XML DTD/entities/network URLs, embedded scripts and unsafe archives. Enforce relative canonical ZIP entry paths, total uncompressed limits and no file symlinks for ORA. Treat model image metadata and prompts as data, never as instructions.
- Preserve every source and accepted revision by SHA256 with opt-in storage; no false proof that one AI agent produced art or that humans reviewed the result. Review evidence identities from old POC005C1 must remain independent of authorship and cannot be forged.
- Unsafe/reference assets (logos, trademarked franchise designs, watermarked stock images, close copies of other artists) are rejected or routed to explicit owner review. Generated asset label and rights transparency continue through export.

## 6. Acceptance criteria and measurable gates

**Gate 0: baseline frozen.** R8e `main@4e2ab756...` Godot 4.7.2 image set, prior atlas and validated rig saved with SHA256 references; continue if baseline artifact unavailable only by reproducibly rebuilding exact frozen SHA and verifying provenance.

**Gate 1: import and layered source.** One actual imported AI-painted Spirit Lantern with editable ORA, separated RGBA PNG layers and complete operation lineage. ORA can round-trip layers without losing offsets/order/alpha, and rendered merged output matches deterministic compositor within specified pixel tolerance. No claims of real AI output without actual provider and output bytes.

**Gate 2: rig and motion.** Asset renders as a 5-part cutout with the existing 4 flame poses and 2s seamless loop. Automated tests reject wrong part ownership, masked edits altering outside areas, alpha halos, severe gaps under talisman/tassel rotation, cropped margins, inconsistent pivot/misaligned frames, missing/wrong hashes and nontransparent backgrounds.

**Gate 3: Godot.** Pinned Godot import, animation and 512px framebuffer capture pass; review at 128/64px and zoomed gameplay. Tether, real local light response and shadow/reflection changes are evidenced by lit/unlit captures. Technical CI must compare against original export to ensure no legacy regression.

**Gate 4: artistic acceptance.** Pair identical-camera/timestamp R8e and R9 frames, evaluate silhouette, composition, material separation, depth, light coherence, animation, low-res clarity and originality. AI art-director critique may iterate several times but is identified as one AI's self-review. **9–10/10, VISUAL_GO, independent review or production readiness are not declared without qualifying real evaluation records**; absence means `VISUAL_PENDING`.

**Gate 5: merge/release/cleanup.** Only merge owner-authorized, exact-HEAD passing PR; re-verify main push CI, then delete only safely merged temporary branches using existing cleanup workflow. Final repo expected `main` only. Unresolved rights, provenance, independent reviews or other production gates block *release*, even if technical PR merges.

## 7. Planned story boundaries (NOT implementation approval)

1. **R9a — secure raster intake + provenance envelope:** fixtures, security-negative tests, deterministic PNG decoder, operation manifest; no provider invocation.
2. **R9b — painterly multi-layer/ORA authoring import:** editable master and per-part masked material passes, fail-closed ORA parser/writer and alpha consistency.
3. **R9c — existing rig bridge + atlas and Godot runtime:** a separate raster-to-Godot adapter, exact transforms/poses preserved, real screenshot proof.
4. **R9d — model provider integration and iterative agent art direction:** optional selected provider (e.g. Firefly in connected ChatGPT host); real image generation/edits, selection and localized rework recorded as immutable source snapshots. **Do not confuse the host's plugin action with CI execution.**
5. **R9e — artistic A/B quality and branch hygiene:** full technical and independent-review packet, declared `UNSCORED` until external evidence, guarded PR merge and branch cleanup.

Stages 1–3 can be built/tested independently of a model vendor; **the request to have AI actually paint** is fulfilled only in stage 4 once the authorized provider produces real image bytes, not by running static PNG fixtures.

## 8. Failure handling, reversibility and non-goals

On invalid media/license, return structured `IMPORT_REJECTED`/ `RIGHTS_UNVERIFIED` and retain no unchecked export. Failed masked generation rolls back its layer revision; incomplete provider requests are resumable only when immutable source/operation IDs are available. CI source replay never retries stochastic generation implicitly.

**Non-goals (first vertical slice):** generic character skeletal rig, all asset genres, automatic high-quality 3D generation, Photoshop PSD fidelity, auto-training/fine-tuning style models, cloning copyrighted visual styles, absolute model repeatability, real-time generated content at game runtime, auto-approving artistic score, bypass of human release gates.

## 9. Evidence & source anchors

- Existing entry and invariant: `README.md`, `src/mcp/server.mjs`.
- No raster support in vector source compilation: `src/cutout/compile.mjs`, `src/cutout/raster.mjs`.
- Atlas and pivot implementation: `src/cutout/atlas.mjs`.
- Godot scene generator: `src/export/godot-cutout-v2.mjs`.
- Current CI and framebuffer verification: `.github/workflows/ci.yml`, `test/r8-showcase-light-response.test.mjs`, `test/r8-review-packet.test.mjs`.
- Legacy human visual gate: `benchmarks/poc005c1/README.md`.
- External format/reference: [OpenRaster file layout](https://www.openraster.org/baseline/file-layout-spec.html), [OpenRaster stack/layers](https://www.openraster.org/baseline/layer-stack-spec.html), [Godot image import](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/importing_images.html), [Adobe generative policy](https://www.adobe.com/cis_en/legal/licenses-terms/adobe-gen-ai-user-guidelines.html).

### Self-review / decision gate

No `TBD` interface is secretly assumed implemented. This document is a **proposed architecture**, grounded in main SHA listed above. Highest-impact risks are (1) breaking vector export by injecting raster into its schema, (2) unsafe/unlicensed generative inputs and unknown provider authorization, (3) model nondeterminism misrepresented as replayable, and (4) self-scored aesthetic quality. The design isolates all four.

**Required next action:** OWNER REVIEWS/APPROVES THIS EXACT WRITTEN SPEC (or requests edits); only then produce the separate detailed, executable Superpowers implementation plan, and only after plan review begin product-code changes. This respects the previous approval pattern for R8.
