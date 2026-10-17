# R9d-06 — Hybrid Flame Visual / Code / Security Technical Qualification

**Date:** 2026-10-17. **Role:** owner-authorized same-account multi-discipline technical self-review; NOT an independent reviewer. **Status:** TECHNICAL CONDITIONAL PASS; professional artistic acceptance and Adobe commercial rights NOT VERIFIED.

**Scope:** PR [#43](https://github.com/roronoazoroshao/game-artist-mcp/pull/43) · verified HEAD `55705fe02d60f0fa3e0463f083674e98aed8013c` before this report commit, source master `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361`. Full 8 original Adobe Firefly PNG custody preserved. No source art repaint, master ORA modification, shared R9c engine modification or release authorization.

## Implementation & evidence

- Opt-in per-pose cyan-alpha measurement and bounded presentation corrections: `src/ai-art/r9d-flame-polish.mjs`. Rejects invalid source, SHA, custody, rights claims and invalid corrections.
- Deterministically derived 256×320 translucent cyan underlight, constrained to an authored cavity and subtracted from front bronze mask. Not a native Krita mask or newly AI-painted pixel source.
- Isolated two-Sprite2D Godot flame presentation with 16 exact authored frames `A,B,C,D,B,C,D,A,C,D,A,B,D,A,B,C`, 8 FPS, two-second loop, complementary alpha and 55ms end-of-phase fade. Real Godot `AnimationPlayer.seek`, playback, C→A wrap and legacy light/rig checks.
- Distinct **R9d-05 baseline** and **R9d-06 hybrid** scenes built from identical eight SHA-pinned source PNGs and atlas. The same Godot 4.7.2-stable CI scene/camera/Xvfb captures **14 moments** (0, 1, 69, 70, 95, 124, 125, 180, 375, 750, 1250, 1875, 1945 and 1999ms), each at **512 full scene**, **128 and 64px fixed 300×300 item crop**; 42 real PNGs per variant (84 total).
- [Exact-head full PR CI #39034706193](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39034706193) **SUCCESS** at `55705fe0…`: full Node suite **304 total = 301 PASS / 3 SKIP / 0 FAIL**, old R9c/Godot jobs, new R9d runtime + 84-frame comparison passed. [Godot source-comparison artifact #12101274538](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39034706193/artifacts/12101274538) contains both runnable projects, import/capture logs, 84 PNGs, exact hashes, and machine-readable `r9d-06-visual-qa.json`. Real Krita and AI-source evidence CI on the same head are also SUCCESS.
- CI captures were collected from exact Godot render results, *not* image generation or hand-invented frame metrics.

## Measured visual effects — observational, not artistic certification

| Metric (14 sampled instants) | R9d-05 baseline | R9d-06 hybrid |
| --- | ---: | ---: |
| Cyan pixels min–max / 512 full scene | 244–606 | 921–1059 |
| Cyan area variability max/min / 512 | 2.484× | 1.150× |
| Cyan area variability max/min / 128 crop | 2.286× | 1.295× |
| Cyan area variability max/min / 64 crop | 2.267× | 1.324× |
| Pixel difference between 1999ms and 0ms / 512, 128, 64 | 0, 0, 0 | 0, 0, 0 |

Core visible flame pixels are more stable at sampled moments; **overall cyan bright-pixel area is substantially larger**. That broader glow can reduce interior contrast or create a perceived foggy/double-image effect, particularly behind the center bronze rail. The source of the visual difference is R9d-only crossfade/underlight, **not** unchanged eight Firefly source bytes. Distinct 14 timestamps do not establish smoothness for every intermediate time.

The source frame lightness and 2.5D readability remain subject to professional art review. A metric such as max/min cyan pixels is not a substitute for judged animation quality, artistic coherence or semantic fire behavior.

## Security and regression review

- Real original source hashes remain under `source-custody-001.json`; master SHA pinned and verified in the planner. `commercialRightsCleared:false`, `exportAllowed:false`, `artisticReview:'UNSCORED'`, `providerOriginalAttested:false` propagate into exported artifact metadata.
- Crossfade scene transformer rejects missing original tracks, unexpected/duplicate Blend sprite or atlas resource, incorrect z-index, unauthorized rig/pose order and out-of-bounds corrections. Source `Animation_idle` unrelated rotation, bob/swing, `SpiritLight`, collision and existing `FrontCageRail z=6` remain intact.
- Real Godot runtime and two-variant PNG QA both SUCCESS. Node tests are independently fail-first: missing planner, underlight, transformer, integration and comparator behavior produced RED CI before GREEN.
- Critique: painting ownership/rights not independently authenticated; author self-review cannot replace independent security review. Derived alpha mask is PNG, not native Krita layer mask. The additional cyan underlight is a static authored technical layer; it is not separately proven to track SpiritLight energy in every scene frame. Sparse 14-moment capture cannot prove absence of interpolation ghosts between all frames.

## Remaining P1/P2 and release blockers

1. **P1 ARTISTIC_GO pending:** Perform professional 64/128px frame-by-frame visual review for cyan overexposure, moving double edges and diminished contrast with center bronze rail. If deficient, reduce derived underlight or fade window and re-run real-engine A/B. Do not mark artistic GO based only on luminance/area ratios.
2. **P2 temporal consistency:** Verify underlight temporal response to `SpiritLight`; current derived texture is static. Consider synchronized authored modulation, but do not silently add a second PointLight2D.
3. **P1 editable masks:** Derived-alpha sidecars are editable PNGs, not true native Krita mask nodes; native masking and live brush/undo behavior not qualified.
4. **RELEASE BLOCKER:** Adobe model/version provenance and commercial usage rights are not independently attested. Keep `RIGHTS_UNVERIFIED` and `exportAllowed:false`.
5. **MERGE BLOCKER:** Remain in Draft. Same-account owner self-review is not independent external signoff; do not claim it is. Main branch remains unchanged.

**Verdict:** `R9D06_ENGINE_TECHNICAL_PASS` · `SOURCE_CUSTODY_PRESERVED` · `FRAME_COMPARISON_MEASURED` · **`ARTISTIC_GO=NO`** · **`COMMERCIAL_RELEASE_GO=NO`**. Do not merge PR #43.
