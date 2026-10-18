# AI Artist Workstation — R2 raster import & technical visual feedback

Status: **technical implementation**, based on PR #45 V1, not autonomous artistic approval.

## Agent-to-tool workflow

The host ChatGPT (or a vision-capable model) supplies an existing, user-authorized **RGBA PNG** as **canonical base64**; the service never downloads from an arbitrary URL or generates imagery by itself.

1. `asset_create` / `paint_open` initializes one painting project, <=256px integer sides.
2. `paint_import_png` records the original PNG and SHA256 in a **new source layer** using optimistic `expected_revision`. The original source survives subsequent non-destructive painting history. Never import unlicensed source material.
3. `paint_preview` returns PNG for a vision-capable model to inspect (64px, 128px or full canvas).
4. `paint_apply` performs an explicit agent-directed layer or brush correction.
5. `paint_diff_preview` returns a real PNG change heatmap (bright pixels changed, muted pixels unchanged). `paint_compare` returns deterministic numeric metrics.
6. `paint_evaluate` applies a *bounded objective-only stopping rule*: minimum/maximum opaque coverage, minimum changed pixels, and revision budget. It returns `OBJECTIVE_TARGET_MET`, `REVISION_REQUIRED`, or `RETRY_BUDGET_EXHAUSTED`. **These are not beauty scores, visual approval, or evidence that an LLM actually ran additional iterations.** A vision-capable host must interpret/approve screenshots separately and issue the next brush stroke.
7. `paint_restore` rolls back to a historical version while preserving the journal.
8. `paint_export` exports a hash-addressed **static Sprite2D** Godot 4 project; both vector originals and PR #43 remain untouched. Art metadata remains `UNSCORED`, `rightsVerified:false`, `exportAllowed:false`.

### Minimal import payload

```json
{
  "asset_id": "demo",
  "expected_revision": 0,
  "layer_id": "reference",
  "image_base64": "<canonical PNG bytes encoded in base64>",
  "source_label": "user-provided-prop"
}
```

`source_label` is a **non-attested description**, not copyright proof.

### Technical evaluator payload

```json
{
  "asset_id": "demo",
  "baseline_revision": 1,
  "candidate_revision": 2,
  "size": 64,
  "min_coverage": 0.05,
  "max_coverage": 0.8,
  "min_changed_pixels": 10,
  "max_iterations": 3
}
```

The returned `artisticReview` stays `UNSCORED`, even on `OBJECTIVE_TARGET_MET`.

## Resource/security limits

- No file path or URL; base64 must be canonical with no appended bytes, max **96KiB encoded source PNG bytes** per import, and direct MCP request is additionally transport-budgeted.
- IHDR width/height must exactly match painting canvas, un-interlaced 8-bit RGBA, valid PNG checksum and chunk verification.
- Two imported bitmap layers per project history, eight layers total, 512KiB state file, operation/brush budgets as V1.
- Source content and SHA256 live in the asset-local revision journal. This favors recoverability over large art assets; large/partially transparent/photo-quality 256px imports may exceed budget and should fail closed.
- No network fetch/SSRF or generated license claims. No automatic image-to-sprite split, Krita PSD roundtrip, clone/heal or 3D.
- Restores and corrupted source-digest detection are tested; exported Godot retains the raster changes only as a static Sprite2D.

## Evidence

`node --test test/artist-workstation-v2.test.mjs`, `npm run smoke:mcp` (21 tools and real PNG import), and `node scripts/artist-paint-godot-smoke.mjs` (original and imported-and-corrected Sprite2D projects) on a real Godot binary. CI runs using pinned Godot 4.7.2 at the PR exact HEAD.

Next milestone: a separate **external host-orchestrated** visual agent controller with explicit trusted asset ownership, multiple in-game Godot captures, owner-defined aesthetic goals, feedback, retry/resume and independent art evaluation. Model cannot be simulated by a local pixel threshold.
