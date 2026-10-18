# R9d-07 P1 — Real Godot temporal popping isolation and recovery (2026-10-18)

**Scope:** [PR #43](https://github.com/roronoazoroshao/game-artist-mcp/pull/43), `feat/r9d-firefly-original-concept`. **Baseline:** immutable `R9D06_BASELINE`. **Review class:** owner/author-assisted technical self-review; no independent art, source provider or commercial rights approval.

## Verified real engine A/B

[Source-identical exact-head experimental PR CI #39111833079](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39111833079) **SUCCESS**: Node **314 PASS / 3 SKIP / 0 FAIL**, R9c/R9d Godot import/runtime and five-way A/B, FolderForge plugin check; [artifact #12131055484](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39111833079/artifacts/12131055484) includes the actual Godot framebuffer PNGs, runnable projects, 120Hz seek samples, 64/128px contact sheets and machine-readable comparison.

Each original source SHA and master ORA SHA `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361` are frozen. Same pinned Godot 4.7.2-stable renderer, viewport, asset crop, 2-second clip and 16-pose schedule. 120Hz deterministic seeking (not a measurement of monitor frame pacing), 240 full-loop 64px frames and 120 128px frames per variant.

| Source-identical profile | P95 64px changed pixels | Max 64px | P95 128px at derived 60Hz |
| --- | ---: | ---: | ---: |
| R9d-06 frozen baseline | **10** | **14** | See JSON artifact |
| R9d-07 original constrained 13.2ms | 30 | 43 | 142 |
| Constrained fade, static underlight | 29 | 42 | 138 |
| 55ms linear fade, synchronized underlight | **12** | **17** | **113** |
| 60Hz softened 35.2ms envelope, synchronized underlight | 23 | 31 | 137 |
| **55ms full-window smoothstep**, synchronized underlight | **16** | **20** | **123** |

**Root-cause inference:** Crossfade compression accounts for most of the excessive frame-to-frame pixel jump, while synchronized underlight has a smaller contribution. This inference is supported by isolated A/B configuration. Frame-difference magnitude is not directly perceived flicker or an objective ghost-edge score.

## Recovery decision

Select full-window 55ms smoothstep for the *R9d-07 candidate technical path*, not the original 13.2ms constrained overlap. It cuts P95 changed pixels from 30 to 16 at 64px and maximum from 43 to 20 while retaining easing, original 55ms boundary, exact C→A wrap, underlight synchronization, front bronze depth z=6, original 8 PNG source bytes, original ORA and R9c renderer.

A linear full 55ms blend has slightly lower frame jump (12/17), but a mathematically longer strong dual-sprite blend envelope. Full-window smoothstep narrows the 10–90% crossfade from ~44ms (linear) to ~33ms without the 13ms snapping risk. This **does not prove actual ghost silhouettes are eliminated**; visual preference remains UNSCORED. The new candidate remains less stable than R9d-06 at 64px (P95 16 vs 10), an explicit residual trade-off that must be judged from artifact imagery and true full-speed gameplay playback.

## Regression and safety

- Add a real 64px technical frame-difference guard: reject P95 or maximum changed pixels exceeding same-source frozen baseline by more than **8 pixels**; guard is not an artistic score.
- Validate Godot runtime intermediate alpha samples at 85ms, 95ms, 105ms and C→A wrap; keep complementary alpha, all 16 poses, 2 seconds, 8 FPS, collision, talismans, tassel and SpiritLight.
- Preserve full independent `FADE_ONLY`, `LIGHT_ONLY`, `SOFT_60HZ`, `SMOOTH_FULL_55MS` diagnostics for falsifiable evidence.
- Move large A/B framebuffer generation **after** strict FolderForge package validation. No expanded file-count limits, skip or security override. Earlier #39111415251 FAILED at FolderForge because experiments inflated its package scan; #39111833079 subsequently SUCCESS after reordering.
- Store logs and 64/128 contact sheets from actual Godot pixel captures, never image-generated stand-ins.
- The initial ablation test RED attempt failed from a malformed regex in the test harness; that is **not** valid behavioral RED evidence. A subsequent fail-first stability contract was added and must be tied to an actual CI result; do not relabel the syntax error as valid TDD proof.

## Gates

Technical stability from #39111833079 refers to the *experiment infrastructure*, **not** to the subsequently promoted default. Recheck **exact final HEAD** PR and push CI, Krita and source provenance after code change. No production merge.

`ART_UNSCORED`, `RIGHTS_UNVERIFIED`, `commercialRightsCleared:false`, `exportAllowed:false`, `PRODUCTION_RELEASE_BLOCKED`. No independent art reviewer, authenticated provider signature, professional playback scoring, physical 60Hz frame pacing or model-specific commercial licensing attested.

**Next:** inspect each source-identical Godot contact sheet/loop in continuous gameplay and demand genuine ghost-edge/bronze visibility feedback before ARTISTIC_GO. If selected 55ms smoothstep is visually inferior to R9d-06, revert R9d-07-only presentation while preserving immutable source data.
