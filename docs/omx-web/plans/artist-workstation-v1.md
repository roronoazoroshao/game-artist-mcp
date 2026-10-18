# AI Artist Workstation — Paint V1 vertical slice (2026-10-18)

Base main: 6ba1bcc90c9eceb0e4d08f39db0c0c07b38f5e4e, branch feat/artist-workstation-paint-v1.
This milestone is a technical implementation, NOT a claim that all image editing is complete or production quality is achieved.

## GOAL-001 — Native local painting (P0)
A new asset-scoped, revisioned painting project owned by the existing MCP asset identity. Bounded RGBA canvases, layers (visibility/opacity), non-destructive rectangle masks, pressure-aware strokes and eraser; deterministic pixel blend. The LLM controls brush instructions; **no generative model** inside the painting engine.

## GOAL-002 — Tool loop (P0)
MCP paint_open, paint_apply, paint_preview, paint_compare, paint_restore and paint_export. Preview returns image content to an image-capable MCP host. Compare produces objective changed-pixel/coverage measurements; AI vision remains responsible for aesthetic evaluation. Restore creates a new revision preserving edit history.

## GOAL-003 — Real Godot (P0 technical integration)
Export PNG plus Godot 4 Sprite2D scene, one immutable locally versioned package. A real pinned Godot runner on Actions should import/run this scene, with an explicit test. No rigged 3D/character or AI-model provenance claims.

## Technical constraints / security
- Independent optional paint state from legacy document; legacy SVG/cutout and PR43 untouched.
- Max 256x256 canvas, <=8 layers, <=96 history revisions, <=12 operations/batch, <=96 strokes, <=64 points/stroke, <=24px radius; integer/floats validated and bounded before any allocation.
- Asset id validation, same per-asset multiprocess writer lock, optimistic expected revision, max state file 512KiB, symlink and escape rejection; atomic replace.
- Before image generation, guard cumulative rendering work and reject invalid JSON/unknown keys. Never call network.
- Genuine AI external reviewer, rights/production export and commercial deploy are out of scope; generated art evaluated technically only.

## Acceptance
RED->GREEN unit and MCP e2e: paint new artwork, preserve legacy vector state, layer mask, erase, revision conflicts, compare, restore, deterministic PNG hash, PNG tool content, export Godot, no symlink writing, no path traversal or oversized inputs. Full npm test + exact head GitHub CI; independent review isn't claimed.

## Alternatives
Embedding painting in legacy AssetStore document: rejected because it would force raster semantics into existing Art IR and fail vector compatibility.
Independent process/plugin: rejected because it duplicates asset identity, locks, and MCP host policy.
Chosen: module in same MCP server with separate revisioned painting document under the asset-owned workspace.
