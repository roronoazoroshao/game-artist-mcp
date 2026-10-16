# R9b — Editable Layered Art and Secure OpenRaster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author, interchange and inspect real multi-layer 2D game-art work products using bounded OpenRaster `.ora` files and per-part straight-alpha PNG layers while preserving R9a and all deterministic legacy behavior.

**Architecture:** Add small isolated image compositor (`src/ai-art/layer-composite.mjs`) and secure ZIP/ORA reader/writer (`src/ai-art/openraster.mjs`); no provider API integration, no unsafe filesystem staging and no legacy cutout/Godot export changes. Writer produces a baseline ORA with first STORED mimetype, stack.xml, data/*.png, mergedimage.png and thumbnail. Reader accepts only a declared interoperable subset: flat top-to-bottom layers, normal src-over, optional offsets/opacity/visibility, STORED/DEFLATE; rejects unsupported groups/modes rather than silently flattening. Validate archive boundaries, path ownership, ZIP CRC, PNG CRC and merged preview pixel equivalence.

**Tech Stack:** Node.js 22+, `pngjs@7.0.0`, node:zlib, node:crypto, Node `node:test`. No dependencies added. OpenRaster baseline layout/stack specs, v0.0.6.

**Spec:** `docs/superpowers/specs/2026-10-16-r9-ai-assisted-layered-art-production-design.md`. Owner approved Option B, written spec, general five-stage plan and continued Native execution after R9a. This plan implements **R9b only**.

## Global Constraints
- R9b is **import/authoring infrastructure only**; do not imply a model generated any art yet or that Godot raster export is implemented.
- Never modify R9a's exported contracts or legacy deterministic cutout/engine during this phase.
- Input ORA max 24 MiB compressed, 64 MiB total uncompressed, max 80 ZIP entries, max 64 KiB XML; layers <=24, individual PNG <=4 MiB and <=4,194,304 pixels; compressed expansion ratio cap 256.
- Canonical ZIP paths only, no traversal/absolute/backslash, no duplicate names, no entries marked symlinks, no external resources, no DTD/entities (except standard safe escaped attribute entities written by us).
- Preserve opacity [0..1], visible/hidden, integer x/y, stack order (first = top), RGBA layer pixels and source-over compositing; reject unsupported blend/group semantics, do not silently discard.
- Deterministic ORA outputs, SHA256 and compare decoded composited merged PNG pixels after importing.
- Critical: `RIGHTS_UNVERIFIED` remains export-blocked and provider-authored evidence remains self-reported until authenticated; do not claim artistic independent score.

## Review Focus
1. Malicious ZIP with traversal, duplicate/colliding names, Unix symlink, forged central/local CRC or zip-bomb must fail closed (Task 2).
2. XML with DTD/entity/external refs, nested groups or unsupported blend mode must fail, not silently flatten (Task 2).
3. Semi-transparent PNGs at offset boundaries must produce correct straight-alpha source-over with no double premultiplication (Task 1).
4. Hidden layers and stack top-first order must be preserved after ORA round-trip and not included in merged PNG (Tasks 1–2).
5. Staged per-part mask must not paint outside the supplied mask and must be reproducible (Task 1).

### Task 1 — deterministic compositing and non-destructive masks

**Files:** `src/ai-art/layer-composite.mjs`; `test/r9b-compositor.test.mjs`.

**Interface:** `composeLayers({width,height,layers}) -> Buffer PNG`; each layer `{id,png:Buffer,x=0,y=0,opacity=1,visible=true}`, **first layer is topmost**. `applyAlphaMask(png,maskPng) -> Buffer PNG` multiplies existing alpha by mask alpha, leaves color channels unchanged and verifies size.

- [ ] Write tests with pixel exact comparisons for red 50% atop blue opaque, hidden top layer, shifted/clipped layers, all-transparent output, and mask alpha multiplication.
- [ ] Commit tests, observe RED at exact branch CI due to missing module.
- [ ] Implement compositor using `inspectAiPng`, bounded total pixels, `PNG.sync.read/write`, correct unpremultiplied source-over; reject unknown keys, noninteger offsets, unsafe images, duplicate layer ids.
- [ ] Run full branch CI for GREEN, record run IDs; commit.

### Task 2 — secure baseline ORA ZIP author and importer

**Files:** `src/ai-art/openraster.mjs`; `test/r9b-openraster.test.mjs`.

**Interfaces:** `writeOpenRaster({width,height,layers}) -> Buffer` and `readOpenRaster(bytes:Buffer) -> {width,height,layers,mergedPng,thumbnailPng,sha256}`. Inputs use same layer objects. Only flat normal src-over layers supported. Writer uses standard ZIP STORED records, mimetype first; reader supports ZIP STORED/DEFLATED and validates central directory offsets, local names, attributes, CRC, sizes, no overlaps/duplicate entries; output includes standard OpenRaster stack.xml and thumbnail max 256.

- [ ] Write tests: ORA ZIP magic and first stored mimetype; two partially transparent shifted layers; test import/export retains order, x/y/visibility/opacity/pixels and matches decoded merged image; deterministic binary output.
- [ ] Add malformed ZIP tests by modifying archive byte ranges: traversal, unsupported compression, missing required files, mismatched CRC, symlink external mode, forged uncompressed size, nested stacks or XXE/DOCTYPE.
- [ ] Observe RED CI, then implement minimal bounded ZIP writer/reader and conservative XML parsing with fixed schemas; reject unsupported features loudly.
- [ ] Verify targeted + full CI GREEN; commit.

### Task 3 — R9b evidence, review and guarded integration

**Files:** `docs/project/R9B_LAYERED_ART.md`, GitHub PR and issue #36 comment. No legacy code modifications.
- [ ] Update interoperability limitations and remaining security/rights/provider gaps; mark actual AI painting/ORA Godot export `UNSTARTED`.
- [ ] Inspect diff, review security/art concerns; AI self-review = COMMENT only, not independent approver.
- [ ] Verify exact-head PR CI, then merge when no unresolved P0/P1 and owner-authorized integration; verify main push CI and branch-cleanup workflow; exactly one `main` remaining.
- [ ] Record real evidence links and next R9c raster-to-Godot handoff in issue #36.

**DONE:** ORA writer/read validates/roundtrips editable stack and normal-alpha PNG compositor tests, with all old tests passing. NOT DONE: AI generative art, ORA editor compatibility tested by a human, Godot raster exporter, visual 9–10.
