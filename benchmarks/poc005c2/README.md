# POC-005C2 — Provider-attested autonomous artist benchmark

## Stage 0: observed capability gate (2026-10-11)

**Result: `BLOCKED: PROVIDER_ATTESTATION_UNAVAILABLE`.** No model-provider-issued, independently verifiable signed receipt for an individual model tool decision, bound to held-out challenge nonce, source revision and delivered PNG bytes, was documented or made available through the connected host/tool surface. No model API invocation or paid operation was made.

| Mechanism | Issuer / verifier | What can be verified | Missing model-decision provenance |
| --- | --- | --- | --- |
| [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling) | API returns `call_id`; caller joins output | Structured tool-call correlation | No documented independent signing root, challenge/nonce signature or verified PNG delivery receipt |
| [Anthropic tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works) | API returns `tool_use`; client executes tools | Tool-use block / returned result | No documented independent signed model-decision receipt nor attested image-delivery binding |
| [MCP tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools) | Host and tool server | Protocol message format, including images | No inherent model issuer cryptographic identity or provider signature |
| [GitHub artifact attestations](https://docs.github.com/en/actions/concepts/security/artifact-attestations) | GitHub Actions OIDC / Sigstore; artifact verifier | Workflow-built artifact, repository and commit | Does not authenticate model decision, nonce, tool invocation or PNG reception |
| Locally held transcript / self-signed JSON | Author / author-held keys | Local hashes only | Independent custody and signature absent |

**Cost/access:** no paid inference was authorized or performed; public documentation review only. Unknown availability is explicitly not capability. The current offline CLI cannot mint provider receipts or infer image reception from `render_preview`, list of tools or image hashes alone.

Run `node scripts/poc005c2-capabilities.mjs`: emits a bounded, non-secret JSON report. This status may only change after a separately reviewed real provider/host receipt specification, third-party trust-root verification, and observed image dispatch. An operator flag, fixture, self-signed envelope or CI attestation is not a valid upgrade.

Tasks 2–7 are authorized for **offline synthetic/adversarial testing only**, not a substitute for a provider-attested pilot. Task 8 remains blocked pending genuinely verifiable provider receipts, independently curated unseen brief, and explicit approval of any API charges. Issue #21's two-person independent blind artistic review is a different, still-unmet gate. No `PROVIDER_ATTESTED_AUTONOMY_GO`, `VISUAL_GO`, `FULL_PASS` or `PRODUCTION_READY` is warranted by this assessment.

## Operator runbook — offline-only implementation

**Roles:** Independent curator privately precommits the original brief bytes hash, fresh 128-bit-or-greater nonce, expected Git SHA and policy digest before revealing the brief. Host operator executes any future genuine session. An independent verifier, not the model author or host, controls trusted issuer roots, challenge escrow and audit policies. Private receipts, identifiers, prompt text, tokens, headers, contact records, and exact signed events stay **outside the repository**. No identity-bearing artifacts are published in GitHub Actions.

**Frozen protocol:** A pilot requires one genuinely unfamiliar original 2D prop; only after separately supported provider/host receipts and owner permission may three distinct independently committed held-out briefs run. Each attempt is frozen before execution, capped at 50 MCP calls, 5 corrections and 900 seconds. Retain all attempted trials (including failures); no best-of-N selection or cherry-picking. A hash chain, tool call ID, recorded PNG digest or CI attestation alone is not authorship proof. The live pilot is BLOCKED by Stage 0, and no provider adapter exists yet.

**Offline tools:**
- `npm run poc:005c2:capabilities` reports observed negative capabilities without sending requests.
- `npm run poc:005c2:audit:dry` creates an ignored synthetic evidence report under `benchmarks/poc005c2/generated/`; it checks deterministic contracts only.
- `node scripts/poc005c2-audit.mjs --help` documents the read-only verifier.
- `node scripts/poc005c2-audit.mjs --session <PRIVATE_SESSION_DIR> --policy <SEPARATE_VERIFIER_OWNED_POLICY_JSON> --public-out <PRIVATE_OUTPUT>` reads bounded `challenge.json`, `events.json` and `exports.json`. Session and report paths must be outside the tracked repository; trust policy must be outside the evidence session and repository, with signer roots beyond the model's control. Unknown or unverifiable attestations remain UNVERIFIED. Do not pass secrets to CI.

**Evidence classification:** Synthetic dry-runs may produce `TECHNICAL_PASS` together with `UNDETERMINED / UNVERIFIED / VISUAL_REVIEW_PENDING`. The offline implementation has no actual independent provider-verification adapter; `PROVIDER_ATTESTATION_UNAVAILABLE` remains the mandatory blocked reason. Host-attested and provider-attested research require distinct externally verifiable trust roots. The separate C1 Issue #21 still requires two real independent non-author humans; do not claim their review happened. Never emit `FULL_PASS`, `PRODUCTION_READY` or `VISUAL_GO` from this verifier.
