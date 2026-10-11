# POC-005C2 Provider-Attested Autonomous Artist Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a falsifiable, fail-closed offline provenance verifier for model-directed Game Artist MCP workflow evidence, determine whether the selected provider/host exposes authentic issuer-verifiable receipts, and conditionally perform one independent held-out pilot followed by three trials.

**Architecture:** An isolated `src/provenance/` module validates versioned challenge, host/provider events, image-delivery and Art IR revision bindings against an external verifier-controlled trust policy. The CLI never mints host/provider attestation and never treats a local MCP transcript, a tool `call_id`, or a CI artifact signature as model-origin proof; real host collection is strictly conditional on Stage 0 capability results.

**Tech Stack:** Node.js >=22, ES modules, `node:test`, `node:assert/strict`, `node:crypto`, `node:fs/promises`; reuse existing strict JSON/canonical hash/bounded no-follow IO from `src/evaluation/`; pinned `rsvg-convert version 2.58.0` for optional real-asset preflight; GitHub Actions Ubuntu 24.04. No new runtime dependencies unless a separately reviewed real attestation format requires one.

**Spec:** `docs/superpowers/specs/2026-10-09-poc005c2-provider-attested-autonomous-artist-design.md` (approved 2026-10-09; merged via PR #22, `main` `d98cfe048ab3c4e2d78ed303633b44aa60bd97f1`).

## Global Constraints

- **Approval boundary:** This is a PROPOSED implementation plan, not implementation approval. STOP for user review; obtain a separate execution-method approval (Subagent-driven if available, else Native with explicit SELF_REVIEW).
- **Stage 0 first:** inspect current official host/provider APIs and permitted local integrations for independently verifiable signed model tool decisions and image dispatch. If unavailable, publish `BLOCKED: PROVIDER_ATTESTATION_UNAVAILABLE`, do not invent a provider API. A host-attested research result is NOT strict provider GO.
- Preserve `src/core/`, `src/style/`, `src/export/`, `src/mcp/server.mjs`, existing POC-005A/C1 verdict boundaries and all old benchmark artifacts; do not mutate source art or alter `AGENT_PROVENANCE_PENDING` retroactively.
- Only deterministic art tools may produce geometry/pixels; no generated image/3D model, hardcoded polygon recipe or preauthored edit list counted as agent creativity.
- **Evidence schema v1** with strict allowlisted keys; duplicate-key rejection, canonical SHA-256 hashing over defined original bytes, bound paths, no-follow reads, atomic `0600` private writes, bounded UTF-8/JSON and secret redaction.
- Authentic evidence is private and collector-controlled **outside tracked repository**; public CI gets only synthetic fixtures, non-sensitive capability notes and sanitized reports. No CI upload of challenge plaintext, identities, model messages, tokens, host receipts or original raw signed events.
- Separate `technicalStatus`, `workflowStatus`, `provenanceStatus`, `visualStatus`. C2 NEVER derives human `VISUAL_GO`, `FULL_PASS`, or `PRODUCTION_READY`; C1 Issue #21 remains independent and REVIEW_PENDING.
- Real challenge: 1 pilot, then 3 original unfamiliar 2D prop briefs chosen/committed by an independent curator. Max **50 art MCP calls**, **5 correction rounds**, **15 elapsed minutes** per run. Require >=2 successful PNG renders and >=1 image-delivery → critique → edit → rerender chain on the same revision lineage. No cherry-picked outcomes.
- A locally generated hash chain, provider-like `call_id`, GitHub Sigstore build attestation, static fixtures or a self-declared host signer must never qualify as provider- or host-attested model authorship.
- No paid inference or external model procurement without owner authorization. No bypassing FolderForge sandbox guardrails or host permissions.
- New source changes, when separately approved, use RED→GREEN per task, scoped commits, exact-head push + PR CI, merge main, main CI, safe cleanup back to only main. Existing test suite must remain green.

## File Structure / API Ownership

| Task | Owns | Exact files |
| --- | --- | --- |
| 1 | Authentic capabilities and trust decision | `src/provenance/host-capabilities.mjs`, `scripts/poc005c2-capabilities.mjs`, `test/provenance-capabilities.test.mjs`, `benchmarks/poc005c2/README.md` |
| 2 | Strict contracts and frozen challenges | `src/provenance/contracts.mjs`, `test/provenance-contracts.test.mjs`, `test/fixtures/provenance-fixtures.mjs` |
| 3 | Trusted issuer/receipt validation | `src/provenance/trust-policy.mjs`, `src/provenance/attestation-verify.mjs`, `test/provenance-trust.test.mjs` |
| 4 | Tool/event/PNG causality audit | `src/provenance/event-audit.mjs`, `test/provenance-events.test.mjs` |
| 5 | Export checks and bounded workflow gate | `src/provenance/workflow-audit.mjs`, `test/provenance-workflow.test.mjs` |
| 6 | Redacted reports and strict offline CLI | `src/provenance/report.mjs`, `scripts/poc005c2-audit.mjs`, `test/provenance-cli.test.mjs` |
| 7 | CI/integration documentation and fail-closed rehearsal | `package.json`, `.github/workflows/ci.yml`, `.gitignore`, `benchmarks/poc005c2/README.md`, `test/provenance-integration.test.mjs` |
| 8 | Conditional real-host pilot and 3 held-out runs | Private operator workspace and custody; `benchmarks/poc005c2/README.md` operator guidance and an approved future host adapter **only if supported** |

**Cross-task named interfaces:** `assessHostCapabilities({documentedMechanisms,availableTools})`, `validateChallenge(raw)`, `validateInvocationEvent(raw)`, `validateExportEvidence(raw)`, `verifyAttestation({receipt,event,policy,capabilities})`, `auditEventChain({challenge,events})`, `auditArtWorkflow({challenge,events,exports})`, `buildProvenanceReport({challenge,capabilities,attestations,events,workflow})`, `redactProvenanceReport(report)`. Return an explicit structured failure rather than a fabricated verified receipt. All exports use `*.mjs`.

## Review Focus — five dangerous inputs with required owning tests

1. **Valid GitHub build attestation, invented model-origin receipt:** must never set `PROVIDER_ATTESTED` (Task 3).
2. **A copied signed event from another `nonce` / project SHA / challenge digest:** reject replay despite valid cryptographic signature (Task 3).
3. **PNG hash matches the tool result but the model never received image bytes:** remain `UNDETERMINED`, never `AGENT_AUTHORED` (Tasks 4–5).
4. **Duplicate JSON keys, symlinked evidence, oversized input, or secret-bearing trace:** fail closed and avoid echoing secret values (Tasks 2 and 6).
5. **Single success after multiple failures, scripted geometry, or partial 3-run quorum:** report all trials and refuse strict `PROVIDER_ATTESTED_AUTONOMY_GO` (Tasks 5–7).

---

### Task 1: Stage 0 host/provider capability gate — documentation and fail-closed executable report

**Files:**
- Create: `src/provenance/host-capabilities.mjs`
- Create: `scripts/poc005c2-capabilities.mjs`
- Test: `test/provenance-capabilities.test.mjs`
- Create: `benchmarks/poc005c2/README.md`

**Interfaces:**
- `assessHostCapabilities({documentedMechanisms,availableTools}): {providerReceiptSupported:boolean,hostReceiptSupported:boolean,imageDispatchObserved:boolean,strictProviderGate:'AVAILABLE'|'BLOCKED',reasons:string[],evidenceRefs:string[]}`.
- `documentedMechanisms` contains *only* operator-verified vendor/host documentation references; model-authored statements and arbitrary JSON flags are not proof. `availableTools` is an observed discovery set, not a signature.

- [ ] **Step 1: Write RED test** `rejects call_id, CI attestation, and self-signed local transcript as model attestation` in `test/provenance-capabilities.test.mjs`. Assert `strictProviderGate === 'BLOCKED'`, `providerReceiptSupported === false` for those three inputs; test a genuine supported mechanism only as a labeled `SYNTHETIC_TEST` contract fixture, never live proof.
- [ ] **Step 2: Verify RED.** Run `node --test test/provenance-capabilities.test.mjs`; expect missing-module or assertion failure.
- [ ] **Step 3: Implement minimal capability reporter.** Compile a source-linked host/provider matrix: available issuer, issuer independence, verifying party, receipt API/shape, nonce/session/model/tool binding, image delivery evidence, access/cost limits, and unsupported fields. Read public docs without inferring cryptographic functionality that is not documented. Prefer explicit `BLOCKED: PROVIDER_ATTESTATION_UNAVAILABLE` if any critical field is unsupported. References: official function-calling docs, MCP tool spec, GitHub artifact-attestation docs; URLs in README must be current and scoped.
- [ ] **Step 4: Verify GREEN and CLI.** `node --test test/provenance-capabilities.test.mjs`; `node scripts/poc005c2-capabilities.mjs` prints non-secret JSON with `strictProviderGate`. No API keys/network model invocation needed.
- [ ] **Step 5: Commit** `git add src/provenance/host-capabilities.mjs scripts/poc005c2-capabilities.mjs test/provenance-capabilities.test.mjs benchmarks/poc005c2/README.md && git commit -m "feat(provenance): fail closed on unsupported model attestations"`.

**Mandatory STOP checkpoint:** If provider-side verifiable receipt unavailable, record precise limitations and `PROVIDER_ATTESTATION_UNAVAILABLE`. Tasks 2–7 may build **offline verifier safety only** with clearly synthetic fixtures; Task 8 is BLOCKED and strict GO must remain impossible. Do not "satisfy" Stage 0 with an author-held signing key.

### Task 2: Versioned schemas, canonical hashes and immutable held-out challenge

**Files:**
- Create: `src/provenance/contracts.mjs`
- Create: `test/fixtures/provenance-fixtures.mjs` (explicit `evidenceKind:'SYNTHETIC_TEST'`)
- Test: `test/provenance-contracts.test.mjs`
- Reuse: `parseEvaluationJson`, `canonicalBytes`, `sha256Bytes` from `src/evaluation/contracts.mjs`, and `readBoundedFile` from `src/evaluation/safe-io.mjs` (no forked unsafe parser)

**Interfaces:** `validateChallenge(raw): ChallengeManifest`; `validateInvocationEvent(raw): InvocationEnvelope`; `validateExportEvidence(raw): ExportEvidence`; pure functions throw on malformed input.

- [ ] **Step 1: Write RED tests** `rejects unknown and duplicate keys, unsafe ids and stale session`, `rejects brief hash / timestamp / 128-bit nonce mismatches`, `rejects event producer and unsupported evidence types`. Use `assert.throws(()=>validateChallenge({...fixture,nonce:'x'}),/nonce/)`; check original prompt byte SHA-256 rather than normalized text.
- [ ] **Step 2: Verify RED:** `node --test test/provenance-contracts.test.mjs` fails on absent production module.
- [ ] **Step 3: Implement strict schema v1.** Challenge requires safe unique `sessionId`, random nonce >=128 bits (hex 32+), `challengeDigest`, UTC `challengeCommitmentAt`, exact 40-hex `projectSha`, `styleProfileId`, `mcpServerVersion`, `rendererVersion`, fixed allowlisted `allowedToolNames`, `policyDigest`, `timeBudgetSeconds <= 900`, `toolCallBudget <= 50`, `correctionBudget <= 5`, `challengeId`, `assetId`, `holdoutCustodianRef`, `hostIdentityPolicy`, `provenanceRequirement`. Event v1 enforces `sessionId`, nonce, challenge digest, producer, `eventKind`, `eventSequence`, model/host identifiers, `prevEventDigest` and event-specific tool/image fields. Export requires initial/revised pixel and SVG digests, final document/export revision, source SHA.
- [ ] **Step 4: Verify GREEN:** `node --test test/provenance-contracts.test.mjs` PASS; structural fixture not labeled verified. Strict JSON parser rejects duplicate fields before contract validation.
- [ ] **Step 5: Commit** `git add src/provenance/contracts.mjs test/provenance-contracts.test.mjs test/fixtures/provenance-fixtures.mjs && git commit -m "feat(provenance): add strict challenge and invocation contracts"`.

### Task 3: Independent trusted issuer policy and anti-replay attestation verifier

**Files:**
- Create: `src/provenance/trust-policy.mjs`
- Create: `src/provenance/attestation-verify.mjs`
- Test: `test/provenance-trust.test.mjs`

**Interfaces:**
- `validateTrustPolicy(policy): TrustPolicy` — issuer/key material must be supplied from *external verifier-owned* custody, not the model output; no private keys accepted.
- `verifyAttestation({receipt,event,policy,capabilities}): {verified:boolean,tier:'LOCAL_UNVERIFIED'|'HOST_ATTESTED'|'PROVIDER_ATTESTED',reason:string,issuerRef?:string}`.
- Trust policy pins issuer, supported receipt format, public verification root, expected event producer, `sessionId`, nonce, challenge digest, project SHA and model identity. Unknown issuer or absent independent custody => unverified.

- [ ] **Step 1: RED tests:** `refuses gitHub artifact signature as provider model origin`, `refuses author controlled/test signer in live tier`, `refuses cross-session nonce and challenge replay even if signature valid`, `refuses unsupported provider receipt without fabricating fallback`. A test-only key may sign synthetic fixtures only; assert `SYNTHETIC_TEST` never produces live GO.
- [ ] **Step 2: RED verification:** `node --test test/provenance-trust.test.mjs` fails.
- [ ] **Step 3: Minimal implementation:** use documented crypto verification format **only after Stage 0 confirms the actual public-key format and trust root**. If unsupported, implement an explicit `PROVIDER_ATTESTATION_UNAVAILABLE` rejection branch; do not invent arbitrary `signature` JSON claiming provider issuance. Host tier requires independently verified host and witness separation. Event binding is checked *after* signature validation.
- [ ] **Step 4: GREEN verification:** run dedicated test. Include one synthetic positive format-fixture exercise, with `evidenceKind:'SYNTHETIC_TEST'` and a result that still forbids live GO.
- [ ] **Step 5: Commit** `git add src/provenance/trust-policy.mjs src/provenance/attestation-verify.mjs test/provenance-trust.test.mjs && git commit -m "feat(provenance): verify issuer trust and block receipt replay"`.

### Task 4: Authentic event order and tool/image causality auditor

**Files:**
- Create: `src/provenance/event-audit.mjs`
- Test: `test/provenance-events.test.mjs`

**Interface:** `auditEventChain({challenge,events}): {ok:boolean,errors:string[],toolCalls:number,renderCount:number,imagesDelivered:number,correctionRounds:number,eventsDigest:string}`. No return field alleges model cognition.

- [ ] **Step 1: RED tests:** `requires challenge delivery before model decision`, `pairs tool decision, dispatch and tool result by exact toolCallId`, `requires model image-delivery evidence matching true MCP image bytes`, `rejects duplicated/reordered/missing event, swapped PNG and critique preceding image`.
- [ ] **Step 2: RED verification:** `node --test test/provenance-events.test.mjs` fails.
- [ ] **Step 3: Implement finite event state machine:** enforce increasing `eventSequence`, `eventDigest`/previous binding, single canonical session/nonce/challenge, valid `MODEL_TOOL_DECISION → TOOL_DISPATCH → TOOL_RESULT`, image PNG bytes digest and explicit `MODEL_IMAGE_DELIVERED` matching a prior real preview. Compute `eventDigest=SHA256('GameArtist/POC005C2/event/v1\\0' || canonicalBytes(event without eventDigest))` and bind each `prevEventDigest` to the prior event; the \\0 denotes one literal NUL separator byte, not a two-character backslash escape. Signed event authenticity is Task 3, not inferred from hash-chain. Reject orphan results and injected model text/tool messages that attempt to alter verifier policy.
- [ ] **Step 4: GREEN verification:** `node --test test/provenance-events.test.mjs` PASS. Diagnostics must use field names and offsets only, never secrets.
- [ ] **Step 5: Commit** `git add src/provenance/event-audit.mjs test/provenance-events.test.mjs && git commit -m "feat(provenance): audit model tool and image event causality"`.

### Task 5: Image-grounded correction, export lineage and resource-budget gate

**Files:**
- Create: `src/provenance/workflow-audit.mjs`
- Test: `test/provenance-workflow.test.mjs`

**Interface:** `auditArtWorkflow({challenge,events,exports}): {status:'AGENT_AUTHORED'|'WORKFLOW_NO_GO'|'UNDETERMINED',technicalStatus:'TECHNICAL_PASS'|'TECHNICAL_NO_GO'|'INCOMPLETE',reasons:string[],metrics:{toolCalls:number,renderCount:number,correctionRounds:number,elapsedMs:number}}`.

- [ ] **Step 1: RED tests:** `requires empty create then authored ops then first preview`, `requires image delivered before critique, edit, second preview`, `rejects export revision differing from final render`, `rejects scripted geometry source or reset of same asset`, `rejects over 50 tools, over 5 corrections or over 900s`, `keeps failed tool attempts in counts`, `rejects silent best-of-N selection`.
- [ ] **Step 2: RED verification:** `node --test test/provenance-workflow.test.mjs` fails.
- [ ] **Step 3: Implement pure deterministic workflow audit:** verify style profile → `asset_create` empty rev 0 → agent-chosen ops → preview PNG delivered → grounded diagnosis event → same-asset targeted edit → second preview → `validate_asset` + `style_validate` current revision → `export_asset` hashes. Enforce original/revised PNGs + SVG and document digests, zero prewritten operation-array/fixture provenance. A cryptographic receipt does not guarantee critique quality: if only semantic grounding is unresolved, return `UNDETERMINED`, not faux autonomy pass.
- [ ] **Step 4: GREEN verification:** `node --test test/provenance-workflow.test.mjs` PASS, synthetic fixtures cannot grant live provenance.
- [ ] **Step 5: Commit** `git add src/provenance/workflow-audit.mjs test/provenance-workflow.test.mjs && git commit -m "feat(provenance): gate image grounded asset workflow and budgets"`.

### Task 6: Tiered reports and read-only offline verifier CLI

**Files:**
- Create: `src/provenance/report.mjs`
- Create: `scripts/poc005c2-audit.mjs`
- Test: `test/provenance-cli.test.mjs`

**Interfaces:** `buildProvenanceReport({challenge,capabilities,attestations,events,workflow}): PrivateReport`; `redactProvenanceReport(report): PublicReport`; `aggregateProvenanceRuns({reports,expectedChallengeIds}): {strictProviderGo:boolean,reasons:string[],trialCount:number}`. The aggregator requires exactly three precommitted distinct challenge IDs and includes all attempted/failed runs; it refuses duplicate, missing, best-of-N and `SYNTHETIC_TEST` reports. CLI: `node scripts/poc005c2-audit.mjs --session <PRIVATE_SESSION_DIR> --policy <VERIFIER_OWNED_POLICY_JSON> --public-out <PRIVATE_REPORT_OUTPUT>`.

- [ ] **Step 1: RED tests:** invalid or missing signed provider receipt yields `provenanceStatus:'UNVERIFIED'` with explicit blocking reason `AGENT_PROVENANCE_PENDING`; a witness-verified host tier may produce `HOST_ATTESTED_AUTONOMY` only when trust policy independent; unknown provider yields `BLOCKED: PROVIDER_ATTESTATION_UNAVAILABLE`; leaking brief text/PII/auth header/tokens never appears in a redacted report; refuses symlinked private files and output under tracked repo.
- [ ] **Step 2: RED verification:** `node --test test/provenance-cli.test.mjs` fails.
- [ ] **Step 3: Implement offline CLI/report:** read bounded no-follow private inputs using already audited `src/evaluation/safe-io.mjs`; fail on schema mismatch, unsafe paths or secret-bearing envelopes without exposing their contents. Compute `technicalStatus`, `workflowStatus`, `provenanceStatus`, `visualStatus:VISUAL_REVIEW_PENDING` separately. Provider strict GO **only** if Task 3 establishes real provider-origin proof for all three genuine runs; synthetic test inputs, absent witness or missing human review can never produce `FULL_PASS` or `PRODUCTION_READY`.
- [ ] **Step 4: GREEN verification:** `node --test test/provenance-cli.test.mjs`; `node scripts/poc005c2-audit.mjs --help` documents inputs without opening external sessions; fixture CLI exits nonzero or explicit `BLOCKED` as appropriate.
- [ ] **Step 5: Commit** `git add src/provenance/report.mjs scripts/poc005c2-audit.mjs test/provenance-cli.test.mjs && git commit -m "feat(provenance): expose fail closed offline reports"`.

### Task 7: Complete synthetic rehearsal, CI restrictions and operator runbook

**Files:**
- Modify: `package.json` (append `poc:005c2:capabilities`, `poc:005c2:audit:dry` scripts only after their commands exist)
- Modify: `.github/workflows/ci.yml` (offline verification step, zero external model invocation and no private artifacts)
- Modify: `.gitignore` (explicit `benchmarks/poc005c2/generated/` plus private session paths)
- Modify: `benchmarks/poc005c2/README.md`
- Test: `test/provenance-integration.test.mjs`

**Interface:** `npm run poc:005c2:audit:dry` creates a synthetic, marked test bundle under ignored generated root, checks structural gates, prints `technicalStatus:TECHNICAL_PASS / provenanceStatus:UNVERIFIED (AGENT_PROVENANCE_PENDING) / visualStatus:VISUAL_REVIEW_PENDING` and **never** issues live autonomy GO.

- [ ] **Step 1: RED tests:** `CI never passes provider credentials to model calls`, `synthetic bundle is never eligible for strict autonomy GO`, `three-run aggregation fails with missing/partial/sorted-best runs`, `no private receipts, hidden briefs, keys or attestations uploaded by glob`.
- [ ] **Step 2: RED verification:** `node --test test/provenance-integration.test.mjs` fails.
- [ ] **Step 3: Add scripts, CI checks and README.** README contains curator/operator role split, immutable challenge pre-commit, trusted custody, artifact hashing, downgrade prevention, PILOT→THREE gate, controlled sources, explicit `BLOCKED` report examples, no-shipping production labels. Never call paid APIs in CI.
- [ ] **Step 4: GREEN + full verification:** `node --test test/provenance-integration.test.mjs`; `npm run poc:005c2:capabilities`; `npm run poc:005c2:audit:dry`; `npm run check`; `npm run poc:005c1:dry`. Confirm 0 fake human scores, no agent provider proofs created in fixtures, no private artifacts tracked. Run exact-head push + PR CI only after next user-approved execution step.
- [ ] **Step 5: Commit** `git add package.json .github/workflows/ci.yml .gitignore benchmarks/poc005c2/README.md test/provenance-integration.test.mjs && git commit -m "test(provenance): wire offline CI and evidence-safe operator flow"`.

### Task 8: CONDITIONAL genuine host pilot and three held-out attempts (no synthetic substitution)

**Files:** No automatic product source edits. Private operator-owned evidence directory **outside repository**, existing `scripts/poc005c2-audit.mjs`; publish only redacted outcome in `benchmarks/poc005c2/README.md` after review.

**Interfaces:** Authenticated provider/host receipts and independent witness evidence in the strict Task 2 contract; real agent uses existing tool names from `src/mcp/server.mjs`. **Do not create an adapter from guesses**. If a real supported provider interface needs code, stop and request a narrowly scoped approved adapter design/plan update before modifying a host.

- [ ] **Step 1: Preconditions.** Independent curator, access and allowed model-host controls confirmed; verifiable provider/host receipt and trust root independently observed; public API docs matched; human explicitly authorized any cost. If absent: record `BLOCKED: PROVIDER_ATTESTATION_UNAVAILABLE`, skip remaining live steps.
- [ ] **Step 2: Pilot challenge.** Independently choose original 2D prop not used in prior POCs; commit unseen brief hash/nonce/policy before revelation; deliver brief **without operation arrays**; capture all real MCP dispatch, image delivery, response receipts and rejected calls under witness custody.
- [ ] **Step 3: Pilot verification.** Run offline auditor against private true receipts and exact PNG bytes. A host-origin receipt alone yields only host tier; provider proof is a separate independent validation step. Human/art semantically grounded criticism may be reviewed, but **does not count as POC-005C1 rating**.
- [ ] **Step 4: Three trials.** Only after pilot checks: commit three distinct held-out briefs in advance; run all once under frozen budgets; include every failed run; compute strict C2 GO only with 3/3 provider-attested technically valid, image-grounded flows and no tamper; otherwise classify HONEST BLOCKED/NO_GO.
- [ ] **Step 5: Closeout evidence.** Publish sanitized counts, digests, exact host/source identities, method limitations, redacted verdicts. Keep raw transcripts, prompts, contact records, signer roots/receipts private. Do not call `FULL_PASS`, `PRODUCTION_READY`, or retroactively update C1 without separate human evaluation.

## Self-review and handoff gates

- Confirm spec §§1–12 maps to Tasks 1–8: purpose (1), role/trust separation (1–3), strict contracts (2), signed evidence (3), event/image chain (4), workflow (5), report (6), negative controls (1–7), security (2/3/6/7), operational pilot (8), stop rules (all).
- Check every named interface exactly matches earlier task ownership; no imported method defined only in an example. Test fixtures always carry `SYNTHETIC_TEST`. Five Review Focus classes have named regression tests.
- Review the plan length and scope; no general hosted agent product, paid runtime, AI artwork generator, Godot/3D exporter or C1 reviewer automation.
- **Status at handoff:** WRITTEN PLAN PROPOSED. This document and green baseline CI authorize NO product implementation or live external benchmark. Request separate user approval of the *written plan* and an execution method.
