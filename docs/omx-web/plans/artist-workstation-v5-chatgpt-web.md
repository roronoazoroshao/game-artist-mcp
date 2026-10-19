# V5 — ChatGPT Web: recoverable real-engine vision sessions

Base: stacked on V4 PR #49 at exact HEAD e0b92a9bc11f264431dce3839f8e297c18830701; new branch feat/artist-workstation-v5-chatgpt-resume.

## Problem and architectural decision

V4 binds decisions to a real Godot screenshot, but the image bytes are lost after a single MCP response. After switching conversations, ChatGPT cannot inspect the original frame; a fresh render is not evidence of identical pixels. V5 uses an atomic content-addressed snapshot, readable later by artist_session_reinspect if and only if it matches the pending session's expected version, source revision and SHA256.

Alternative 1 — arbitrary re-render as recovery: rejected due to identity drift. Alternative 2 — hidden autonomous LLM or falsely inferred visual review: rejected because the user expressly wants ChatGPT Web as the art model. Alternative 3 — saving PNG directly under a mutable filename: rejected due to torn writes and stale overwrites.

## Security and correctness invariants

- Capture validates sourcePaintSha256 and actual PNG byte SHA256 before persistence.
- Publish file after exclusive temporary creation, fsync and atomic hard link. No partially written public snapshot.
- A session's active Godot PNG is stored in the private per-asset directory under its exact content hash, max 2MiB each.
- Read uses no-follow and lstat, verifies byte length and checksum, session version, phase AWAITING_CRITIQUE and matching current painting revision.
- 1–3 brush revisions as in V4, no hidden model, no spoofed Artistic GO, no external URLs, no arbitrary target Godot code.
- Corrupt/absent/legacy snapshot fails closed. For old V4 sessions a separately authorized re-capture workflow is required; never guess the image.

## TDD and real verification

Unit tests test a new controller instance, exact PNG image equality, stale frames, revision change, tampering, symlinks, legacy/no image and post-FINISH restrictions. Live MCP smoke tests all 28 tools including exact cached screenshot. A separate test spawns two Node processes: first produces an actual Godot framebuffer; second reads precisely the same saved image with no re-render. Pin Godot 4.7.2 on GitHub Actions.

## Evidence and scope

In this ChatGPT Web conversation the assistant performed visual critique of a real 512px lantern staging shot, decided to widen the cyan flame, and reviewed the new Godot image. Before/after capture differed by 3,067 pixels. This is one genuine model-in-the-loop edit, NOT an unattended autonomous daemon, target game acceptance, independent human review or commercial rights clearance.

See docs/workstation/CHATGPT_WEB_OPERATOR.md. Keep V5 stacked Draft until exact-head CI and the repository's merge policy permit integration. PR #43 Firefly asset rights gate is independent and still blocked.
