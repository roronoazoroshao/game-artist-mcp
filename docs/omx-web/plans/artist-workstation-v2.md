# Artist Workstation R2 — scoped implementation plan/checkpoint

- Target: Game Artist MCP, based on V1 PR #45 HEAD ba800f06b2404e47577d8b54f19667fa8bd6f87e; isolate in stacked branch `feat/artist-workstation-v2-raster-review`. No changes to Firefly R9d PR #43.
- GOAL-002A: canonical base64 PNG import with SHA/source label, bounded full-canvas RGBA decoding, persistent version history and editable layer. No URL and no copyright attestation.
- GOAL-002B: diff preview image plus objective rubric evaluator with explicit revision budget, no fake Artistic GO.
- GOAL-002C: MCP tools + adversarial TDD + real Godot static imported-image correction and exact-head CI.
- QA negative paths: malformed input, base64 noncanonical/oversized, forged IHDR, nonRGBA, mismatched canvas, tampered SHA, duplicate layers, stale revisions, import quota, invalid rubric.
- Operational trust: retained last-good state via optimistic asset locking; all files local, no arbitrary path arguments and no network fetch.
- Non-goals: autonomous model invocation, quality certification, image upscaling, native Krita/Blender editing, animation rig, 3D, commercial-release rights verification.
- Merge policy: do not merge the stacked PR ahead of its V1 base; code review is same-account AI advisory and cannot satisfy independent human review.
