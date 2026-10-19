# AI Artist Workstation V4 — Vision-host session controller

Branch: feat/artist-workstation-v4-vision-session, stacked on V3 PR #48 exact HEAD fb9f677ab5b419596aa8d2b390f501fe4d3ab7cb. Chain: V1 PR #45 -> V2 PR #47 -> V3 PR #48 -> V4. Firefly PR #43 remains separate and rights/art blocked.

## Objective and architecture
A *vision-capable external ChatGPT/MCP client* can now drive a bounded, recorded art session. The model actually needs to look at each image returned by Godot and issue a specific brush correction; it is not simulated by a coverage score or embedded hidden model. The server is the deterministic orchestration and validation boundary:
1. \`artist_session_begin\`: record user art brief (10–500 characters), 64/128/512px staging size, fixed twilight/moonlight scene, max 1–3 changes, source paint revision, fail closed if prior session exists.
2. \`artist_session_observe\`: run **actual Godot** Xvfb/OpenGL capture, return image content to a vision host, pin SHA256 over returned PNG *bytes*, current source paint digest, session version and source revision.
3. \`artist_session_decide\`: host supplies the SHA of the observed screenshot, expected session version, a substantive critique, and one of REVISE (native paint operations), REVERT (append-only return to pre-session art), FINISH (no art changes, mark REVIEW_PENDING). No host-provided Artistic GO.
4. \`artist_session_status\`: retrieve persistent checkpoint or reconcile a crash-interrupted, uniquely identifiable painting commit.

## Bounded safety/recoverability
- All painting edits share the exact AssetStore per-asset interprocess lock; optimistic version and revision guards prevent stale decisions and double-spending an observed screenshot.
- The session journal is an asset-local 0600 file and max 64KiB. Reads check symlinks, size, schema and fixed rights metadata. Each update uses an exclusive randomized temp file and atomic rename. No arbitrary path, network request, hidden model invocation or untrusted Godot script.
- The session writes a **MUTATING** intent record before each paint change. If the host crashes before the paint mutation, status brings the session back to AWAITING_CRITIQUE without claiming work done. If painting committed but session checkpoint was not updated, it verifies the exact journal operations, reconciles once, and advances version. Unknown or foreign revisions are rejected.
- Maximum 3 REVISE actions, brief/critique length bounds, image SHA binding, and rightsVerified:false/exportAllowed:false/artisticReview:UNSCORED persisted at all stages.
- Unit tests include stale/fake screenshot, no critique, unknown command, budget cap, concurrent decisions, symlink, tampered rights flags, crash before/after painting commit, and out-of-band edits. Smoke test exercises the full state machine against **real** Godot framebuffer through the stdio MCP.
- Current engine scene is the deterministic art staging scene from V3, not a production game map; the exported Godot asset is a static Sprite2D. No professional aesthetic reviewer, independent human review, model-driven automatic critique invocation, character rig or 3D.

## Honest release readiness
Technical V4 can be qualified on exact-head CI but not merged without applicable authorization/review policy. AI self-review is advisory only. No output of FINISH is ARTISTIC_GO. Original Adobe PR #43 rights/provenance remains blocked.
