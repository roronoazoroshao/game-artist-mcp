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
