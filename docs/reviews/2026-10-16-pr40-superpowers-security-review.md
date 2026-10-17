# PR #40 — Superpowers Code + Security self-review (2026-10-16)

**Scope:** `roronoazoroshao/game-artist-mcp`, from `main@365291470cb33eefffe763cda6b01669980c540f` to R9b branch. Original reviewed code `57511d16ee970bacc1f0b293278c5c01f7c27911`; TDD remediation `554dc2e30f5d5f722ee1e202b67c8e81e38cc56e`; documentation-only follow-up is rechecked by new exact-head CI.

**Review class:** author-performed static code/security review with actual GitHub Actions TDD. *NOT* independent review. GitHub pull request reviews endpoint returned an empty array on 2026-10-16; `INDEPENDENT_SECURITY_REVIEW_PENDING`.

## Trust boundaries inspected

- Core: `src/ai-art/ora-zip.mjs`, `openraster.mjs`, `ora-stack.mjs`, `layered-source.mjs`, `layered-project.mjs`, `edge-qa.mjs`, `layer-composite.mjs`.
- Test+process: `test/r9b-*.test.mjs`, `scripts/r9b-editor-interop-verify.py`, `.github/workflows/r9b-krita-interop.yml` and repo `ci.yml`.
- Archive path allowlist, ZIP size/decompression limits and CRC, XML DTD/entities, nested groups/opacity, source+mask binding, accepted provenance hash chain, read-only CI token, no direct filesystem extraction or untrusted URL execution, privacy-safe logs and rights fail-close.

## Findings

### P1 — semantic re-signing/rig-group owner confusion [FIXED]

**Reachability:** Rebuild a valid ORA with a flame paint leaf moved into the neighboring `rig_body` group while preserving flattened layer order, all exact original PNG bytes, and recomputed `manifest.oraSha256`. Previous `verifyLayeredProject` accepted this as valid because it compared only flattened layer order/PNG SHA and not nested owner groups. A consumer expecting per-part editing would silently rely on the wrong group.

**Proof:** [RED #38914015556](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38914015556), new `test/r9b-layered-project.test.mjs` negative fixture. **Correction:** `verifyLayeredProject` requires contiguous single-part group membership, group identity/opacity/visibility/isolation and writer-consistent collision suffixes. [GREEN exact-head #38914243286](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38914243286).

### P1 — hidden flame alternative / manifest z-order semantic mismatch [FIXED]

**Reachability:** Rebuild ORA and sidecar hash with `flame_b` visible instead of remaining an editable hidden alternate, or permute manifest `order` without moving actual ORA layers. The previous verifier did not check canonical flame preview state or strictly increasing manifest order.

**Correction:** Reject non-`flame_a` visibility (including base flame), and reject nonascending or duplicate manifest z-order. Multiple negative tests in same TDD RED/GREEN cycle. This is a semantic integrity gate, *not* cryptographic proof of artwork provenance or commercial license.

### P2 — Krita editor metadata/fidelity [DOCUMENTED / CONSTRAINED]

- Real Krita 5.2.2 open/export/reopen passed with 3 layer RGBA buffers, groups and offsets preserved. Dedicated CI had actual pass on push and PR.
- Source merged preview and Krita exported merged preview differ on **162 pixels, max 1 channel unit**, due to 0.75→0.74902 opacity quantization. Krita's saved ORA preview and reopened PNG do match exactly.
- Guarded `krita_5_2` profile explicitly returns `BOUNDED_1LSB_NOT_PIXEL_EXACT`, `releasePixelsExactGate=false` in external verifier. Universal ORA/GIMP native masks not claimed.
- The core importer permits a bounded one-LSB preview mismatch only in this explicitly selected mode, not for default strict mode.

### P2 — residual review and ownership limitations [OPEN, RELEASE BLOCKER]

- SHA digest consistency and accepted operation records are **not independently authenticated model provider provenance or commercial license**. `exportAllowed:false` remains enforced in evidence.
- The `src/ai-art` validators reject unsafe ZIP/XML inputs by unit tests, but this self-review is not a third-party pen test or universal parser fuzz campaign. `SECURITY_INDEPENDENT_REVIEW_PENDING`.
- No newly model-painted master pixels, editor native masks, real artist rating, full cross-editor matrix or R9c gameplay animated seam review from R9b itself. `ART_UNSCORED`, `RIGHTS_BLOCKED`, `RELEASE_BLOCKED`.
- CI workflow uses bounded token permissions (`contents: read`, and no write credential for Krita workflow), `npm ci --ignore-scripts`, GitHub artifact uploads and pinned dependencies. Repo-wide `npm audit --omit=dev` is exercised in full CI, but it does not substitute a full supply-chain assessment.

## Acceptance / merge gate

- [x] Author-reviewed 17-file scope, exact PR head, critical trust boundaries and real GIMP/Krita limitations.
- [x] Found actual P1 semantic integrity paths and wrote fail-first negative tests, then patched.
- [x] Full PR CI + actual Krita external editor GREEN at remediation HEAD.
- [ ] **Fresh exact-head CI** after documentation-only update.
- [ ] **Qualified independent reviewer** with GitHub identity and applicable exact-head APPROVE, if required by project policy.
- [ ] Authoritative branch protection/ruleset and required-status checks verification before merge.
- [ ] Owner-authorized final merge, post-merge main CI and safe branch cleanup.

**Current advisory verdict:** `AUTHOR_CODE_REVIEW_FIXES_VERIFIED` / `TECHNICAL_CONDITIONAL_GO`; **merge still BLOCKED** until remaining review/policy evidence is satisfied. This record must not be misrepresented as an independent approval.
