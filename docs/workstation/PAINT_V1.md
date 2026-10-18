# AI Artist Workstation — Native Painting V1

**Status:** technical 2D raster painting vertical slice. This is not a fully autonomous professional studio or a commercial art certificate.

## ChatGPT / MCP tool flow

1. `asset_create({"asset_id":"demo","width":128,"height":128})`
2. `paint_open({"asset_id":"demo"})` — starts a separate painting document; vector asset remains unchanged.
3. `paint_apply({"asset_id":"demo","expected_revision":0,"operations":[...brush instructions...]})`
4. `paint_preview({"asset_id":"demo","size":64})` — returns a PNG image block that a vision-enabled ChatGPT host can actually inspect.
5. `paint_compare({"asset_id":"demo","baseline_revision":0,"candidate_revision":1,"size":64})` — objective changed-pixel metrics; not aesthetic evaluation.
6. Repeat `paint_apply` with revision checking. `paint_restore` creates a *new* revision copied from an earlier one without discarding the journal.
7. `paint_export({"asset_id":"demo","expected_revision":CURRENT})` publishes a hash-named immutable Godot 4 **static Sprite2D** package and evidence; exportAllowed remains false.

Example brush transaction:
```json
{
  "asset_id": "demo",
  "expected_revision": 0,
  "operations": [
    {"type":"layer.create","layerId":"glow"},
    {"type":"stroke.draw","layerId":"glow","color":"#3acfff","radius":7,"opacity":0.8,
     "points":[[30,60,0.35],[64,32,1],[86,70,0.4]]},
    {"type":"layer.settings","layerId":"glow","opacity":0.9,
     "mask":{"x":20,"y":10,"width":95,"height":100}}
  ]
}
```

`stroke.erase` accepts `layerId`, `radius`, `opacity`, `points` (no color); layer mask uses a bounded integer rectangle. `layer.settings` may instead set `visible`, `opacity` or `mask:null`.

## Limits and trust boundaries

- Deterministic programmatic RGBA paint, not AI-generated paint pixels. The AI agent *chooses* brush operations after inspecting an MCP image.
- Existing 1–256px **integer** asset canvas; 8 layers, 12 ops/transaction, 96 revisions and cumulative replay brush-work budgets. No remote URLs, code execution or filesystem paths accepted as brush parameters.
- Shared per-asset optimistic concurrency lock. Project and export paths under the existing asset identity. Existing vector/cutout document is unaffected.
- No imported reference bitmap, native PSD/Krita brush system, layers' editable source for external paint apps, generalized masks, pressure tilt, physically based brushes, procedural character rig or 3D in this first slice.
- Export Godot has only a static Sprite2D; animation, realistic gameplay background integration, art direction and auto-correction orchestration are future milestones.
- Objective pixel difference metrics support **AI advisory critique**, never automatically signal `ARTISTIC_GO`.
- Produced assets are **`artisticReview:UNSCORED`, `rightsVerified:false`, `exportAllowed:false`** until source-specific rights and visual quality are established. This new subsystem does not depend on PR #43's unresolved Firefly license.

## Run reproducible evidence

```bash
npm test
npm run smoke:mcp
node scripts/artist-paint-godot-smoke.mjs
```
CI additionally runs the Godot smoke using pinned Godot 4.7.2. `GODOT_BIN` may point to another *actual* local Godot version for an exploratory host check; pin exact version when asserting CI compatibility.

## Roadmap after V1

1. V2 canvas >256px through sparse tiles, imports with explicit provenance, editable bitmap layers, region select/mask, image registration and non-destructive effects.
2. Vision critic loop controller with goal/rubric, bounded revise/capture/checkpoints, style consistency, reference/mood board and human reject/retry.
3. Godot in-game capture and perceptual A/B under moving camera and lighting, then character walk/attack animation and packed cutout rig.
4. Later deterministic Blender/3D worker with model/texture provenance and review, separate security and resource budgets.
