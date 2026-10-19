# Linh Hỏa — Thanh Liên U Hỏa (Godot 4)

**Status:** functional, editable *art prototype*. **Not** independently approved artwork or production-ready VFX.

## Visual brief
- Xianxia 2.5D isometric spell/fire; pale gold spirit core wrapped by jade-cyan flame and two lotus petals.
- Silhouette should read at 64px; finer rune-ring geometry appears at 128px.
- Animation is procedural and deterministic from time: breathing (3.8 rad/s), asymmetric tip drift (4.8 and 7.2 rad/s), curling tendril, seven drifting embers.
- The base is an isometric ellipse; the game sandbox includes a hexagonal basalt altar, diamond courtyard and two monoliths.
- No external image-generation models, stock art, downloaded textures, or shader-based displacement were used.

## Editability
The flame is the reusable **linh_hoa.tscn** scene. Its **linh_hoa.gd** stores editable palette constants, Catmull–Rom shape anchors, intensity and phase. Changes to anchor arrays/layers are immediate in Godot. **showcase.tscn** and **showcase.gd** are only the demo world. Thumbnails are actual Godot SubViewport outputs; they are not PNGs scaled in an external editor.

## Run
```bash
godot --path examples/linh-hoa
```
Headless is insufficient to prove real OpenGL rendering. On Linux with Xvfb and software OpenGL:
```bash
xvfb-run -a godot --path examples/linh-hoa -- --capture-native
```
The capture command creates `captures/game-00.png`…`game-03.png` (960×540) at 0, 0.34, 0.78 and 1.21s, plus actual **64×64** and **128×128** Godot SubViewport framebuffer captures. Node-based evidence checks:
```bash
npm ci --ignore-scripts
node --test test/linh-hoa-framebuffer.test.mjs
```
The GIF preview is sampled from the four *real Godot* scene PNGs, not an AI-generated animation.

## Verification boundary
- Source scene and runtime screenshots proven on Godot **4.4.1**, Linux/Xvfb/OpenGL Mesa llvmpipe.
- Demo scene ≠ integration into the user's actual external game. Tested only inside this repo's sandbox.
- Four time samples prove non-constant frames but not smoothness at 60fps or mobile GPU behavior.
- 64px readability is manually observed; technical color-count and frame-diff tests do not judge aesthetic merit.
- Independent art review: **PENDING**. Artistic GO: **NOT GRANTED**. Rights: source self-authored, external verification **NOT PERFORMED**. Release eligibility: **NO**.

## Outstanding visual defects
1. Opaque polygon cores are still visually faceted; liquid flame motion is limited to sway and tips rather than full contour flow.
2. Gold magic circle risks a mechanical/UFO appearance at 128px; improve embedded floor decals, occlusion and depth.
3. Subtle ambient world lighting, bloom control and volumetric occlusion remain unexplored.
4. Four sample captures cannot establish in-motion temporal coherence, smooth animation, or 60fps performance.
