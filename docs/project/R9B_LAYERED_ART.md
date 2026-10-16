# R9b — Editable OpenRaster and masked-layer compositing (TECHNICAL)

**Tracking:** [Issue #36](https://github.com/roronoazoroshao/game-artist-mcp/issues/36), [approved R9 architectural spec](../superpowers/specs/2026-10-16-r9-ai-assisted-layered-art-production-design.md), [R9b implementation plan](../superpowers/plans/2026-10-16-r9b-openraster-layered-art.md). **Visual score UNSCORED; NOT generated artwork.**

## What R9b actually implements

- `src/ai-art/layer-composite.mjs`: loss-aware but deterministic **straight-alpha source-over** compositor. OpenRaster first layer is top, so composite in reverse, preserving visibility, bounded signed x/y, 0–1 opacity. Per-part `applyAlphaMask` multiplies alpha using an explicit independent mask PNG, keeps source RGB and does not overwrite the source. All inputs are validated with R9a bounded CRC-aware PNG validator.
- `src/ai-art/ora-zip.mjs`: standard ZIP local/central headers, CRC32, deterministic STORED writer, bounded reader supporting STORED and DEFLATED. Rejects path traversal, non-allowlisted entry names, duplicate file paths, symlinks, encryption, split archives, unsafe sizes/ratios, invalid offset ranges, mismatched local/central headers and CRC. The first entry is the **uncompressed `mimetype`** with exact `image/openraster`.
- `src/ai-art/openraster.mjs`: `writeOpenRaster({width,height,layers}) -> Buffer`, `readOpenRaster(bytes) -> {width,height,layers,mergedPng,thumbnailPng,sha256}`. Exports required `stack.xml`, individual `data/*.png`, `mergedimage.png`, and `Thumbnails/thumbnail.png`. Imported merged image must **pixel-match recompositing the separate layers**. Import rejects XML DTD/ENTITY and unsupported nested groups/blend modes rather than silently discarding data. Supports a conservative **flat** OpenRaster baseline subset; it is not a universal editor-format roundtripper.
- `scripts/r9b-spirit-lantern-ora.mjs`: reproducibly derives an ORA artifact from **actual existing R8e deterministic Spirit Lantern cutout PNG frames**, preserving body, 2 paper talismans, tassel and all 4 original flame poses (only flame_a visible by default). It writes `evidence.json` with original source and rig hashes. Its origin is clearly `LEGACY_VECTOR_ORA_TECHNICAL`, `paintedByAI:false`, `artisticReview:UNSCORED`. It proves **editable layered source tooling**, not the new artwork's appearance.

## Security and source invariants

- Archive max 24 MiB encoded, 64 MiB total uncompressed, at most 80 entries. Each layer max 4 MiB PNG, max 4,194,304 pixels, max 24 layers, PNG CRC verification. XML max 64 KiB, no arbitrary XML expressions/DTDs/entities; no filesystem reads based on untrusted archive names. No remote URL/proxy/provider calls inside parser.
- R9a's rights policy **remains export-blocked even when metadata claims COMMERCIAL_REVIEWED**; this phase has no authenticated rights verifier. Model operation self-report and PNG edit history are not independent provider provenance proof.
- ORA metadata here intentionally supports only flat normal `svg:src-over` layers, simple supported attributes, ASCII ID names and transparent 8-bit RGBA PNG. Reader refuses many valid exotic/nested ORA files and makes that limitation explicit; future compatibility expansion requires new test fixtures.
- ORA is an authoring/source interchange file, not automatically a rig, animation or Godot export. Flame pose alternatives are editable independent layers, not playable inside an image editor. Their actual playback still requires R9c export using the existing rig manifest.
- Synthetic compositing tests cannot judge artistic quality. Real independent art assessment and real AI model image output bytes are still pending for R9d/e.

## Reproduce actual edit-source artifact

```sh
npm ci --ignore-scripts
# ensure rsvg-convert is installed
node scripts/r9b-spirit-lantern-ora.mjs
```

CI artifact label: `r9b-spirit-lantern-editable-ORA-TECHNICAL`. Open `spirit-lantern-r8e-editable-TECHNICAL.ora` in an OpenRaster-compatible application. Inspect/modify individual part layers; re-export and verify against the conservative import subset.

## Handoff to R9c/d

R9c must build a **new raster atlas/Godot export adapter** that uses exact individual layered RGBA sources while preserving rig pivots, z-order, poses, animation and light response; do not pass raster into the vector Cutout compiler. R9d requires a **real authorized generation/edit provider** and source-provenanced local masked paint iterations. R9e requires same-scene gameplay A/B and eligible independent visual rating. The existing R8e visual still is the only game asset, not a completed R9 painterly redesign.

**Review status:** AI self-review only unless actual independent names and out-of-band attestations are provided; no production release.
