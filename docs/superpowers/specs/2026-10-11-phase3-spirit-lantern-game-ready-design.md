# Phase 3 — Spirit Lantern game-ready vertical slice: design specification

- **Status:** PROPOSED WRITTEN SPEC — awaiting human review. Discovery and writing this specification were authorized on 2026-10-11; **implementation and an implementation plan are NOT authorized by that approval**.
- **Type:** architectural change; Superpowers brainstorming → written-spec gate.
- **Repository:** roronoazoroshao/game-artist-mcp.
- **Baseline:** main at d39f20bba78cc52537a6ef66a0949c5ca727b43e (verified 2026-10-11). Reconfirm live head before implementation.
- **Owner intent:** Create an **original**, art-directed, readable, animated 2D cutout Ancient Spirit Lantern for a 2.5D cultivation-survival game; import and run it in Godot, preserve explicit/deterministic editing, and improve game feel without asserting unverified artistic quality.
- **Gate:** The author must receive separate acceptance of this written spec, then write/review the implementation plan, then receive explicit approval of the execution method before touching product code.

## 1. Discovery: actual baseline and the missing capability

This is a **quality upgrade**, not permission to rewrite POC-001 through POC-005C2.

| Area | Verified from repository on 2026-10-11 | Gap for Phase 3 |
| --- | --- | --- |
| Art document | src/core/engine.mjs validates explicit v1 path/ellipse/polygon; revision-checked transactional node edits; src/core/render-svg.mjs deterministically renders SVG. | Keep source/transactions stable; guarantee frame/part provenance and no hidden generator. |
| Source Lantern | examples/spirit-lantern/source.json has a 256×320 transparent canvas and authored cyan flame, paper talismans, hanging tassel and wooden/metal body. | Present shapes are simple. Richer art direction and actual image-based critique are still needed; this source inspection is NOT a live visual acceptance. |
| Cutout | examples/spirit-lantern/cutout.json declares **five** existing parts: body, flame, talisman_left, talisman_right, tassel. Each has source node ownership, pivot, parent, zIndex, role. src/cutout/validate.mjs checks parts, hierarchy cycles and basic transform keys. | v1 validation allows unowned nodes as warnings, does not enforce loop seam/key continuity or frame assets, and has no alpha crop/atlas contract. |
| Motion | v1 idle clip (2 s) animates talisman rotations, tassel rotation and flame scale; src/export/godot-cutout.mjs converts value tracks to Godot Animation resources. | Uniform scale is only a stylized flicker, not coherent animated flame shape; no enforced frame sampling, continuity, or light-energy synchronization. |
| Packaging | POC-004 exporter writes **five full-canvas SVG textures** plus Godot scenes, a static light texture, PointLight2D and collision. Current cutout doc explicitly says this is memory inefficient. | No alpha-tight texture layout / packed atlas / UV mapping; full-canvas textures multiply allocation and limit production use. |
| Material art | src/core/appearance.mjs and src/core/render-appearance.mjs support validated gradient, clipped hand-directed marks and bounded glow (POC-005B). | Both the MCP export_godot_cutout dispatch and the exporter reject ANY appearance with UNSUPPORTED_GODOT_APPEARANCE. No material-aware game-ready resource route. |
| Runtime QA | scripts/poc004-godot.mjs generates assets through actual child MCP and CI imports/starts the project in pinned Godot 4.7.2; validation checks presence of parts, AnimationPlayer, light, collision. | Existence/import test is NOT an animation-quality or visual test. No sampled transform tests, PNG/atlas bleed assertions or in-game side-by-side comparison. |
| Style / trust | Existing ArtStyleProfile and technical validators, synthetic CI, POC-005C1 and C2 evidence gates. | Visual human evidence Issue #21 is OPEN and independent provider receipts for POC-005C2 Task 8 are unavailable. **Phase 3 must not alter those verdicts.** |

