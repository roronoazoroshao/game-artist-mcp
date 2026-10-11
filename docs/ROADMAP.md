# Game Artist MCP roadmap

The roadmap is evidence-gated. A later phase does not start merely because the previous code exists; its acceptance gate must pass.

## Product goal

A user should eventually be able to request:

> Create an original animated spirit lantern for my stylized cultivation survival game and make it ready for Godot.

The system should create explicit source geometry, game-ready parts, pivots, animation, atlas/metadata, run technical QA, export Godot resources and support a visual correction loop.

## Architecture rule

FolderForge is the preferred production host/control plane.

Game Artist owns only domain-specific art intelligence and deterministic art tooling.

The core remains usable without FolderForge through raw MCP/CLI/test clients.

## Phase 0 — POC-001: deterministic art substrate — PASS

Evidence already merged:

- explicit JSON art document;
- deterministic SVG rendering;
- validation;
- revision-checked transactional edits;
- Linux PNG rasterization.

This proves mechanics, not artistic quality.

## Phase 1 — POC-002: real child MCP + FolderForge integration — PASS

### Build

- dependency-free MCP stdio server;
- persistent bounded asset store;
- compact tool surface;
- PNG image result for visual clients;
- FolderForge plugin manifest;
- direct MCP smoke test;
- FolderForge plugin validate/test smoke.

### Tool surface

- `health`
- `asset_create`
- `asset_get`
- `document_query`
- `document_apply_ops`
- `render_preview`
- `validate_asset`
- `export_asset`

### Gate

PASS only when:

1. direct MCP initialize and tools/list succeed;
2. an asset can be created through MCP;
3. a batched edit advances revision;
4. stale revisions fail;
5. preview returns a valid PNG image content block;
6. export produces SVG + PNG + report;
7. FolderForge validates and starts the package as a real child plugin;
8. CI passes on exact PR head.

## Phase 2 — POC-003: autonomous render → inspect → edit loop — PASS (mechanics)

Use an MCP-capable vision host to construct and correct:

1. Jade Spirit Stone;
2. Ancient Spirit Lantern.

Measure:

- MCP round trips;
- internal operations;
- preview renders;
- correction iterations;
- elapsed time;
- hard validator failures;
- output hashes.

Verified Spirit Lantern evidence:

- 9 MCP tool calls;
- 37 explicit operations;
- 2 preview renders;
- 1 real vision-driven correction iteration;
- zero hard validation errors;
- the corrected render is materially but modestly better.

This passes the closed visual-loop mechanics. It does **not** prove production-quality art. The current visual ceiling remains a primary risk to attack in later style/abstraction work.

## Phase 3 — game-ready Spirit Lantern vertical slice

Add domain IR:

- part;
- pivot;
- parent/attachment;
- animation clip;
- transform keyframe;
- emission role;
- collision metadata.

Required parts:

- body;
- flame;
- left talisman;
- right talisman;
- tassel.

Required output:

- source document;
- PNG/SVG outputs;
- animation metadata;
- atlas or deterministic part package;
- Godot scene/resources;
- headless Godot import/run validation.

FolderForge Godot tools should verify runtime behavior rather than duplicating a new Godot control plane here.

## Phase 4 — cutout character

Original Wandering Cultivator:

- separated body parts;
- pivots;
- hierarchy;
- idle;
- walk;
- attack;
- equipment slot.

Gate on:

- silhouette/readability;
- clipping;
- loop continuity;
- foot sliding;
- Godot runtime validity.

## Phase 5 — measurable style system

Introduce ArtStyleProfile with measurable constraints:

- proportions;
- line-weight ranges;
- palette limits;
- value contrast;
- angularity;
- asymmetry;
- detail density.

Benchmark at least 10 independently created assets for cross-asset consistency.

## Phase 6 — production hardening

- resumable asset jobs;
- checkpoints/history;
- quotas;
- concurrency;
- cancellation;
- bounded artifact storage;
- observability;
- security review;
- packaging;
- FolderForge plugin signing/packaging;
- raw MCP compatibility tests.

## Phase 7 — optional 3D extension

Only after 2D cutout proves economic value:

- Blender worker;
- stylized props;
- weapons;
- alchemy furnace;
- directional rendering.

Do not begin with humanoid sculpting.

## Kill criteria

Redesign or stop a modality if:

