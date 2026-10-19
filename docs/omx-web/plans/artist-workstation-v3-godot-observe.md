# Game Artist MCP — V3 real Godot visual observation (OMX Web)

Base: PR #47 at ec4cafe1c06826b4f7158ca345ea5ba9e5e56b61; stacked PR V1 #45 below V2. Do not mix PR #43 (unverified Firefly art rights).

## Implemented scope

- paint_scene_observe takes asset_id, valid historical revision, size (64/128/512) and environment (twilight/moonlight). A vision-capable MCP client receives actual PNG image content from the Godot OpenGL framebuffer, a source-paint SHA, screenshot SHA and truthful technical metadata.
- paint_scene_compare takes baseline_revision, candidate_revision, size and SAME fixed environment; runs the real Godot scene twice and reports changed pixels and mean-channel difference. No aesthetic score.
- The staging scene is a deterministic lightweight art readability fixture with static background, foreground occluder and two fixed palettes. It is not the user's game scene or a real moving-camera test.
- The host model must *itself* inspect the screenshot and choose the next paint_apply instructions; no autonomous LLM service is launched by this module.

## Exact operations/security boundary

- Existing PaintWorkspace validates asset identities and history. The observer sends only its own derived PNG and a fixed, trusted repo GDScript to temporary private local project folders.
- No source text from users is interpolated as Godot code. No URL, arbitrary path, script, process argument or arbitrary renderer selection is accepted from MCP.
- Fail closed if engine missing / image invalid, image size/geometry wrong, source project missing, scene identity wrong, or Godot does not print its verified capture marker.
- Uses GNU timeout wrapping xvfb-run plus llvmpipe, with a Node timeout, 1MiB process output cap, max 2MiB capture PNG, 30-second invocation deadline, in-process concurrent-capture guard, and temporary-directory cleanup.
- Important boundary: **a trusted local host is required**. This is not an OS sandbox or global multi-process quota. Running additional workers or untrusted arbitrary Godot scenes requires isolated worker/container governance. Do not run on a shared runner that cannot contain untrusted project execution.
- Returns artisticReview UNSCORED, rightsVerified:false, exportAllowed:false and displayFpsMeasured:false even if capture is technically valid.

## Test gates

- npm test checks geometry/argument guardrails without requiring Godot before its CI install. Real-Godot tests are explicitly marked SKIP in that phase.
- GAME_ARTIST_RUN_REAL_GODOT=1 node --test test/artist-godot-observer.test.mjs: performs actual framebuffer comparisons, environment difference, missing-Godot recovery and single-process concurrency.
- GAME_ARTIST_RUN_REAL_GODOT=1 npm run smoke:mcp: end-to-end 23-tool transport plus actual screenshot image content and Godot-frame comparison.
- CI runs both commands after installing **pinned** Godot 4.7.2 and with xvfb-run/OpenGL software rendering. This is real engine evidence, not derived PNG-only evidence.

## Architecture decision and next milestone

This is the safest small bridge between ChatGPT Web MCP painting and actual in-engine observation. A full autonomous AI Artist requires a vision-host controller with user-provided brief and authorized reference style, a bounded revision decision loop, resumption and owner review; and actual game project scenes with independently evaluated artistic acceptance. Current framebuffer captures qualify only the small staging scene. Avoid claiming full game art production readiness or rights clearance.