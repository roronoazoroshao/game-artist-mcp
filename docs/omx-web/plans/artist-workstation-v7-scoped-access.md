# Game Artist V7 — native ChatGPT connection qualification and scoped gateway safety

**Base:** Draft V6 PR #51 at `fe84bcc552aaff6ad42edff0d334ac34d44880b6`. **Branch:** `feat/artist-workstation-v7-scoped-access`.

## Grounded objective

The private ChatGPT plugin exists, but no native `paint_apply`/`artist_session_*` tool calls from the user's ChatGPT account were observed. External HTTPS authentication and discovery work: unauthenticated POST returns 401, authenticated POST returns 200 with 21 tools. Current OpenAI help describes full custom MCP write support for eligible Business, Enterprise and Edu workspaces; installing a private plugin cannot bypass account/workspace permissions.

V7 improves *trusted single-operator remote access safety* while waiting for an authorized ChatGPT workspace connection: a read-only token, reliable distinct scopes, server-side 60-second action budgets for total and heavy tools, and metadata-only logs.

## Access-control design

Two independent tokens, passed in the host environment only:
- `GAME_ARTIST_REMOTE_BEARER_TOKEN`: full allowlisted remote tool set (existing behavior, 21 tools).
- `GAME_ARTIST_REMOTE_READONLY_TOKEN`: optional separate credential with exactly 10 immutable read-only tools: `asset_get`, `paint_preview`, `paint_compare`, `paint_diff_preview`, `paint_evaluate`, `paint_scene_observe`, `paint_scene_compare`, `art_game_capture`, `art_animation_audit`, `art_quality_review_packet`.

Read-only is **enforced on the server on each tools/call**, not only exposed in annotations. `artist_session_status` and `artist_session_reinspect` may reconcile an interrupted session with an on-disk checkpoint, so they are intentionally NOT considered read-only and are hidden from the read-only token.

Reject equal reader/writer tokens, insufficient entropy, unknown tool names and false read-only hints. No public token committed or included in test logs. No anonymous or shared guest role.

## Resource controls / evidence

Global per-process rolling 60-second limit: 120 authenticated tool calls; heavy Godot capture / animation calls: 8 per 60 seconds, including staging scene observe and vision session observe. Existing parallel tool calls capped at 2. Request JSON budget remains 256 KiB and individual Godot processes retain their timeout and 2MiB PNG cap.

Audit metadata records `tool`, `scope` (read/write) and `outcome` only; never Bearer, exact asset ID, raw prompt, original image or key material. This is not an OS-level audit log, distributed rate limiter or an OAuth identity provider.

Test gates:
- TDD RED→GREEN for 401 invalid token, read token cannot execute brush writes, different credential identity, high-volume 429, heavy workload 429, accurate introspection, logging redaction and misclassified tool startup abort.
- Real HTTP smoke with both token types, image response and rejected mutating tool.
- Exact-head GitHub CI with existing pinned Godot and full Node tests.
- Live staging refresh only after exact-head qualification, with rollback to previous immutable V6 checkout and no credential exposure.

## Explicit blockers

**Direct ChatGPT write connection remains BLOCKED/UNVERIFIED until the user installs/authorizes the custom MCP connection in an eligible ChatGPT workspace and a native tool invocation is returned.** Proving HTTP with a host Python client is only network protocol testing, not an actual ChatGPT UI or plugin permission test. Original Firefly PR #43 commercial rights and independent art review remain blocked. Do not auto-merge into main ahead of stacked V1–V6.
