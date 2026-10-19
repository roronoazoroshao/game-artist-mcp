# ChatGPT Web — AI Artist Operator V5

This is the interactive ChatGPT-hosted workflow, not a new generative model. A vision-capable ChatGPT model actually inspects a real Godot PNG and chooses native painting commands. Game Artist MCP validates and executes the edits; it does not simulate AI decisions.

## Use in the ChatGPT conversation

1. Locate the authorized asset/workspace and call artist_session_status.
2. If there is no session, open painting and call artist_session_begin with a user brief, a fixed scene environment and a 1–3 edit budget.
3. If phase is NEEDS_OBSERVATION, call artist_session_observe at the pinned version.
4. If phase is AWAITING_CRITIQUE, call artist_session_reinspect at the pinned version. It returns **the exact stored PNG** from the earlier conversation without rendering a different image.
5. ChatGPT **must visually inspect** the returned PNG. Explain its concrete visual fault and use artist_session_decide with the current screenshot SHA256, expected version, REVISE and bounded native brush/layer operations.
6. Re-observe the actual Godot scene, inspect the before/after images at game scale and at a larger preview, or REVERT/FINISH. Never interpret changed-pixel count as beauty.
7. FINISH means REVIEW_PENDING, not independent Artistic GO or commercial clearance.

To resume in a new chat, ask: "Continue my Game Artist MCP asset with ChatGPT Web vision. Read artist_session_status; if awaiting critique, call artist_session_reinspect and actually inspect the exact returned PNG; propose a bounded correction with the pinned SHA/version, reobserve in Godot and decide whether to revise, revert or finish without inventing rights or approvals."

## Provenance and limits

The new tool stores screenshot bytes within the private asset workspace at vision-observations/<sha256>.png. The PNG is fsync-written to a temporary file then atomically hard-linked under a content hash. Reads validate file type, symlinks, byte budget, checksum, active revision and session version. Stale, absent, modified or legacy V4 snapshots fail closed. No arbitrary user file paths or URLs are accepted as snapshot locations.

This works when the MCP tools are made available to an authorized ChatGPT vision client. Having a host terminal capable of starting the stdio server does **not** automatically install the new tools into the ChatGPT native tool picker. This is a session-driven workflow, not a background process that can continue without the ChatGPT host.

The art staging scene is fixed and does not reflect a complete game with animated camera/lighting. Professional aesthetic qualification, independent reviewer identity and external asset rights remain separate requirements. The code never marks artisticReview, rightsVerified or exportAllowed true.

## Real ChatGPT Web demonstration

On 2026-10-19, ChatGPT visually observed a 512px Godot bronze lantern screenshot with SHA256 926ec2e186321f45667ac91e1dd3097a9f5aff196f87b034a67bbcf20a9da573, recovered exactly that screenshot after restarting the tool process, and chose an improved teal/white flame. Godot recorded 3,067 changed pixels, screenshot SHA256 01871ccdd1736af164a5db0f8dcad430f5437b018d7bb41b5f37f2fd7a24440b. At 64px the flame still appears small, so the demo ended REVIEW_PENDING, rights unverified and export disallowed.

## Evidence commands

- node --test test/artist-web-resume-v5.test.mjs
- GAME_ARTIST_RUN_REAL_GODOT=1 npm run smoke:mcp
- node scripts/artist-web-resume-smoke.mjs (two separate Node processes, exact PNG byte equivalence; no fictitious visual critique)
