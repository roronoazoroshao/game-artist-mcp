# Game Artist MCP

An AI-native deterministic game-art workstation for agent hosts.

Game Artist is **not** another general MCP control plane and does **not** use a generative image model as its core art engine.

Its job is to give an LLM explicit game-art operations:

```text
LLM
 ↓
Game Artist MCP
 ↓
Art IR / explicit geometry
 ↓
render
 ↓
visual inspection
 ↓
targeted edit
 ↓
game-ready asset
```

## Relationship to FolderForge

FolderForge is the preferred production host/control plane:

```text
ChatGPT / MCP host
        ↓
    FolderForge
        ↓
   Game Artist
        ↓
 deterministic art core
```

FolderForge owns generic infrastructure such as transport, authentication, policy, audit, sandboxing, plugin lifecycle and broad Godot control.

Game Artist owns art-domain capabilities such as vector/cutout representation, pivots, animation recipes, style constraints and art QA.

The core remains usable directly through MCP without FolderForge.

See:

- [ADR-0001](docs/ADR_0001_FOLDERFORGE_BOUNDARY.md)
- [Roadmap](docs/ROADMAP.md)
- [POC-001](docs/POC_001.md)
- [POC-002](docs/POC_002.md)

## Current state

- POC-001/002: deterministic vector art engine and 11-tool stdio MCP with FolderForge integration.
- POC-003: render → image inspection → targeted edit loop (mechanics only).
- POC-004: Spirit Lantern cutout/Godot exporter and headless runtime verification.
- POC-005A: ArtStyleProfile, safe structural evidence auditor, and three **agent-directed local MCP** trials (cultivation sword, medicinal pouch, stone censer) under [benchmarks/poc005a/runs](benchmarks/poc005a/runs). Each preserves two actual PNG renders and a correction on the same asset. Their local structural audit is included in `npm test`.

**Evidence boundary:** The three live sessions were executed through a local stdio MCP transport, not an independently audited provider-origin agent host. Their image critique is SELF_REVIEW. The repository therefore retains `AGENT_PROVENANCE_PENDING` and **does not claim artistic FULL_PASS, independent aesthetics approval or production art quality**. See [POC-005A benchmark protocol](benchmarks/poc005a/README.md).

POC-005B is merged: opt-in material-aware Art IR, deterministic gradient/hand-directed surface marks/bounded glow, plus controlled same-geometry 64/128-pixel A/B review bundles for those three earlier props. The review bundles are **UNSCORED**. A fourth original compass asset was constructed through a new **self-selected** local MCP session (not an evaluator-supplied held-out prompt): 28 nodes, 14 MCP calls, 3 rendered previews and 2 image-grounded corrections. The latest correction restored an open suspension loop that an inappropriate appearance fill made visually solid. Historical revision-2 media are preserved. Technical and style gates pass, but external authorship attestation and independent visual scoring remain pending. See [POC-005B review protocol](benchmarks/poc005b/README.md) and [latest handoff](docs/project/NEXT_RUN_PROMPT.md).

**Hard limits:** Material-aware Godot export is currently unsupported (`UNSUPPORTED_GODOT_APPEARANCE`), even though the legacy Spirit Lantern passes headless Godot. Green CI proves technical behavior, not aesthetic quality, autonomy or production art readiness.

## Native AI Artist Workstation — Paint V1 (technical prototype)

The optional `paint_*` tool family lets an MCP-capable vision host paint original RGBA strokes, mask/layer them, inspect 64/128px previews, compare historical revisions, roll back and generate a static Godot Sprite2D package. All decisions remain agent-directed and technical; no human-review or rights-clearance claims are inferred. See [Paint V1 workflow and limits](docs/workstation/PAINT_V1.md).

## Local development

Requirements:

- Node.js 22+
- `rsvg-convert` from librsvg for PNG previews

Run the raw MCP server:

```bash
node src/mcp/server.mjs --workspace ./.game-artist
```

Run the direct protocol smoke:

```bash
npm run smoke:mcp
```

To verify the FolderForge integration before the compatible package is published, build the exact source revision used by CI:

