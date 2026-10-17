# R9d-07 — Contrast, Ghosting and SpiritLight-Synchronized Underlight Review

**Date:** 2026-10-17. **Scope:** PR [#43](https://github.com/roronoazoroshao/game-artist-mcp/pull/43), R9d-only renderer. **Review type:** owner-account engineering, security and visual *self-review*, NOT independent artistic or security certification.

**Source of truth:** real [R9d-06 Godot comparison #39035203519](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39035203519) and [R9d-07 tuned exact-code CI #39039991420](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39039991420); [original R9d-06 project / 84 framebuffer artifact #12101274538](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39035203519/artifacts/12101274538); [tuned R9d-07 / 84 framebuffer artifact #12102988710](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39039991420/artifacts/12102988710). Both runs used pinned Godot **4.7.2-stable** and all **eight identical Firefly source-PNG SHA256s** with exact master ORA `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361`.

## Evidence-driven root-cause analysis

1. **Double-image ghost:** the previous two-Sprite2D crossfade had linearly complementary alpha across the full 55ms pose transition. Two independently alpha-composited 50%-opacity textures may produce double flame edges and only 75% combined opacity at coincident opaque pixels; alpha-sum 1 alone does not prove compositing visual continuity.
2. **Contrast:** R9d-06 reduced cyan-area variability but enlarged 512px cyan-bright pixel count to **921–1059** across 14 sampled frames; overbroad energy reduced distinction between cyan core and bronze frame.
3. **Underlight:** the old `body/CavityUnderlight` node held a constant texture opacity and had no animation track synchronized to baked `body/flame/SpiritLight:energy`. The canonical rig smoothstep energy track is exported to **69 actual baked Godot key samples**; requiring exact equality with 12 authored keyframes incorrectly fails and would lose the true smoothed profile.

## TDD and changes

- Fail-first [RED #39038749123](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39038749123): three R9d-07 tests failed for uncontrolled overlap, missing derived-light track and insufficient metadata.
- `src/export/r9d-flame-crossfade.mjs`: original authored 16-pose sequence, 2s loop and 55ms transition remain. Opacity now transitions with a smoothstep in the center **38–62% of the fade window** (13.2ms of strong pose overlap) while preserving texture and geometry authority; outputs complementary primary/secondary alpha tracks. This reduces the temporal double-edge overlap but can create a sharper perceived transition than the original; independent visual grading remains required.
- The same module **validates all baked SpiritLight keys**: increasing time, bounded energy, and exact original authored key-time/value anchors. Generates a `CavityUnderlight:modulate` track from the *actual* 69-key baked curve, no second PointLight2D. Fail-closed on incompatible scene/track/custody.
- `src/export/godot-r9d-candidate.mjs` adds R9d-only underlight track metadata and preserves original source, atlas, rail z=6, collision and rig. Scene ownership check rejects duplicate *node declarations*, not ordinary animation NodePaths.
- Real visual QA caught a regression in the initial modulation **0.10–0.32**: mean cyan area 512px fell from 992 to 473 and variability rose markedly. The tests were revised first [RED #39039834357](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39039834357), then tuned to narrower motion **0.64–0.72**, a measured quality trade-off, and verified on pinned engine.
- Actual Godot checker `scripts/r9d-06-runtime-check.gd` asserts early/mid/late ghost fade weights at 85/95/105ms, same-time SpiritLight/underlight rise and fall, alpha bounds, identical wrap, one light, physical rail depth and collision.

## Actual 14-time × 3-scale visual A/B: R9d-06 versus R9d-07

All bright-pixel counts use **the same** simple transparency and cyan-dominance threshold; 512 denotes full scene, 128/64 denote original 300×300 fixed prop crop. Captures are original Godot/Xvfb framebuffer PNGs, not regenerated concept illustrations.

| Metric | R9d-06 | R9d-07 tuned |
| --- | ---: | ---: |
| Mean cyan-pixel area at 512px | 992.3 | **708.0** (28.6% lower) |
| Cyan pixel max/min at 512px | 1.15× | **1.55×** (more variation) |
| Mean cyan-pixel area at 128px | 169.6 | **127.5** (24.8% lower) |
| Mean cyan-pixel area at 64px | 43.2 | **31.5** (27.1% lower) |
| Cyan pixel max/min at 64px | 1.32× | **1.95×** (more variation) |
| Pixel difference at 1999→0ms, all 512/128/64 | 0 | **0** |

Quantitative trade-off: **less broad cyan haze, stronger focal contrast** but **worse between-pose bright-area stability** than R9d-06. Model predicts only 13.2ms of substantial dual-image overlap; exact real-Godot sampler/runtime validates narrower weights but this alone cannot prove absence of all ghosting, flicker or double contours in continuous playback. Do **not** label a global art improvement or `ARTISTIC_GO`.

### Verification

- [Final source+runtime CI #39039991420](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39039991420) **SUCCESS** on code HEAD `817e0e234adbcffe8d3dd4b9d587a3ed25547d3f`: **307 tests = 304 PASS / 3 SKIP / 0 FAIL**; actual pinned Godot R9d-07 runtime marker `R9D07_GODOT_GHOST_LIGHT_SYNC_TECHNICAL_OK` present; 84 PNGs and same-source comparison written. The prior R9c old engine tests were not modified.
- [Real Krita #39039991432](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39039991432) SUCCESS; [Firefly custody evidence #39039991439](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39039991439) SUCCESS. OpenRaster master, source SHA/rights claims, alpha-mask sidecars unchanged.
- `r9d-flame-polish.json` records original art SHA, validated modulation key inventory (69 samples), alpha envelope, original frame sequence and rights blockers. No native Krita mask claim.

### Remaining art and commercial gates

**P1 artistic judgment:** narrower fade might read as a pop at high fps; bright area variability 64px worsened from 1.32× to 1.95×. Need actual looped in-game review and curated 64px assessment before `ARTISTIC_GO`. If unacceptable, revert R9d-07-only fade/modulation while preserving R9d-06 candidate; do not merge an aesthetic regression.

**P1 provenance/rights:** Adobe provider-original authenticity, model-specific use terms and commercial release rights remain **unverified**, regardless of SHA-verified downloaded PNG bytes. Native Krita brush masks are not attested.

**Disposition:** `R9D07_RENDERER_AND_SOURCE_TECHNICAL_PASS` · `VISUAL_CONTRAST_IMPROVED_WITH_TEMPORAL_STABILITY_TRADEOFF` · `ARTISTIC_GO=NO` · `RIGHTS_VERIFIED=NO` · `exportAllowed:false` · PR #43 **Draft/unmerged**. No independent approval asserted.