Primary repository evidence: docs/POC_003.md, docs/POC_004.md, docs/ROADMAP.md, docs/ADR_0001_FOLDERFORGE_BOUNDARY.md, examples/spirit-lantern/{source,cutout}.json, src/{cutout/validate,export/godot-cutout,core/render-appearance,core/appearance,mcp/server}.mjs, .github/workflows/ci.yml, tests including test/cutout.test.mjs and test/appearance-godot.test.mjs.

### What was and was not inspected

Source contracts, fixtures, exporter paths, tests and pinned CI workflow were inspected directly from GitHub. Recent green POC-004 CI is mechanical runtime evidence. **No authenticated on-screen Godot playtest, blind artistic review or PNG-by-PNG visual comparison was performed during this discovery.** Such evidence is required at the implementation verification stage; no new artistic PASS is claimed now.

## 2. Options considered and decision

**A. Patch only the five legacy SVG textures.** Fastest, backward compatible, and enough for basic runtime; but retains full-canvas overhead, appearance rejection and weak motion QA. Reject as insufficient to close the observed gap.

**B. Extend with opt-in Cutout v2 compiler and deterministic texture packaging (RECOMMENDED).** Preserve v1 behavior and exact existing tests; compile part crops/atlas, material-aware paint, bounded shape variants and annotated motion into deterministic Godot resources. Highest value with controlled surface area.

**C. Replace cutout with mesh skinning, Skeleton2D/Polygon2D shaders and a new runtime.** More flexible deformation but adds topology, weight-painting, shader and portability risks, redesigns working POC-004 and complicates host-neutral output. Defer until animation tests demonstrate a need.

**Decision:** B. Build a *bounded opt-in* **v2 compilation pipeline**, initially for the Lantern but structurally reusable for a Phase 4 character. The existing v1 output is an explicit compatibility contract, not a legacy code path silently migrated.

## 3. Architectural boundaries and data flow

~~~text
Existing source ArtDocument v1 + validated ArtStyleProfile
             |
             +-- existing unchanged render_preview / transaction operations
             |
    CutoutManifest v1 or proposed opt-in v2
             |
       validateCutout + strict v2 constraints
             |
       compileCutout (pure normalized, provenance-linked plan)
          /             |                 \
   per-pose SVG/PNG   geometry/alpha     animation tracks
   via existing SVG   crop/atlas         + evaluation sampler
   renderer           packer
          \             |                 /
             validated AssetPackage
             (bytes, manifest, hashes)
                     |
          Godot resource/scene generator
                     |
             sandboxed staged export
                     |
        pinned Godot import + runtime checks
                     |
          Technical report + preview bundle
                     |
       optional actual visual critique + edit
~~~

- **Game Artist owns:** art IR, material-aware rasterization, part-level cutout transforms, animation recipes, sprite packaging and technical art QA.
- **FolderForge owns:** MCP host governance, authentication, sandbox control, approval, deployment and generic Godot run/screenshot automation. No new generic Godot control plane or remote transport.
- **Runtime dependencies:** Node.js 22+, pinned librsvg rasterizer and pinned Godot for CI; **no generative image or 3D inference service**, no dynamic downloaded code, no user-provided Godot script.
- **Purity:** A compiler creates bytes and metadata from an immutable validated source snapshot. A file writer materializes those outputs only after plan validation. An exporter is not an artist; geometry and pose variants must come from explicit editable Art IR nodes.

## 4. Versioned contracts and compatibility

**Keep ArtDocument version 1 unchanged. Keep CutoutManifest version 1 accepted with its current meaning.** Introduce CutoutManifest version **2** only as an explicit caller choice; unknown versions fail closed. Do not conflate document version and cutout version.

Proposed *illustrative* v2 fields (exact JSON Schema and resource limits must be nailed down in approved implementation plan):