```bash
git clone https://github.com/roronoazoroshao369/FolderForge.git ../FolderForge
git -C ../FolderForge checkout 59c1096167a81bef24a07fa88453f5c50e0fe64a
npm --prefix ../FolderForge ci --ignore-scripts
npm --prefix ../FolderForge run build
node ../FolderForge/dist/main.js plugin validate .
node ../FolderForge/dist/main.js plugin test . --call health --args-json '{}'
```

Do not infer npm availability from FolderForge's source `package.json`; POC-002 pins source evidence until a compatible public package is actually published.

**POC-005C1 (implemented technical workflow, still UNSCORED):** [Offline Hybrid Independent Visual Evaluation](benchmarks/poc005c1/README.md) now reconstructs three actual baseline/enhanced props, checks geometry and 64/128px PNG bytes, creates reviewer-only offline A/B packages, accepts evaluator-verified blind human scoring, locks forms before mapping reveal and computes deterministic VISUAL_GO/ARTISTIC_NO_GO/REVIEW_PENDING. AI critic input is ADVISORY_ONLY, never a human reviewer. Run `npm run poc:005c1:dry` to generate an UNSCORED CI reviewer kit; its result must stay `TECHNICAL_PASS`, `REVIEW_PENDING`, and zero independent reviewers. Source: [spec](docs/superpowers/specs/2026-10-09-poc005c1-hybrid-independent-visual-evaluation-design.md), [TDD plan](docs/superpowers/plans/2026-10-09-poc005c1-hybrid-visual-evaluation.md), [reviewer instructions](benchmarks/poc005c1/README.md). The shipped implementation was checked by SELF_REVIEW because no separate subagent/code-review tool was exposed; do not mislabel that as independent code review.

**POC-005C1 trust-boundary follow-up (PR #19):** The offline reviewer must now explicitly attest HUMAN/NOT_ART_AUTHOR/NOT_EXPOSED; evaluator verification must bind to the same frozen session/package and acknowledgement timestamp, and a separate distinct out-of-band evidence reference is required for each reviewer. Previous reviewer kits without the declaration are incompatible: issue a NEW frozen review session; never manufacture or retroactively edit human attestations. Mechanical tests do not prove reviewer identity or artwork merit.

**Next external evidence gate:** obtain at least one real independent non-author human blind evaluation at 64px/128px (ideally two, frozen quorum), and independently obtain a provider-attested image-visible agent run on an evaluator-assigned new brief (separate POC-005C2). No human visual scores or provider-origin attestations have been supplied; the repository MUST retain `VISUAL_REVIEW_PENDING` / `AGENT_PROVENANCE_PENDING` until authentic evidence exists. A green CI or a synthetic fixture is not artistic GO or production-readiness proof.

## POC-005C2 — completed offline provenance verifier (not live autonomy proof)

Approved Tasks 1–7 were merged through [PR #25](https://github.com/roronoazoroshao/game-artist-mcp/pull/25) with final product HEAD `8238573b92aaea45599f65086679c3554697b0c8`. Exact-head PR CI [38105151880](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38105151880) succeeded with 147/147 unit tests; full post-merge main CI [38105216121](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38105216121) and cleanup [38105281569](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38105281569) succeeded. Product merge commit: `346b526e22ad53be92235b1267c0509261f99ec4`. All branches cleaned to `main` at product-delivery checkpoint.

The offline verifier implements strict challenge/event/export contracts, fail-closed trust policy, anti-replay event/call auditing, image-delivery/revision/workflow checks, redacted CLI, and zero-paid-call synthetic CI. See [operator runbook](benchmarks/poc005c2/README.md), [approved spec](docs/superpowers/specs/2026-10-09-poc005c2-provider-attested-autonomous-artist-design.md), [implementation plan](docs/superpowers/plans/2026-10-09-poc005c2-provider-attested-autonomy.md). Do not confuse structural `TECHNICAL_PASS` with verified artist autonomy: signed independent provider model-decision receipts are unavailable, so **`PROVIDER_ATTESTATION_UNAVAILABLE`**, `AGENT_PROVENANCE_PENDING` and `VISUAL_REVIEW_PENDING` remain. Task 8 authentic pilot is BLOCKED, not run. No independent humans or agent-provider witnesses were impersonated, and no production art quality was demonstrated.
