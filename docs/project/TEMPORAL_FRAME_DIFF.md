# Deterministic decoded-frame comparison (technical-only)

The `src/ai-art/temporal-frame-diff.mjs` utility is an isolated, asset-agnostic extraction of the pixel-difference calculation used during the R9d-07 investigation in [Draft PR #43](https://github.com/roronoazoroshao/game-artist-mcp/pull/43).

## Scope and safety

- `compareDecodedFrames(before, after, {channelThreshold:16})`: count each RGBA pixel whose maximum per-channel absolute delta exceeds the inclusive threshold; also report the largest channel difference.
- `summarizeFrameSequence(frames, {channelThreshold:16})`: count adjacent-frame changes, median, 95th-percentile, max, mean and final-to-first seam; no video decoding, I/O or timing side effects.
- Accept already-decoded `{width,height,data:Uint8Array}` RGBA frames only. A 2048px maximum per side, 1000-frame maximum and 32-million total decoded-pixel work budget bound synchronous work. Explicit null/invalid threshold input fails closed. Reject mismatched geometry, corrupt byte counts, malformed options and unsafe thresholds.
- Test inputs are synthetic `Uint8Array` images generated in code. **No Adobe/Firefly pixels, image/ORA files, source-provider signatures, provenance tokens, R9d hard-coded content hashes, rights evidence or exports** are introduced in this PR.
- `artisticReview:'UNSCORED'`, `commercialRightsCleared:false`, `exportAllowed:false`, `monitorFramePacingVerified:false`; pixel counts cannot establish professional animation quality or physical 60/120Hz playback.

## Integration path

The R9d-07 candidate in Draft PR #43 currently contains its own frame differencing. After this source-neutral utility has been safely merged to `main`, refactor the R9d-07 audit to call it in a *separate* PR43 commit with exact-frame regression checks. Do not merge the Firefly artwork or any release flags as part of the technical extraction. Its artistic and commercial release gates remain independent.

**Release status:** `TECHNICAL_LIBRARY_ONLY` — not a game asset or finished animated gameplay output.