~~~json
{
  "version": 2,
  "assetId": "spirit_lantern",
  "parts": [
    {
      "id": "body",
      "nodes": ["handle", "roof"],
      "pivot": [128, 160],
      "parent": null,
      "zIndex": 0,
      "role": "body"
    }
  ],
  "animations": [
    {
      "id": "idle",
      "length": 2,
      "loop": true,
      "tracks": [
        {"part": "flame", "property": "scale", "keys": [{"time": 0, "value": [1, 1]}, {"time": 2, "value": [1, 1]}]}
      ]
    }
  ],
  "rendering": {
    "format": "atlas_png",
    "paddingPx": 4,
    "maxAtlasSize": 2048,
    "scale": 1
  },
  "poseVariants": [
    {"id": "flame_a", "part": "flame", "nodes": ["flame_a", "flame_a_core"]},
    {"id": "flame_b", "part": "flame", "nodes": ["flame_b", "flame_b_core"]}
  ],
  "frameSequence": {
    "part": "flame",
    "fps": 8,
    "frames": ["flame_a", "flame_b", "flame_a", "flame_b"],
    "loop": true
  },
  "light": {
    "part": "flame",
    "position": [128, 174],
    "color": "#72f5ec",
    "energy": 0.85,
    "textureScale": 2.2
  },
  "collision": {"position": [128, 170], "size": [86, 176]}
}
~~~

Example is **not** a complete Lantern manifest; it illustrates extension points, not valid production fixtures.

**Resolve pose ownership explicitly:** The normalized compiler treats a pose as an alternate set of source nodes for its designated part. Every alternate node ID is unique globally and may belong to exactly one pose/part; base nodes remain assigned to exactly one part. At render time **only one pose of a part is visible**. Variants do not accidentally render simultaneously or inflate the body. The planner must define and test pose override semantics. Required five active logical parts remain body/flame/talisman_left/talisman_right/tassel regardless of frame count.

**Hard v2 invariants:**
- At least one root; all parents exist, no cycles, unique IDs/roles, finite pivots inside bounded source canvas; every visible source node and variant node assigned exactly once. No warnings for unowned visible source nodes in v2.
- Safe snake_case identifiers; allowlist all optional schema fields and enum properties; ban paths, expressions, embedded script, arbitrary shader and external URL.
- Max 64 parts, max 64 nodes per part, <= 16 explicit pose variants total, <= 16 frame-sequence entries per clip, 1–24 pose fps, <= 60-second clip, <= 128 tracks, <= 64 keys/track. All art documents still obey existing appearance and node complexity budgets.
- Animation position/scale as finite Vec2, rotation finite radians; **scale must remain positive** for safe geometry, extra property for emission energy (numeric bounded), and optional texture-frame track (declared pose IDs only). v1 stays linear; v2 can opt into smooth interpolation with range-/overshoot-checked sampled values.
- All cyclic transform clips have start/end equivalent states at loop seam within declared epsilon; repeating a frame sequence must be mathematically continuous at its wrap in timing (visual shape change may still be visible and requires pixel QA). Clip keys are monotonic and bounded; duplicate times or conflicts on one part/property are errors.
- v2 must bind to exact source revision and canonical source document SHA-256. A stale document or changed material after compile must invalidate the package; source content is never silently rewritten.

**MCP contract:** Keep export_godot_cutout with current asset_id and cutout payload; dispatch selects v1 or v2 from manifest version, no additional cross-host permissions. Existing render_preview/export_asset, validation and provenance interfaces remain unchanged. New capabilities should be discoverable via an added strictly bounded tool description/metadata, without silently changing existing tool arguments.

## 5. Texture, atlas and pixel-space design

### Source of truth and appearance

All Lantern shapes, colors, gradients, surface marks and glow come from validated explicit Art IR, never from image synthesis. Reuse renderSvg/render-appearance directly for **per-part, per-pose** SVG. This closes UNSUPPORTED_GODOT_APPEARANCE only in the approved **v2 prerasterized PNG** path; it does not silently change the v1 SVG path. Pixel output must match the existing single-document reference renderer within a documented rasterization tolerance, including clipping of marks and bounds of glow.

### Crop and pivot math