- simple icons need hundreds of MCP round trips;
- cutout props remain visually poor after two abstraction redesigns;
- the agent cannot reliably self-correct visible errors;
- style consistency remains poor across a 10-asset benchmark;
- Godot packages remain brittle despite deterministic technical validation.


## POC-005A — trusted artistic benchmark substrate

**2026-10-08 local experiment status:** three local MCP interactive trials exist under `benchmarks/poc005a/runs/` (cultivation sword, medicinal pouch, stone incense burner). Each has a genuine initial PNG returned by the server, an image-informed same-asset correction and a revised PNG. Local evidence was machine-audited; Art IR and style checks pass. The feedback remains SELF_REVIEW. Provider-side agent-authorship proof and a third-party reviewer at 64px/128px are NOT available. Outcome remains `AGENT_PROVENANCE_PENDING`, not artistic PASS.

The next decision is to obtain independently verifiable agent-host provenance and repeat/attest the trials, then grade art quality. If the quality gate fails, move to POC-005B *as a redesign based on measured errors*, not an assumed success.

## Earlier POC-005A delivery note

The existing style profile/read-only MCP contract is supplemented with safe benchmark auditing and a runbook. Synthetic CI is STRUCTURAL ONLY. Three genuine agent-origin props, real image-based correction rounds, verified provider provenance and independent 64px/128px review remain the artistic full-pass gate. FolderForge host availability is a dependency, not an excuse to fabricate art success. POC-005B quality and atlas work will be selected from actual results.

## POC-005B — material-aware technical implementation (2026-10-08)

This implementation introduces strictly opt-in original Art IR appearance for directional paint, manually authored clipped wear/fold marks and bounded spirit glow. Flat legacy documents keep the original renderer path and SHA baselines. Style inspection includes appearance colors and mark stroke restrictions. Godot cutout export with new appearance is explicitly unsupported until a future separately reviewed implementation; legacy cutout remains valid.

Technical A/B script `npm run poc:005b` uses **only a generic synthetic shape** to verify PNG at true 64px and 128px, controlled same-geometry variants, reproducible hashes and reviewer template. The fixture is not actual artistic proof. Before any production-quality or autonomy conclusion, still require independent blind 64/128 review of sword/pouch/censer and real provider-origin vision-agent provenance on unfamiliar asset briefs.

Statuses: `TECHNICAL_ONLY` for CI fixtures, `VISUAL_REVIEW_PENDING` and `AGENT_PROVENANCE_PENDING` until separate external gates are satisfied. Do not conflate a green CI with art quality.

## POC-005C2 — provider-attested autonomous artist benchmark (2026-10-11)

**Offline Tasks 1–7: IMPLEMENTED / TECHNICALLY_VERIFIED in synthetic scope only** by [PR #25](https://github.com/roronoazoroshao/game-artist-mcp/pull/25). Exact product head `8238573b92aaea45599f65086679c3554697b0c8`; main product merge `346b526e22ad53be92235b1267c0509261f99ec4`; exact PR [CI 38105151880](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38105151880) SUCCESS, post-merge main [CI 38105216121](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38105216121) SUCCESS, [cleanup 38105281569](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38105281569) SUCCESS.

Evidence delivered: host/provider capability assessment, versioned contracts, verifier-controlled issuer-policy scaffold that **never invents signed receipts**, anti-replay event-chain audit, image-delivery / render-revision / tool-budget checks, redacted read-only offline CLI, synthetic adversarial suite and CI runbook. Task 8 is **BLOCKED: PROVIDER_ATTESTATION_UNAVAILABLE**; provider-signature format and independent verification root are not established. A trace generated locally is not provider proof. Strict GO, full visual artistic quality, and production release remain unestablished.

Next separately gated objectives:
1. Independently obtain and verify genuine provider-issued model decision + image delivery receipts, **or** record that this model/provider tier is unavailable and propose a distinctly scoped host-attested research milestone for written approval. No paid model calls without authorization.
2. Complete POC-005C1 independent non-author human artistic blind reviews (Issue #21) using genuine reviewers; CI dry kits are not human scores.
3. Start **Phase 3 Spirit Lantern game-ready vertical slice discovery/spec** according to the earlier roadmap, with new design and implementation plan approval gates. C2 approvals do not authorize expanded cutout/Godot/3D code.
