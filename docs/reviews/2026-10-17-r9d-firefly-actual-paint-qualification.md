# R9d — Exact-source Technical Art and Security Qualification (2026-10-17)

**Review:** Same-account author technical review; **NOT** independent security or professional art approval. GitHub PR: [#43](https://github.com/roronoazoroshao/game-artist-mcp/pull/43). No production release authorization.

## Source custody — real Firefly pixels

- **Eight actual Adobe-generated, background-removed RGBA PNGs**, permanently Git-tracked at `examples/spirit-lantern/r9d/parts/sources/` and listed with independently computed SHA256 in `source-custody-001.json`: body, four independently revised flame poses, left/right talisman, tassel.
- Real provider-download workflow: [#39016159470](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39016159470), 8/8 PNG header+CRC+alpha+SHA verified, 4-pose normalized alpha silhouette technical gate PASS. The archive contained actual PNG bytes, not just provider URLs.
- Exact lossless source PNGs then committed by GitHub Actions on [#39016429216](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39016429216). Retained original `paint-operations-001.json` as historical pre-custody request log rather than retroactively falsifying earlier status.
- Adobe identity is **request IDs and provider URLs**, **not cryptographic Adobe signature or guaranteed commercial license**. `sourceAuthentication=PROVIDER_URL_UNATTESTED`, `rightsVerified=false`.

## Real independently editable raster master

- True **1024 × 1280 OpenRaster master** from the newly painted source PNGs, **8 independently editable visible/hidden layers** arranged into **5 rig groups**, 4 distinct flame alternatives. `examples/spirit-lantern/r9d/master/spirit-lantern-r9d-TECHNICAL.ora`.
- Deterministic premultiplied-alpha area reduction from real PNGs, source-to-placed-layer sha lineage, and 8 separate **derived alpha PNG mask sidecars**. These are *not* Krita/GIMP native brush-mask objects, and were not freshly painted by an artist.
- ORA deterministic SHA256: `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361`. Native editable-master Git commit created by [source freeze workflow #39017850729](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39017850729).
- Real Krita 5.2.2 open → export → reopen: [#39017676329](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39017676329) **SUCCESS** using new independent Python semantic pixel verifier. **8/8 original layers preserved pixel-perfect in world canvas coordinates**, including alpha; Krita trims 1 transparent pixel around the body (changing stored layer dimensions and x/y) without altering any actual painted pixel.
- Source merged preview vs Krita merged preview: **47 pixels differ, maximum 1 of 255 channel values**; Krita merged image vs Krita reopened PNG: exact. This is `SEMANTIC_SOURCE_EXACT_PREVIEW_BOUNDED`, **NOT** strict byte-identical PNG internals or `PIXEL_EXACT_PREVIEW_PASS`. Existing legacy R9b strict file-byte verifier remains unchanged.

## Actual Firefly-painted Godot runtime

- R9d actual 8-source master → 9 raster frames → R9c atlas → Godot pinned headless runtime/real Xvfb framebuffer at t=0.375s: [full exact-head CI #39017107584](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39017107584) **SUCCESS**.
- Technical project artifact [#12094848818](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39017107584/artifacts/12094848818) contains ORA, alpha masks, atlas, scene, export logs, image and per-part attribution; independent real Godot screenshot SHA256: `dddf73eab242cfe564bd1b238e19660398880bc9fd6b15575cf5a0667fddd318`.
- Runtime demo uses **genuinely newly generated Firefly-painted components**, not painted old R8e SVGs. Animation duration 2 seconds, 4 flame poses + 5 base frames and Godot light motion technically exercised. Authenticity and commercial-rights gates remain unverified.

## Review findings requiring correction before Artistic GO

1. **Visual depth/occlusion (P1 art):** Front vertical bronze frame is not separated from the glass interior. Flame paints in front of/through the body central cage bar instead of obeying proper front/back depth; professional painter/technical artist should split rear shell, inner fire and foreground cage rail or explicitly mask occlusion.
2. **Temporal art quality (P1 art):** Four flame silhouettes show technical diversity, but they have **not** passed independent motion-flow / flicker continuity review or real rendered 64/128px blinded A/B against prior R8e. Alpha diversity alone is not temporal continuity.
3. **Source/editability (P1 art):** Derived alpha sidecars are editable PNG files but **not native Krita brush masks**. Rig placements are authored technical estimates and pivots were only Godot-verified for mechanical animation, not professional 2.5D aesthetic accuracy.
4. **Rights/provenance (release blocker):** Firefly provider terms and precise model/version commercial license **not independently authenticated**. Request-ID/URL + immutable SHA is not Adobe-signed provenance. `RIGHTS_UNVERIFIED`, `ART_UNSCORED`, `exportAllowed:false`.
5. **CI provenance nuance:** GitHub Actions bot authored freeze commit did not automatically start complete PR CI on that exact bot HEAD; rerun/qualify the exact current commit after author-origin documentation update before final advisory technical status.

## Verdict

`R9D_EIGHT_REAL_SOURCE_PNG_GIT_TRACKED` · `EDITABLE_ORA_KRITA_WORLD_RGBA_EXACT` · `ACTUAL_FIRE_FLY_GODOT_TECHNICAL_PASS` · **`ARTISTIC_GO_NOT_GRANTED`** · **`COMMERCIAL_RELEASE_BLOCKED`**.

**Next bounded tasks:** visually repair foreground cage occlusion and review 2-second flame motion; produce 64/128/512px multi-time evidence; verify provider license and native editing/mask semantics; re-run independent review before any release.