Render each active part/pose on the original coordinate canvas to PNG at deterministic scale; decode bounded RGBA and determine the alpha bounding box. Add documented padding and do **not** clip glow, outline or antialiasing. Empty-alpha parts fail closed. Preserve source coordinate mapping:

- source alpha bounds B = [x0, y0, width, height] at source scale;
- cropped part texture includes a documented padding/pixelRect;
- for Godot Sprite2D centered on the packed texture region, the *local* sprite offset from the part Node2D pivot is **[cropCenterX − pivotX, cropCenterY − pivotY]**, expressed at the same validated render scale and adjusted for padding. Parent Node2D local position remains childPivot − parentPivot;
- the exact manifest records pivotSource, pixelRect, contentRect, textureRect and frame pose ID; assert Godot reconstruction positions against pixel-space reference. No off-by-one changes on odd-sized crops.

**Implementation constraint:** Native Node does not provide a PNG RGBA decoder/encoder. The implementation plan must select a small audited, pinned offline raster utility with a committed lockfile OR a narrowly specified/tested PNG module; do not invent manual alpha bounds from unparsed SVG path strings. Any dependency addition requires supply-chain review and strict byte/dimension/decompression caps. librsvg version remains pinned for reproducible raster bytes.

### Atlas compiler

Pack in stable order (part ID then pose ID), deterministic shelf/skyline, no rotation. Bounds <= 2048×2048; gutter/padding = 4 px default and clamp to 2–8. Extrude boundary pixels inside gutter as necessary to mitigate filtering bleed; alpha outside content must stay zero unless deliberately extruded. One transparent RGBA atlas PNG for Lantern, with machine-readable regions and SHA-256 digests per crop/source/atlas. Reject overflow rather than silently downsample, strip poses or produce unverified output.

Godot uses AtlasTexture resource regions with clip filtering or Sprite2D.region_enabled with explicit placement; choose **one** mapping in implementation plan and assert the matching pivot math in runtime tests. Do not mix region and margin semantics speculatively. Official Godot AtlasTexture documentation describes atlas, region, margin and filter_clip: https://docs.godotengine.org/en/4.4/classes/class_atlastexture.html . Pin tests to the project's actual Godot CI binary (currently 4.7.2), not a guess based on a documentation version.

The asset package contains at least: source document/reference digest, v2 cutout manifest, atlas.png, atlas.json (sorted regions/pivots/pose lineage), readable first/revised preview PNG(s), generated Godot scene/resources, QA report, provenance/renderer version and hashes. Also retain source SVG exports as editable artifacts. No runtime text or opaque generated art models replace the explicit original artwork.

## 6. Motion design: credible, controllable animation

**Art direction (original rather than IP imitation):** Strong asymmetrical handcrafted silhouette; subdued dark wood/aged metal; luminous cyan inner spirit flame; weathered seal papers that visibly hinge from their hooks; hanging red tassel with delayed, lower-amplitude inertia. Distinguishable shapes at 64px and 128px. Deliberately avoid 1:1 art copying from Don't Starve Together or Diablo II.

**Idle recipe:** The shell remains weighty; talismans move on slightly different phase curves (not perfect mirror twins); tassel lags the motion of the body; fire cycles through 4–8 *explicitly drawn* contour/core pose combinations with staggered timing, rather than merely uniform scale. Light energy subtly varies in synchronization with the authored flame; all effects are bounded, not a random particle simulation. Use the existing Node2D/AnimationPlayer, PointLight2D and shape-based sources before adding a custom shader.

**Deterministic timeline:** The compiler converts a normalized clip into Godot 4 resources and can sample them independently at fixed times. v2 sampled smoothing (where explicitly requested) must not introduce uncontrolled overshoot, negative scales or loop popping. Texture-frame changes are discrete by design; continuous tracks (position/scale/rotation/emission) have numeric seam checks. Test authored frame ordering and lineage, not a false assertion that static alpha hashes prove animation quality.

