# R12 — AI multidisciplinary advisory, reviewer packet integrity and release blockers

Date: 2026-10-18. Candidate PR #43 at `13fef9c216b56b7a443142d14c073ad1654cb3d6` **before this report commit**; main at `6ba1bcc90c9eceb0e4d08f39db0c0c07b38f5e4e`. Scope: internal AI advisory checks on **real** frozen R9d-06 / R9d-07 Godot captures, and a new reusable fail-closed public A/B packet verifier. This is one AI-run multidisciplinary critique — **NOT two independent human artists, not an Adobe or legal attestation, and not approval**.

## 1. Independent technical evidence versus AI advisory opinions

| Lens | What was really observed | Conservative conclusion |
| --- | --- | --- |
| Game-art direction (AI advisory) | Original 512px Godot screenshot has bronze-and-jade hanging lantern shape, visible paper charms, cyan central flame and red tassel; same-source 64px Godot contact sheet has recognizable overall silhouette | This is **static image inspection only**. Tiny talisman glyph details are not reliably legible at 64px, and the full environment/game-readability gate is pending |
| 2D animation (technical metrics + AI advisory) | Original artifact `r9d-07-temporal-dense-review.json`, 120Hz deterministic Godot frames: candidate 64px p95 changed pixels 16 vs frozen R9d-06 10; candidate max 20 vs 14; sampled seam 0 vs 1 | Wrap continuity improved in the sampled seam, while motion-change budget increased by 6 pixels. Screen presentation/flicker or preference must not be inferred from metric alone |
| Technical art and depth (AI advisory) | Foreground bronze rail renders over flame in sampled 512px frame; local 128px and 64px appearance remains present | Occlusion during full animation, material depth and 60Hz *physical monitor pacing* remain unverified |
| Security engineering (real tests) | The existing private R10 A/B package was parseable and its 510 PNGs matched the manifest, but viewer lacked an explicit CSP security boundary | Added verifier that checks exact image counts/digests/CRC/dimensions, source and rights fields, root traversal/symlinks/unexpected files, and exact script/style CSP hashes |
| Source provenance and commercial rights (source-specific) | Adobe GenAIAsset search sees 17 account history items, some with description/time consistent with eight source parts; original source manifest has 8 hashed PNGs and operation IDs | Matching **is heuristic**. Search does not expose signed per-part original-to-cutout chain, precise model/version/beta state or applicable account/model license. `RIGHTS_UNVERIFIED` |
| Release engineering | Earlier exact-HEAD PR CI/Krita/source provenance success; base main CI success; no independent external art review recorded | Continue DRAFT/unmerged. Do not relabel same-account advisory as independent acceptance or infer commercial release rights |

## 2. Actual R12 hardened A/B reviewer packet

- Frozen Godot art source: `e0bcf74feb7a92f4717669eae5f34de6423079d2`; ORA SHA256: `f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361`.
- Reused the same 510 original Godot pixel captures: each blind label A/B has 120 64px frames, 120 128px frames and 15 512px stills. None of the eight committed Adobe PNG sources, ORA, Godot painting or frozen A/B assignment were changed.
- Private review package `r12-spirit-lantern-blind-reviewer-kit-csp.zip` (not Git-tracked and not publicly redistributed). ZIP SHA256: **`5d73b42ef1d665abf319a76bdcd70db6138a502174a3d4e9eb93e07ebc709b73`**.
- Randomized A/B mapping remains **private** in a separate 0600 file. The reviewer-only manifest exposes merely SHA256 commitment `77124906fb47edf1c3e1122cb9de5a82696b8cbdbb6cf22821f3b9df52bb0ae8`.
- Added offline viewer **CSP**: `default-src 'none'`, `connect-src 'none'`, `form-action 'none'`, `base-uri 'none'`, `object-src 'none'`, `frame-src 'none'`, `worker-src 'none'`, only hashes of exact inline script/style content are allowed. Static source scanning is not a substitute for browser-runtime security testing.
- Actual extracted R12 package validated with `node scripts/r9d-review-packet-verify.mjs --root <EXTRACTED_PRIVATE_KIT> --source-head e0bcf74feb7a92f4717669eae5f34de6423079d2`: **510/510 PNG CRC + SHA256 + dimensions PASS**, 5,607,021 source PNG bytes. No public mapping, symlink, unexpected file, fake art approval or rights clearance accepted.
- New tests include RED-to-GREEN mutations for missing/extra PNG, bad digest and paths, external metadata claims, corrupt image contents, symlink/secret leak, missing CSP and tampered script CSP hash. Synthetic test-generated art is **only a negative/positive validator fixture**; it is never scored as real artist evidence.
- Earlier R10 private package is retained unchanged for rollback. **Do not distribute both packages** to reviewers in the same sealed session. Use the R12 package SHA above if beginning new blind review.

## 3. Adobe official policy researched; exact-asset entitlement is still unverified

- [Adobe Generative AI User Guidelines](https://www.adobe.com/uk/legal/licenses-terms/adobe-gen-ai-user-guidelines.html) (updated 2026-05-15) and [Adobe Generative AI Product Specific Terms](https://www.adobe.com/cc-shared/assets/pdf/legal/servicetou/adobe-generative-ai-product-specific-terms-en-us-20260423.pdf) (effective 2026-04-23) discuss general conditions, including use restrictions, nonuniqueness and other-rights obligations.
- [Adobe partner models in Creative Cloud](https://helpx.adobe.com/creative-cloud/apps/generative-ai/non-adobe-models-in-adobe-products.html) (updated 2026-09-10) documents that Adobe applications can use third-party partner models. Therefore an Adobe-hosted `.ffgenimg` listing does **not** attest an exact Adobe model.
- [Creative Partner Models product description](https://helpx.adobe.com/co/legal/product-descriptions/partner-model.html) (effective 2026-05-08) describes scope-specific exclusions/coverage; do **not** infer enterprise indemnification for the current account.
- Still missing: authenticated generation source identifiers/timestamps linked to the eight committed cutout PNGs, model+version (or model family with sufficient model-specific terms), feature beta designation at creation time, license/entitlement effective then, third-party reference/source rights and qualified rights review. No issuer signature is assumed mandatory if equivalent authenticated provenance can be supplied.

## 4. Decision and lowest-friction handoff

**R12 self-review verdict:** technical reviewer-packet integrity PASS; `ART_UNSCORED` / `RIGHTS_UNVERIFIED` / `commercialRightsCleared:false` / `exportAllowed:false` / `PR43_DRAFT_UNMERGED`.

The two mandatory external steps remain two real qualified independent non-author reviewers submitting source-bound scorecards privately and authenticated original/model/rights evidence from Adobe or equivalent issuer-authorized records. AI role-playing two artists cannot establish independence. Security engineering and CI do not grant legal usage rights.

After any branch source/art changes, check exact HEAD; if pixel content changes, regenerate the blinded kit and re-freeze before soliciting reviews. Retain all previous source, original artifact and sealed mapping records.
