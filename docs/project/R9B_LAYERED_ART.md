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


## R9b approved production-gap closure — opt-in additions (2026-10-16)

This section describes the additive interfaces shipped on the **R9b closure feature branch**. Prior R9b historical 256×320 technical ORA and legacy cutout programs are not changed; do not confuse this new source envelope with the original demo art.

- `validateLayeredSource({brief,pkg,layerPngs,maskPngs,operations,rigManifestSha256})` in `src/ai-art/layered-source.mjs`: in-memory immutable-source boundary; requires all five rig parts, four flame poses, verified R9a SHA fields, accepted hash-chain operations and every canonical `masks/<layerId>.png` byte. Source PNGs and independent masks are CRC-validated, their actual dimensions checked, and the combined decoded-memory budget capped. The return object is branded in-process to prevent accepting a forged `ok:true` object as a validated source. Its PNG Buffer copies are nevertheless mutable, so the writer **rehashes every buffer before use**.
- `writeLayeredProject(source,{placements: Map})` in `src/ai-art/layered-project.mjs`: true **1024×1280 ORA canvas**, with explicit integer bounded offsets for each original cropped material layer. Sources retain original unmasked `layerPngs` and `maskPngs` separately; ORA includes alpha-masked editable painting PNGs. A deterministic `manifestJson` and `operationsJson` accompany the ORA. The writer groups consecutive paint layers belonging to the same rig part into nested OpenRaster stacks; if another part interrupts that sequence, the part gets another group to **preserve top-first order** (rather than reorder the artwork). Only `flame_a` is visible in the composite; all four poses remain separately editable.
- `verifyLayeredProject(files)`: rejects missing/tampered originals, masks, archive, manifest and operation log; reimports ORA and checks decoded pixels, source/mask hash, ownership, positions, visibility and complete rig/pose coverage. Its output always says `exportAllowed:false`, `artisticReview:'UNSCORED'`.
- `src/ai-art/ora-stack.mjs`: a bounded typed stack tree for OpenRaster v0.0.6, with **only** isolated normal `svg:src-over` groups, maximum nesting 4, no DTD/entities/unsafe XML. Group opacity is applied once **after** composing its children, and hidden groups do not render. Group import/export is not a universal ORA implementation: `isolation=auto`, alternative blends, editor-specific XML, native mask semantics and many otherwise-valid OpenRaster extensions are rejected, not silently flattened.
- `analyzeLayerEdges({width,height,layers,ownerMasks})` in `src/ai-art/edge-qa.mjs`: deterministic technical check for alpha escaping the rig-owner mask (`INVALID`), suspicious RGB in transparent neighboring pixels (`WARN`), and visible alpha touching the canvas border (`WARN`). Soft emissive alpha can remain legitimate; warnings do **not** imply artistic rejection. This is **static QA only**, not the rotated rig/pivot animation seam test of R9c.

### Format, authorship and availability boundaries

`1024×1280` refers to the target **master canvas** in the validated input pipeline. Passing a small fixture PNG on that canvas does **not** prove a professionally painted 1024×1280 Spirit Lantern was produced. The R9b tests generate synthetic fixture pixels, not model-created concept/material painting. The existing downloadable R9b ORA remains the old 256×320 `LEGACY_VECTOR_ORA_TECHNICAL` sample. No independently authenticated provider origin or rights clearance is produced by SHA256 checks or a self-described provenance log.

The OpenRaster baseline supports nested stacks; it does not supply a universal native layer-mask interchange contract. This project retains masks as separately editable PNG files with SHA-bound source manifest, **not** as a claim that GIMP/Krita round-trip native masks. Real GUI editor load/edit/resave interoperability is `EDITOR_INTEROP_UNVERIFIED` until a documented external application test. Do not label successful internal parser round-trips as proof that all valid ORA documents or other editors can re-open them.

**Remaining release gates:** R9c actual raster atlas/pivot/2-second Godot animation and dynamic seam checks; R9d authorized provider painting and genuine model revision bytes; R9e 512/128/64 same-camera A/B, qualified independent artistic review, authenticated rights attestation and production release approval. Continue reporting `ART_UNSCORED` / `RIGHTS_BLOCKED` even if PR CI passes.

**Security note:** No network or path-based filesystem extraction is performed by these new core APIs. The companion original-PNG/mask Maps are in memory; loading arbitrary user-provided directory trees or ORA files into them requires a separate safe file staging/resolver, not implemented here. CLI users must not bypass this boundary with unchecked `fs.readFile` paths from untrusted manifests.
