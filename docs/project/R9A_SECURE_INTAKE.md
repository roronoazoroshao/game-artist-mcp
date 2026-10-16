# R9a — Secure raster intake (import-first; not an image-generation engine)

**Status:** Technical foundation on `feat/r9a-secure-raster-intake`. Exact CI / merge evidence is recorded in PR and Issue #36, not assumed in this document. Approved R9 [spec](../superpowers/specs/2026-10-16-r9-ai-assisted-layered-art-production-design.md) and [plan](../superpowers/plans/2026-10-16-r9a-secure-raster-intake.md).

## Public, pure functions

- `src/ai-art/png-intake.mjs`: `inspectAiPng(bytes)` accepts only bounded, non-interlaced 8-bit RGBA PNG with CRC checked; returns immutable dimensions and SHA256. Rejects encoded bytes > 4MiB, pixels > 4,194,304 or dimensions >4096. PNGs are *never* URLs.
- `src/ai-art/contracts.mjs`: `validateArtBrief(brief)`, `validateRasterPackage(pkg)`, `assertSafeLayerPath(path)`, `assertRasterExportable(pkg)`. Strict schema for the *first* Spirit Lantern vertical slice (5 rig part IDs; 4 flame pose IDs; source master 1024x1280 and runtime 256x320). `assertRasterExportable` **deliberately rejects all caller-supplied reviewed-rights declarations** until an independently authenticated rights workflow is implemented.
- `src/ai-art/provenance.mjs`: `makeProvenanceEvent(event,prevSha256)`, `verifyProvenanceEvents(events)`, `digestProvenanceEvents(events)`. Hash-chained operation log metadata records provider/model, prompt hash, optional input/mask hashes, accepted/rejected edit decision, exact output SHA256 and owning part. Chain validity is *tamper-evident only if a separately protected head hash exists*: the caller can fabricate a self-consistent chain; this is **not** provider provenance attestation.
- `src/ai-art/intake.mjs`: `validateAiRasterIntake({brief,pkg,layers,operations})` validates a `Map<layerPath, Buffer>` from a **trusted host staging resolver**, not raw filesystem paths. Checks every declared part and pose, PNG bytes/dimensions/hash, operation audit hash, allowed provider and accepted lineage. The result always sets `exportAllowed:false` in R9a, with statuses `INTAKE_VERIFIED_RIGHTS_PENDING` and `INTAKE_VERIFIED_REVIEW_DECLARED`.

## Strict boundaries and deliberate exclusions

- No AI provider is invoked by this module, no prompts submitted, no creative painting performed, no actual source ORA written and **no production Godot raster cutout** exported yet. Those are future R9b–d. Fixture images in tests are synthetic PNGs, **not actual image-model output**.
- All input images/metadata are untrusted; no arbitrary OS paths, archives, network fetches, symlink traversals or XML are opened/parsed by these pure functions. R9b's host resolver and ORA ZIP parser must implement sandboxed file-system/link/archive checks separately.
- Mask digests are captured by operation log, but per-layer `maskSha256` referencing an external mask is **not yet importable** without its own verified mask bytes. R9a explicitly rejects such layers at staging to avoid a false verified claim.
- AI operations are descriptive self-supplied audit records. A self-consistent digest is not independent source authentication, rights verification, an AI-generated image, or human visual approval.
- `COMMERCIAL_REVIEWED` only records a declaration and reviewer/evidence identifiers, not a trust decision. No export is unlocked until a later separately authenticated rights gate. `RIGHTS_UNVERIFIED` is always blocked.
- R9a does not register new MCP tools, mutate the v2 ArtDocument/Cutout schema, change legacy `export_godot_cutout`, add a new npm dependency or alter existing Godot demonstration files.
- Technical Node and Godot CI cannot score art. The original Spirit Lantern remains at R8e quality; R9 visual quality is **UNSCORED/UNSTARTED** until real AI-authored sources exist.

## Next phases

R9b: secure ORA ZIP import and layer compositor with pixel-accurate round-trip and opacity ordering.  
R9c: bound raster layers to deterministic atlas/pivots and Godot 4 runtime using a separate adapter.  
R9d: real authorized model image outputs, provider terms/permissions, per-part masked edit loop and immutable image data.  
R9e: frozen R8e-vs-R9 Godot A/B and eligible independent visual review; exact-HEAD CI; technical merge/branch cleanup only after gates pass.

**Roll-back:** This module is opt-in and imported nowhere by legacy runtime. If an R9a bug is discovered, revert its commits without changing legacy output files or asset IDs.