**Measurable mechanical motion gates** (initial thresholds for Lantern, refine through actual test evidence):
- Sample >= 2 full cycles at >= 30 samples/second plus boundary points epsilon before/after the seam.
- Equivalent transform and light-energy values at t=0 and t=duration within epsilon: translation <= 0.5 source px, scale <= 0.01, rotation <= 0.01 rad, light energy <= 0.02; end/start sampled jump <= same limits when samples straddle the wrap.
- Between successive samples for **continuous tracks only**: translation <= 4 source px, rotation <= 0.04 rad, scale component <= 0.05, light energy <= 0.15 (30fps). Exceedances are explicit QA failures; authored discrete frame swaps use separate frame-readability QA.
- At least 4 distinct author-directed flame poses, >= 1 legible emission change over a cycle, and non-identical left/right talisman motion. These are recipe compliance checks, not proof of beauty or physical realism.
- Loop seam of the flame must be previewed visually at actual output sizes. Discrete pose jumps alone are not automatically PASS or FAIL; evaluators inspect whether timing is intentional.

## 7. Export safety, deterministic operation and error semantics

Current MCP dispatch removes the target Godot folder before exporting. **v2 must be safer:** validate inputs and compute package in a private staging directory under the existing governed workspace, with bounded file size/count, regular-file checks and symlink/path traversal defenses; atomically publish only after all required files and metadata are written and verified. Failures must preserve the last known-good exported package. Recheck revision before commit. Do not let untrusted input select an arbitrary output path.

- Render/raster processes use execFile/spawn with argument arrays and bounded time/memory, never a shell command string built from asset input.
- Strict SVG escaping and an allowlisted SVG subset; no external network refs, DTD/entities, external fonts, arbitrary shader/script, unsafe file access or user-defined GDScript.
- Fixed animation resource node paths derived from validated safe IDs; avoid GDScript warning-as-error via typed declarations and pinned parse tests.
- Validate atlas region rectangle in-bounds, non-overlap including gutters, stable ordering and total bytes; forbid decompression bombs and oversized encoded PNG buffers.
- Deterministic file names and JSON key/order; store renderer/packager version, source revision, SHA-256 digests; support rerun reproducibility at the pinned CI environment.
- Failure statuses: INVALID_CUTOUT_V2, INVALID_POSE_OWNERSHIP, UNSUPPORTED_ANIMATION_PROPERTY, ATLAS_OVERFLOW, RASTERIZATION_FAILED, STALE_SOURCE_REVISION, GODOT_EXPORT_INCOMPLETE, ANIMATION_QA_FAILED. Never convert these to a fabricated success or visual GO.

No new FolderForge daemon, authentication layer, generic file editing tool, external paid model, mutable source artifact rewriter or unreviewed renderer dependency.

## 8. Proposed source boundaries for implementation planning

