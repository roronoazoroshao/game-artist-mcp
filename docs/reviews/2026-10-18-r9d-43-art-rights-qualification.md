# PR #43 — Artistic Qualification & Adobe Firefly Rights Verification

**Review date:** 2026-10-18 (UTC). **Source exact HEAD evaluated:** `80b19ab3923fc763c6b609082c7925ccfa159c0c`. **Scope:** R9d-07 Spirit Lantern, eight Firefly-sourced PNG parts, native editable technical OpenRaster and pinned Godot screenshot playback. **Identity:** same-account AI-assisted *advisory* technical/art review; NOT a second or independent human reviewer, NOT legal advice. A change adding this report must be rechecked at the new exact HEAD.

## 1. Evidence physically inspected

- [Pinned Godot PR CI #39115579918](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39115579918) SUCCESS; original technical artifact [#12131768459](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/39115579918/artifacts/12131768459) downloaded and inspected from actual bytes (ZIP contained 2,467 members and source-identical 2-second captures, not synthetic reference images). Push CI #39115574555, Krita #39115579851 and source evidence #39115579881 SUCCESS.
- Actual `r9d-master/master-preview-A-TECHNICAL.png` at 1024x1280; `r9d-godot/r9d-t-0095-512.png`, `...0375-512.png` and `...0750-512.png`; five-way 64/128px contact sheets; `r9d-07-ablation-comparison.json`, `r9d-07-visual-qa.json` and `r9d-07-temporal-dense-review.json`.
- At 64px candidate cyan-pixel count (15 sampled times) ranges **23–43**; baseline same-source R9d-06 ranges **37–47**. This is a proxy for how many pixels exceed the cyan detector threshold, not an artistic grade. The cyan ghost flame remains present but its visual footprint can be reduced appreciably during the cycle.
- Real Godot 64px adjacent-frame changed-pixel P95/max: frozen R9d-06 **10/14**, polished R9d-07 **16/20**. Derived 60Hz 128px P95 of R9d-07: **123**. Dense loop seam candidate **0** changed pixels at sampled endpoints, baseline **1**. Real-time display FPS **NOT MEASURED**. Whole 2-second smoothness or ghost-reduction is **NOT independently approved**.
- PNG evidence in this derived technical artifact (`master-preview`, `Godot 512px screenshot` and `atlas`) has *no embedded C2PA `caBX` chunk*. These are **processed outputs**; absence of credentials here does not prove the original Adobe-generation files lacked credentials.

### Image-specific advisory art assessment (non-independent)

| Area | Observed from real static review | Gate |
| --- | --- | --- |
| Shape/material | Ancient jade-bronze roof/cage, aged-paper charms and hanging crimson tassel form a coherent premium xianxia silhouette at 512px | STATIC OBSERVED |
| Lighting/depth | Cyan flame reads behind foreground bronze bar. Physically plausible separation in sampled frames, but unvalidated occlusion consistency during *continuous* animation | PARTIAL |
| 128px readability | Lantern structure, flame center and both paper talismans remain recognizable in unblinded contact sheets | STATIC OBSERVED |
| 64px readability | Lantern silhouette persists; talisman lettering becomes subpixel decoration; flame footprint can shrink to ~23 cyan pixels at certain captured instants | PARTIAL / NEED PLAYBACK |
| Motion/ghosting | Smoothstep 55ms decreases measurable popping vs compressed 13.2ms, but two flame poses still intentionally overlap; contact sheets cannot establish freedom from double-edges during gameplay | UNSCORED |
| Editing | OpenRaster source with 8 source-derived raster layers, five part groups and alpha sidecars; Krita semantic round-trip CI succeeded. Sidecars are NOT native brush masks | TECHNICAL VERIFIED |
| Qualified artist review | No two non-author independent eligible reviewers recorded, no sealed blind review session for PR43, no independent verdict on exact head | BLOCKED |

**Artistic Qualification verdict:** `ART_TECHNICAL_SCREENSHOT_PASS` / `ARTISTIC_GO=PENDING`. **Do not manufacture numerical beauty ratings or treat the same account's multi-role assessment as independent reviewers.** Minimum actual next proof: render/play **full 2s at real 60Hz** on target hardware, inspect 512/128/64px under representative moving gameplay environment, assess cyan glow, ghost double-edge, bronze rail occlusion, readability and C→A seam; collect **two genuine independently-authored reviewer scorecards** tied to fixed artifact hash, reveal verdict only after submissions.

## 2. Source provenance and licensing

### Repository and Adobe account evidence

- `examples/spirit-lantern/r9d/parts/sources/source-custody-001.json` records exactly **8 real RGBA source PNG byte SHA256 digests** and Photoshop API cutout request IDs/short provider URLs. Godot/Krita technical chains verify the hashed bytes and master ORA SHA256 `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361`.
- The same connected Adobe account's **GenAIAsset search** returned **14 historical Firefly generation assets**, including descriptions matching Spirit Lantern body, multiple blue spectral flames, two talismans and tassel, created 2026-10-16/17. This supports a **likely generation-history association only**; the asset-search results do not authenticate that each exported Photoshop cutout is derived from a *specific immutable original* or identify exact model/version/beta status. Individual personal Adobe asset identifiers and account ID are intentionally excluded from this public repository document.
- The source manifest itself remains: `sourceAuthentication:PROVIDER_URL_UNATTESTED`; each source `rightsVerified:false`; `rigAligned:false`; `artisticReview:UNSCORED`; `exportAllowed:false`. The concept-only record has `modelVersion:null` and `commercialRightsCleared:false`.
- **Do not alter or self-sign these false/unknown fields to make CI green.** SHA256 is custody/integrity, not third-party identity or a license grant.

### Current public Adobe policy (general, NOT a per-asset grant)

- [Adobe generative AI guidelines — Commercial Use](https://www.adobe.com/cis_en/legal/licenses-terms/adobe-gen-ai-user-guidelines.html): output generally may be used commercially, **except** a beta feature expressly prohibited from commercial use, and subject to existing service terms, rights of others and applicable restrictions.
- [Adobe Firefly business FAQ](https://business.adobe.com/products/firefly-business/firefly-ai-approach.html): commercial use is allowed for non-beta features and many beta features unless specified otherwise; **enterprise IP indemnity is a separate purchased entitlement** with conditions, not automatic.
- [Firefly Content Credentials overview](https://helpx.adobe.com/firefly/web/get-started/learn-the-basics/content-credentials-overview.html): credentials generally attach to 100%-Firefly-generated images and may be recoverable in Adobe's Content Authenticity cloud; can include Adobe issuer/app/action/date. **Derived cutout renders need not preserve embedded proof.**
- Adobe Firefly application may offer non-Adobe partner models. A `.ffgenimg` object or Adobe-hosted short URL alone does not prove which model produced its pixels.

### Specific rights verification packet still required

1. Read-only provider-side immutable original generation record for **each of 8 parts**, including owner/authorization, provider asset or request IDs, generation UTC timestamp, exact model/provider/version, feature beta status and original downloadable output hashes.
2. **Chain-of-custody** original generation → background-removal operation → each committed source PNG SHA (all 8) with signed Content Credentials if available, or alternative authenticated provider audit evidence if credentials cannot survive an edit.
3. Terms/entitlement effective at **generation time** for the particular models and account; permitted commercial use and redistribution in a game asset, with any third-party Stock/input/model restrictions separately recorded. No inferred blanket Adobe enterprise indemnity.
4. Confirm negative rights checks: no non-author uploads/licensed stock embedded without grant, no logos/trademarks, no prohibited beta output, no prohibited AI-training reuse. A qualified human rights reviewer signs the specific verifiable evidence, not this same-account analysis.

**Rights Verification verdict:** `GENERAL_POLICY_REVIEWED` / `PER_ASSET_RIGHTS=UNVERIFIED` / `COMMERCIAL_RELEASE_GO=NO`. The policy's general commercial permission is encouraging, but it is not evidence of the provenance/rights status of the eight particular PNGs.

## 3. Decision & merger barrier

| Mandatory gate | State |
| --- | --- |
| GitHub exact-head technical CI & real Godot capture | **PASS** on source `80b19abb...` (recheck report commit) |
| Editable ORA/rig + generated masks | **TECHNICAL_PASS**, artist-native masks not claimed |
| Real-gameplay final 60FPS and independent art reviewers | **BLOCKED** |
| Authenticated original-to-cutout chain + model-specific commercial rights review | **BLOCKED** |
| Qualified independent security/art approval | **NOT RECORDED** |
| Production export/release | **BLOCKED** |

**Final verdict:** `ART_UNSCORED`, `RIGHTS_UNVERIFIED`, `commercialRightsCleared:false`, `exportAllowed:false`, `PRODUCTION_RELEASE_BLOCKED`, **KEEP PR #43 DRAFT/UNMERGED**. Once both independent qualification and per-asset rights evidence are supplied, rerun all exact-head CI/provenance gates; only then reconsider guarded merge.
