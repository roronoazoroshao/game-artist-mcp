# R9d — Authenticated AI-Painted Spirit Lantern Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development where available), TDD RED → GREEN, exact-HEAD verification, independent security and artist review. Do NOT bypass release gates to show progress.

**Goal:** Replace the legacy R8e vector-derived source art with genuine, editable, professionally reviewed, newly model-painted raster artwork while retaining the canonical Spirit Lantern rig.

**Architecture:** Author an original concept via an allowed provider (the owner-selected Adobe Firefly), then independently paint the five canonical rig parts and four flame poses as separated, alpha-masked PNG layers aligned to an immutable 1024×1280 canvas. Retain authenticated original provider outputs, accepted/rejected operation records and original editable masks. Feed these immutable bytes into existing R9a/R9b source integrity checks and the opt-in R9c raster frame provider; never silently call flattened concept JPEG a rig-ready image.

**Tech Stack:** Adobe Firefly tools, Node 22, R9a/R9b contracts and OpenRaster, R9c raster frames, actual Krita interop, pinned Godot 4.7.2. All image edits through the authorized Adobe image tools; deterministic validators/compositing through the repository tools.

**Spec:** `docs/superpowers/specs/2026-10-16-r9-ai-assisted-layered-art-production-design.md`.

## Recorded checkpoint — genuine pixels, NOT completed source
- Real **Adobe Firefly** image generation executed with provider request `eb52e735-6625-414e-bb83-bc47bb83cef7`, requested PNG 1344×1728, seed 20261016. Provider returned success and output short URL. Repo commit contains a **JPEG preview rendition** from the Adobe preview API, not the unrecovered original provider PNG. This is **new model-generated imagery**, not R8e source art, and is clearly labeled `ORIGINAL_AI_PAINTED_CONCEPT_RENDITION_ONLY`.
- The concept is **flattened on gray** and does not satisfy per-part opacity, editable layers, rig pivots, native masks, 4 independent flame frames, commercial-rights attestation or independent artistic review.
- `artisticReview=UNSCORED`, `rightsStatus=RIGHTS_UNVERIFIED`, `exportAllowed=false`, `godotIntegrationAllowed=false`. PR is experimental/staged, dependent on R9c and R9b merge gates.

## Work items
### Task 1 — Immutable concept evidence + source recovery
- [ ] RED: fail closed if a source artifact is missing, mixed up with R8e, non-JPEG/non-PNG, altered, claims painted rig without layers, or claims release rights without verified policy.
- [ ] GREEN: verify image bytes and provider request metadata separately; capture exact dimensions/SHA256 via independent decoder; retain original short URL and explicit unknown original PNG SHA.
- [ ] Retrieve full unmodified Firefly PNG through authorized Adobe tool/session, preserve **actual** source bytes with provider request ID and SHA256; never relabel a JPEG preview as the original.

### Task 2 — Actual masked per-part painting
- [ ] For `body`, `talisman_left`, `talisman_right`, `tassel`, `flame`: generate/edit genuinely new source content **individually** using Adobe image tools with explicit masks and underlap, not deterministic vector repaint or a fake split of one opaque image.
- [ ] Author four truly distinct animated flame poses in the same original style.
- [ ] Validate all 9 layer sources/masks at 1024×1280 with immutable SHA hashes, authoring operations, rig owner bindings and R9a provenance; keep unmodified original.
- [ ] Build real editable ORA; prove Krita import/export/reimport, characterize opacity deltas and mask sidecar persistence.

### Task 3 — Godot and qualitative acceptance
- [ ] Render the R9d painted layers through the isolated R9c raster-to-Godot provider; animated 2s idle, 4 actual poses, pivot/z-order/light response, no legacy cutout paint fallback.
- [ ] Actual Godot 512×512 / 128×128 / 64×64 gameplay A/B against R8e, blinded packet and independent qualified visual critic.
- [ ] Verify authenticated provider commercial policy/right scope, submit an independent GitHub review on exact approved HEAD, keep production release blocked until complete.

## Risks and rollback
- Firefly output is stochastic; seed is a request parameter, not a reproducible source checksum. Preserve actual model output bytes and references.
- Provider model version and commercial license status are **unknown**, and must not be guessed. Original Firefly PNG source has not yet been retrieved; local repository contains a decoded JPEG preview copy, clearly named `rendition`.
- Do not use pixel similarity to assume commercial originality/rights. No edit operation may cross a rig part ownership boundary or silently replace a user-approved image.
- Rollback: close the experimental R9d PR / revert its commits without changing `main`, PR40 or PR41; no production deployment. Repo remains opt-in.