| Concern | Expected module owner | Public contract |
| --- | --- | --- |
| v2 schema and normalized cutout | src/cutout/validate.mjs (v1 preserved) and src/cutout/compile.mjs (new) | validateCutout(document,cutout), compileCutout(document,cutout,revision) |
| frame/track evaluation | src/cutout/animation.mjs (new) | sampleAnimation(clip,t), auditLoop(clip,policy) |
| SVG/PNG per-part rendering and alpha bounds | src/cutout/raster.mjs (new) using existing src/core/render-svg.mjs | renderCutoutFrames(normalized,renderer) |
| deterministic packing and manifest | src/cutout/atlas.mjs (new) | packAtlas(frames,{paddingPx,maxAtlasSize}), verifyAtlas(...) |
| Godot generator | src/export/godot-cutout.mjs refactor with internal isolated v1/v2 branches | exportGodotCutout({document,cutout,outputDir,...}) |
| governed MCP dispatch | src/mcp/server.mjs and src/mcp/store.mjs as needed | preserve export_godot_cutout arguments and existing seven core tools |
| quality and integrity report | src/cutout/qa.mjs (new) | buildCutoutQaReport(normalized,atlas,animation) |
| test harness | scripts/poc004-godot.mjs preserved; new scripts/phase3-godot.mjs and targeted test files | actual MCP call, generated Godot import, controlled runtime samples, technical report |
| frozen Lantern art testbed | examples/spirit-lantern/v2/* (new), not destructive replacement of old fixture | source, pose variants, animations, exported preview |
| documentation | docs/ROADMAP.md and docs/project/NEXT_RUN_PROMPT.md after approved delivery | evidence-gated status, no unsupported release claims |

These are **design proposals**, not a commitment to exact filenames or a completed implementation plan. The eventual plan must sequence RED→GREEN tests per layer, preserve module isolation and avoid a single all-purpose exporter file growing further.

## 9. Acceptance matrix and evidence

**G0 — Baseline regression:** v1 cutout/source fixtures, legacy SVG hash contract, appearance rendering, raw MCP smoke, existing benchmark/provenance suites and POC-004 pinned Godot headless run all remain green. Existing strict UNSUPPORTED_GODOT_APPEARANCE v1 rejection test stays meaningful.

**G1 — Validated v2 art contract:** five required logical parts, correct ownership/pivot/cycle checks, at least four authored flame poses, style profile compliance, bounded animations. Adversarial tests for NaN, negative scale, invalid IDs, ancestor cycles, duplicate/unknown pose nodes, duplicate track property, stale revision, runaway resource count.

**G2 — Deterministic texture package:** same source/renderer => same SHA hashes (under pinned toolchain); transparent 2048-bound atlas, nonoverlapping regions, no padding bleed, reconstructed part bounding boxes and pivots correct at scale 1; material-aware gradients/marks/glow survive rasterization. Golden PNG comparison across v1/v2 legacy content uses pixel-equivalent rather than requiring identical file encodings.

**G3 — Credible mechanical motion:** at least 4 flame poses, different talisman motion, tassel inertia, synchronized bounded light, two-cycle sampled loop/step thresholds above; enforce at runtime via headless Godot and independent pure sampler. A parser-only validation script is insufficient.

**G4 — Actual game import:** through raw MCP and, where available, FolderForge child plugin; generated project imports, instantiates, animates and runs under pinned Godot. Fail closed on missing texture, invalid resource path or script warnings. Test in an isolated workspace and verify returned manifest/asset SHA.

**G5 — Qualitative game feel gate:** save side-by-side **actual** exported Lantern frames/short loop plus at-size 64/128px views; log focused critique on silhouette, readability, handmade texture, flame movement, tassel and light feel; perform at least one image-grounded correction of the **same source asset** when a real image-visible editing loop is available. Evidence labeled AI_SELF_REVIEW unless a genuine independent non-author reviewer scores it. CI tests do not certify art direction.

**G6 — Delivery:** full exact-head PR CI SUCCESS, review and verified merge, post-merge main CI SUCCESS, safe branch cleanup to only main, artifact/runbook handoff. This is contingent on later separately approved execution. No product merge in the spec-writing phase.

**Allowed result claims:**
- TECHNICAL_PASS for mechanical schema/raster/animation/Godot verification with real artifacts and passing tests;
- VISUAL_REVIEW_PENDING until authentic independent review (Issue #21 remains separate);
- AGENT_PROVENANCE_PENDING while provider-origin attestation is absent;
- **never FULL_PASS, PRODUCTION_READY or an autonomous artist claim solely because Phase 3 technical gates pass**.

## 10. Threat model and adversarial review targets

Untrusted material: client-provided Art IR/SVG path strings, cutout part/pose IDs, animation keys, material fields, input workspace and any generated manifest. Trust boundaries: MCP JSON → validated source → renderer/PNG decoder → generated Godot resource → filesystem; Godot runtime treated as generated output but contains no client code.

Required negative tests:
1. SVG element/attribute, external URL, file/entity/script payload injection via path IDs or material marks; no external fetch or GDScript evaluation.
2. Long path, oversized canvas, inflated PNG and too many rendered variants; bounded CPU/memory/output, safe no-follow reads and private writes.
3. Duplicate node ownership and pose aliases creating one part in two places; hard error, never silent replacement.
4. Atlas bleed, off-by-one crop, incorrectly compensated pivot, invalid parent z/depth and unassigned glow alpha.
5. A malicious animation key causing negative scale, malformed resource path or a discontinuous seam; fail QA.
6. Failed or concurrent export must not delete last-good package; stale source revisions fail.
7. Legacy v1 manifest with appearance remains explicitly rejected (until a separately approved compatibility change); new v2 appearance path is tested and isolated.
8. A green animation/CI report cannot satisfy provenance attestation or human blind quality review.

Manual code review must include dependency pinning/security licenses, Godot asset import warnings, correctness of RGBA alpha/scale, deterministic ordering, resource bounds and output recovery. If only AI review exists, label it AI_SELF_REVIEW.

## 11. Delivery sequence (NOT an implementation plan)

After the written spec is approved, write a separately reviewed task-level plan in docs/superpowers/plans/ with file-by-file TDD RED→GREEN, commands, commits, exact acceptance and failure handling. Proposed dependencies:

1. Freeze legacy regression fixtures and write v2 schema/ownership tests.
2. Write pure compiler + animation sampler and loop QA.
3. Implement bounded per-part/pose raster and material-aware alpha crop.
4. Deterministic packer + atlas metadata, pivot reconstruction and corruption tests.
5. Godot v2 scene/animation/light emission export, staged atomic publishing.
6. Finish authentic MCP/Godot headless integration tests and visual review bundle.
7. Run security/compatibility review, exact-head PR CI, merge and cleanup after distinct execution approval.

Task scheduling must protect the user from a half-shipped change: v1 continues passing throughout. If material-aware raster/atlas cannot pass security or reproducibility gates, **stop and report the blocker** rather than downgrade acceptance silently.

## 12. Explicit out-of-scope and open design decisions

Not in this slice: Wandering Cultivator (Phase 4), 10-asset consistency benchmark (Phase 5), 3D/Blender, full body mesh deformation, particle physics, GPU shaders, external asset generators, hosted model inference, changes to human reviewer/attestation policy.

Decisions to ratify when reviewing this written spec:
- **v2 atlas vs deterministic cropped part package:** preferred is one packed atlas. If render/packing dependency adds unacceptable attack surface, a *formally reviewed* scope reduction to deterministic cropped parts must be explicit before plan approval.
- **Texture region representation:** AtlasTexture or Sprite2D.region_enabled, but not both without an explicit tested transform mapping.
- **Flame authored poses:** choose 4–8 distinct explicit vector pose pairs with bounded per-pose variation and no hand-waved procedural "more realistic" claim; final art needs visually inspected samples.

## 13. Sources and audit reproducibility

Repository baseline: https://github.com/roronoazoroshao/game-artist-mcp/tree/d39f20bba78cc52537a6ef66a0949c5ca727b43e

- POC-004 source: https://github.com/roronoazoroshao/game-artist-mcp/blob/main/docs/POC_004.md
- Existing cutout: https://github.com/roronoazoroshao/game-artist-mcp/blob/main/examples/spirit-lantern/cutout.json
- Exporter: https://github.com/roronoazoroshao/game-artist-mcp/blob/main/src/export/godot-cutout.mjs
- Existing appearance restriction: https://github.com/roronoazoroshao/game-artist-mcp/blob/main/test/appearance-godot.test.mjs
- Existing CI: https://github.com/roronoazoroshao/game-artist-mcp/blob/main/.github/workflows/ci.yml
- Godot AtlasTexture documentation: https://docs.godotengine.org/en/4.4/classes/class_atlastexture.html
- Godot Animation documentation: https://docs.godotengine.org/en/4.5/classes/class_animation.html

**Review handoff:** APPROVE / REQUEST_CHANGES this written spec; only APPROVE authorizes drafting the *implementation plan*, not product implementation. This PR is documentation-only; do not merge or write product code solely under discovery authorization.
