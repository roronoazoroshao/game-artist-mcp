# R9a Secure Raster Intake — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Isolated, fail-closed AI PNG intake with provenance and rights metadata, without modifying legacy deterministic Godot/cutout functions.
**Architecture:** New import-first pure ESM modules in `src/ai-art/`; PNG decoding via existing pinned pngjs; hash-binding through built-in SHA256. R9b will consume validated layers. Do not add provider calls or untrusted filesystem writes.
**Tech Stack:** Node 22, pngjs 7.0.0, Node test, GitHub Actions existing full test/Godot.
**Spec:** `docs/superpowers/specs/2026-10-16-r9-ai-assisted-layered-art-production-design.md`.

## Global Constraints
- Legacy `src/core/`, `src/cutout/`, `src/export/`, MCP server, and existing art/CI benchmarks remain unchanged.
- Strict PNG RGBA non-interlaced 8-bit, encoded max 4MiB, decoded pixels max 4194304 (16MiB), canvas max 4096×4096, CRC verified; rejection before memory-heavy decode.
- AI raster layers named `layers/<safe_slug>.png`, never absolute/backslash/dot segments/URLs; no filesystem reads based on manifest path without a trusted staging root.
- `RIGHTS_UNVERIFIED` accepted for metadata staging but blocked for export. No semantic claims of commercial rights if the provided declarations are unauthenticated.
- Event hash chain is tamper-evident only when its head SHA is externally protected. It does not prove model-provider authorship or rights.
- No release/ART_GO based on CI, no AI art generation in this stage. Preserve main-only after safe merge.

## Review Focus
1. Malformed and forged/truncated CRC PNG rejected before allocation (Task 1).
2. Width/height exceeding memory budget rejected even if compressed tiny (Task 1).
3. Traversal/URL/duplicate layer paths, fake hashes and owner conflicts rejected (Task 2).
4. Event tampering/reordering/missing event and duplicate ID rejected (Task 3).
5. Unverified rights never yields exportAllowed=true (Tasks 2–3).

### Task 1 — Bounded PNG verifier

**Files:** create `src/ai-art/png-intake.mjs`, `test/r9a-png-intake.test.mjs`.
**Interfaces:** `inspectAiPng(bytes:Buffer) -> {width,height,sourceSha256}`; throws `AI_PNG_REJECTED`.
- [ ] Write test first: accept valid 2×2 RGBA, correct hash/dimensions; reject truncated signature/IHDR, invalid CRC, wrong bit depth/color/interlace, encoded >4MiB, dimensions >4096 or decoded >16MiB.
- [ ] Commit test; run `npm test` via branch CI and confirm RED means missing validator, not typo.
- [ ] Implement checked PNG signature/IHDR/decode and sha; no network or file reads.
- [ ] Run branch CI and confirm GREEN; commit source.

### Task 2 — Strict art package and rights schemas

**Files:** create `src/ai-art/contracts.mjs`, `test/r9a-contracts.test.mjs`.
**Interfaces:** `validateArtBrief(brief)`, `validateRasterPackage(pkg)`, `assertSafeLayerPath(path)`, `assertRasterExportable(pkg)`; throw `R9A_INVALID_*`.
- [ ] Test first: exact v1 ID/hash/rights/role allowlists; reject unexpected fields and duplicate paths/layers; preserve 5 Spirit Lantern rig parts, four flame poses, existing pivots external; 1024×1280 source and 256×320 runtime sample.
- [ ] Verify RED branch CI due to missing validators.
- [ ] Implement schema/data validation only, refuse export when rights not verified; ensure fail-closed unknown statuses.
- [ ] Verify GREEN and regressions, commit.

### Task 3 — Hash-chained model operations and staged import

**Files:** create `src/ai-art/provenance.mjs`, `src/ai-art/intake.mjs`, `test/r9a-provenance.test.mjs`, `test/r9a-intake.test.mjs`, `docs/project/R9A_SECURE_INTAKE.md`.
**Interfaces:**
- `makeProvenanceEvent(event,prevSha256=null)`; `verifyProvenanceEvents(events)` hash canonical event excluding `eventSha256` and require chain continuity.
- `validateAiRasterIntake({brief,pkg,layers,operations})`: accepts Map<safePath, Buffer>, checks every PNG SHA/dimensions/part, operations digest, returns `{ok:true,status:'INTAKE_VERIFIED'|'INTAKE_VERIFIED_RIGHTS_PENDING',exportAllowed:boolean}`.
- [ ] Test first: valid event/chain, tampered/reordered/missing events, duplicate event ID; valid staged set, missing/wrong/extra layer data, ownership mismatches, rights pending blocks export.
- [ ] Run RED branch CI and inspect expected failure.
- [ ] Implement smallest pure validators and deterministic canonical JSON SHA256; no untrusted disk reads or provider calls.
- [ ] Run GREEN full CI, Godot, FolderForge, MCP smoke and negative tests; record hard boundaries in docs.
- [ ] Commit.

### Task 4 — Review, merge, post-merge evidence

**Files:** GitHub PR/Issue #36 updates; no legacy code changes.
- [ ] Inspect branch diff and security/rights failures; self-review is COMMENT not independent APPROVE.
- [ ] Open PR at exact branch HEAD; pass exact-HEAD PR CI; fix regression with TDD before merge.
- [ ] Owner requested automatic Native integration; merge only when no unresolved P0/P1 and current main base/HEAD unchanged; do not release or claim art-ready.
- [ ] Check post-merge main push CI and cleanup workflow, verify only `main`; document evidence and R9b handoff.

**R9a DONE means only secure intake verified.** No actual AI paint, ORA composition, Godot raster adapter or production-quality visual grade is claimed here.
