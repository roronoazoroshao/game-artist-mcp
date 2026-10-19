# Linh Hỏa V4 — continuity, rhythm, material response

**Status: technical experiment; ARTISTIC_REVIEW_PENDING / UNSCORED.** Do not merge as production game art or claim independently verified rights.

## Scope and provenance

- Development base: `91fa6edac1ceeaf04bcdd1115363cde65971fd82` (V2, open Draft PR #53).
- V3 reference: **uncommitted source and screenshot snapshot** imported read-only from the existing VPS worktree `linh-hoa-poc` into isolated `linh-hoa-v4`. No V3 source in the original worktree was overwritten, committed or deleted.
- Separate isolated branch: `feat/linh-hoa-v4-motion-light`.
- All assets remain Godot/GDScript/CanvasItem shader source. No generative image model or downloaded visual resources.

## Artistic change: no additional scene decoration

1. **Ribbon continuity:** `flame_ribbons.gd` now redraws each runtime frame. The Bézier ribbons are continuous 48-sample vertex-colored meshes, with tangents recomputed from the **deformed** path (previously independent segment/quads and untracked deformation); both ribbons and shader silhouette use the same root-pinned large-scale bend `sin(3.6*h-1.65*t)-sin(-1.65*t)`. Higher-frequency individual curl is a small tip-only term, not a whole-sprite jiggle.
2. **Rhythm:** shader, strokes and light share the `2.28rad/s` breathing harmonic, with smaller phase-delayed high-frequency accents. The foot remains close to its anchor; the middle and tips have different motion response.
3. **Light and materials:** Godot PointLight2D still lights the basalt courtyard. A separate `JadeBounce` PointLight2D uses native `light_mask=2` for existing jade inlays; `ritual_ground.gd` reacts to its *real energy and visibility*. The existing altar top uses vertex-colored diffuse response driven by the main PointLight2D, while its sides absorb more light. **This is stylized scripted lighting with actual native lights, not PBR.** An initially attempted generic CanvasItem `light()` material shader was rejected because it produced zero measurable material difference in the real framebuffer.
4. **No new props, additional particles, ornaments or scenery** were added in this V4 pass. V3's imported background and original ritual markings are retained, unchanged except their color response to illumination.

## Evidence (actual Godot 4.4.1 / Xvfb / OpenGL Mesa llvmpipe)

Regenerate in the isolated worktree root:

```bash
xvfb-run -a godot --path examples/linh-hoa -- --capture-native
xvfb-run -a godot --path examples/linh-hoa -- --capture-motion
xvfb-run -a godot --path examples/linh-hoa -- --capture-light-ab
xvfb-run -a godot --path examples/linh-hoa -- --capture-material-ab
python3 examples/linh-hoa/scripts/build_evidence.py  # requires Pillow
node --test test/linh-hoa-framebuffer.test.mjs
npm test
```

- `captures/v3-reference/`: original captured V3 game 0.78s, native 64px and 128px; baseline SHA recorded in manifest.
- `captures/game-00..03.png`, `native-64.png`, `native-128.png`: V4 genuine framebuffer samples.
- `captures/v3-v4-comparison.png`: only labels, crops and resizing added using Pillow, not replacement artwork.
- `captures/animation-preview.gif`: 24 *actual* Godot-rendered frames captured at pinned 18Hz animation phases (not an in-game FPS benchmark).
- `captures/light-on.png`, `light-off.png`: both Godot lights ON/OFF with identical authored phase.
- `captures/material-lit.png`, `default-lit.png`, `material-dark.png`, `default-dark.png`: local stone/jade reactive response A/B with matching light states.
- `captures/manifest.json`: checksums and measured differences.

Observed isolated local thresholds: light ON/OFF **16,334 changed pixels** in the courtyard ROI (>5/channel); reactive materials ON/OFF **2,046 changed pixels** when lights are ON (>3/channel) but **0** in the dark and **0** in the sky; the 24-frame motion preview shows **2,320–2,873 changed pixels** in a defined reduced-resolution flame crop between adjacent frames. These are **engineering measurements, not aesthetic scores**.

## Adversarial art assessment

At 64px the warm center and three outer tongues remain distinguishable; at 128px the stronger strokes and lotus foot read more clearly. At scene scale, silhouette and motion coherence are incrementally improved, **but some ribbons still resemble thin threads**; flame shading has limited painterly depth, the scene context is a simplified ritual demo, and motion-frame timing under a real GPU has not been profiled. The static V3/V4 contact sheet shows a modest visual delta, not a production transformation.

Gates: `ARTISTIC_REVIEW=UNSCORED`; `INDEPENDENT_REVIEW=MISSING`; `TARGET_GAME_INTEGRATION=NOT_RUN`; `60FPS_GPU_PROFILING=NOT_RUN`; `rightsVerified=false`; `exportAllowed=false`. Keep PR Draft. No claim of Artistic GO.
