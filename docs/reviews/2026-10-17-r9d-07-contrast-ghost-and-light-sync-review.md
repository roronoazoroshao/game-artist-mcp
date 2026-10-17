# R9d-07 — Spirit Lantern Real-Godot Contrast, Ghosting and Light-Sync Review

**Date:** 2026-10-17 · **Scope:** [PR #43](https://github.com/roronoazoroshao/game-artist-mcp/pull/43) · candidate exact pre-report HEAD `e7bfb4dbf275715717d2b38d8b712d591178792d`.

**Review mode:** Author-account multidisciplinary technical self-review, **not independent**. **Technical status:** PASS on stated checks; **ARTISTIC_GO:** NOT GRANTED; **commercial rights:** UNVERIFIED; `exportAllowed:false`. Keep PR Draft / no merge.

## Problem, evidence and changes

1. **Ghosting in crossfade:** R9d-06 blended two different Firefly-painted flame poses throughout a 55ms window. Complementary Sprite2D modulate alpha does **not** imply continuous volumetric fire nor eliminate faint double contours. R9d-07 preserves the 55ms slot and the exact 16-pose, 2s sequence, but narrows its visibly overlapping interval to approximately **13.2ms** (`BOUNDED_SMOOTHSTEP_38_62`), preparing each next pose on the hidden sprite. **Caveat:** this is shorter than a 60Hz frame (~16.7ms). A shorter overlap can read as a rapid silhouette change; smoothness under real elapsed playback is **not professionally graded**.
2. **Contrast/light overfill:** R9d-06 bright cyan area was wide and visually muddied the interior metal. R9d-07 reduces observed cyan bright-pixel coverage and retains foreground `FrontCageRail` at z=6. It does **not** retouch or regenerate any original Firefly paint, alter the art's ORA or claim photometric realism.
3. **Underlight timing:** Previously static `body/CavityUnderlight` lacked a modulation animation track. R9d-07 derives `body/CavityUnderlight:modulate` from **verified baked** `body/flame/SpiritLight:energy` Godot track. Uses the original 12 source key times plus intermediate smoothstep-bake samples; the derived opacity remains 0.64–0.72 on an original low-alpha (<46/255) translucent PNG, with exact 0s/2s endpoints. Adds **no second PointLight2D**. Negative test rejects altered source light track, unknown resources and duplicate nodes.

### Test execution

- [RED #39038749123](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39038749123): 3 newly introduced R9d-07 tests failed for the missing ghost, modulation and source-preservation behavior. Later iterative runs fixed the source-baked light key mismatch, underexposure and runtime/QA regressions.
- **Current exact candidate HEAD `e7bfb4db...`:** [Full CI #39040433048](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39040433048), [push CI #39040428549](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39040428549), [Krita #39040433026](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39040433026), [Firefly provenance evidence #39040433039](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39040433039) all **SUCCESS**. Full main Node suite: **307 tests, 304 PASS, 3 SKIP, 0 FAIL**. Pinned real Godot runtime emitted `R9D07_GODOT_GHOST_LIGHT_SYNC_TECHNICAL_OK`; true side-by-side capture comparison emitted `R9D07_REAL_GODOT_THREE_SCALE_COMPARE_METRICS_WRITTEN`.
- [Real PNG and runnable Godot artifact #12103678178](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39040433048/artifacts/12103678178): 84 true framebuffer PNGs = R9d-05 baseline and R9d-07 candidate, each 14 timestamps × 512px full scene / 128px fixed item crop / 64px fixed item crop. 14 times: 0,1,69,70,95,124,125,180,375,750,1250,1875,1945,1999ms. Same SHA-frozen original painting and camera/engine.
- Real original ORA project SHA256 `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361`; all eight source PNG SHA256 remain frozen and included in comparison report. R9b/Krita compatibility and the shared R9c rendering pipeline remain unchanged.

## Quantitative review — measured, not aesthetic certification

These are **cyan-bright-pixel counts** from real Godot PNGs and are sensitive to the chosen pixel-classification threshold. They are not a physical photometric measurement or smoothness score.

| Metric | R9d-05 | R9d-06 | R9d-07 |
| --- | ---: | ---: | ---: |
| Cyan area / 512px, minimum–maximum | 245–606 px | 921–1,059 px | **574–882 px** |
| Cyan area maximum/minimum / 512px | 2.47× | **1.15×** | **1.54×** |
| Cyan area maximum/minimum / 64px crop | 2.27× | **1.32×** | **1.96×** |
| Source 1999ms→0ms screenshot changed pixels / 512/128/64 | 0/0/0 | 0/0/0 | **0/0/0** |

- R9d-07 **reduces cyan overfill relative to R9d-06** and improves contrast readability in selected genuine 128px frames. It is still brighter than R9d-05 on average and has **more pose-dependent cyan variation** than R9d-06. Never claim an unqualified win on smoothness/area stability.
- The new constrained overlap lasts **13.2ms**, too brief for guaranteed visible two-pose blending at conventional 60Hz. Test at display refresh with actual gameplay motion before qualifying as improved animation.
- The 14-frame comparison has one 95ms sample inside the overlap, but does **not** densely sample all the 13.2ms transition windows. A zero changed-pixel result at 1999ms and 0ms proves the exact checked sampled endpoints only.
- Manual contact-sheet comparison finds the front bronze cage, both paper talismans and the hanging tassel remain visibly readable at 128px; the cyan core remains partially right-biased and tiny in the 64px crop. **Art review remains UNSCORED.**

## Risk review / residual blockers

**P1 art:** Center flame is still right-biased behind foreground rail. 64px item appearance requires professional/owner aesthetic rating, including fire intensity, dark-bronze contrast, ghost edges at real temporal sampling and readability while moving.

**P1 animation:** 13.2ms effective overlap may turn ghosting into rapid pose snapping on 60Hz displays. Seek-based CI probes + 14 PNGs do not establish frame-pacing or perceived movement quality. Densely sample 60/120FPS across boundary and show real in-game video.

**P2 lighting:** Underlight is synchronized to `SpiritLight` key time, but remains a deterministic authored low-alpha overlay; lighting has not been validated on diverse gameplay backgrounds or with color grading.

**P1 editing:** ORA eight editable source layers and alpha sidecars are real, but native Krita mask nodes, brush-stroke undo fidelity and professional artwork approval remain unverified.

**RELEASE BLOCKER:** Model-specific Adobe commercial-license verification and authenticated provenance remain outstanding. No release, no exported commercial asset, no false independent security signoff.

## Verdict

`R9D07_GODOT_TECHNICAL_PASS` · `CAGE_LIGHT_SYNC_PASS` · `SOURCE_ORA_UNCHANGED` · `SAMPLED_LOOP_SEAM_PASS`

**`ARTISTIC_GO=NO` / `COMMERCIAL_RELEASE_GO=NO` / `PR43_DRAFT_UNMERGED`**.

**Next concrete work:** record a real continuous 60/120FPS Godot animation clip with peak-frame/pivot/contrast grading in the actual game scene; compare full-speed R9d-06 vs R9d-07 in unbiased A/B and refine the 13.2ms crossfade only if reviewers prefer it. Independently verify Adobe commercial rights before release.
