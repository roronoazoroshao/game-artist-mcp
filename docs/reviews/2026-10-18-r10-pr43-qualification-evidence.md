# R10 PR #43 — Live technical qualification and sealed reviewer handoff

Date: 2026-10-18. Source: GitHub LIVE PR #43, exact HEAD e0bcf74feb7a92f4717669eae5f34de6423079d2, base main@6ba1bcc90c9eceb0e4d08f39db0c0c07b38f5e4e. This is **same-account technical evidence gathering**, not independent artistic review, Adobe provider attestation or legal advice. On adding this document, a new HEAD requires a new exact-HEAD check.

## 1. Verified live status before documentation commit

- PR open, DRAFT, unmerged, no reviewer request; inline review threads 0. Historical reviews visible are COMMENTED author-account technical reviews, not a genuine external artistic approval.
- Commit-filtered PR CI #39117042663, Krita #39117042677 and original AI source evidence #39117042669 were all SUCCESS for e0bcf74. Push CI on the same checkout was separately reported at #39117038384; any later source change must be rechecked.
- Actual artifact #12133305348, named r9d-real-Firefly-paint-ORA-Godot-TECHNICAL-UNSCORED, was downloaded from GitHub Actions to a private host directory. GitHub artifact digest: sha256:d413acbf9ccea171b631f0f9aec86d754e11cc0a588559a7c8c04d5d0c068680.
- Artifact contains 2,467 ZIP entries: editable ORA master, source masks, real Godot project, 512/128/64 screenshots, 120Hz deterministic-seek temporal frames and variant measurements. Neither project images nor 120Hz seeks prove physical real-time display timing.
- Clean independent host checkout has HEAD e0bcf74. After npm ci --ignore-scripts --no-audit --no-fund, npm test completed **320 PASS, 3 SKIP, 0 FAIL (323 total)**; 4 focused source custody/temporal tests PASS. Initial pre-install run had failures due to absent pngjs dependency and one timeout; it must **not** be cited as a source regression.
- Host Godot currently reports 4.4.1-stable; artifact reports CI pinned 4.7.2-stable. No new pinned-runtime render or real-monitor playback was claimed during this checkpoint.

## 2. R10 blinded reviewer packet, actually created and verified

- Offline, private host package: r10-private/review-20261018-e0bcf74/r10-spirit-lantern-blind-reviewer-kit.zip (outside git tree).
- SHA256: ee7c50a66e97bd5c5d13ec5a3e0d4910e692f37f97a36ae1975d0b525306dbb4; 5,731,180 bytes.
- Contains 510 exact real Godot PNGs: 120 64px frames and 120 128px frames per variant (240 each), 15 native 512px timestamps per variant (30 total); both variants derive from the same eight source PNG digests and identical frozen ORA SHA256 f32027d47af63512244d84da2de33c8e344992661ba2ea7f9177ca4d1dba2361.
- A/B assignment was randomized and locked in a separate 0600 private map, **not included in the ZIP**. Public commitment digest: sha256:77124906fb47edf1c3e1122cb9de5a82696b8cbdbb6cf22821f3b9df52bb0ae8.
- Kit contains a local offline A/B playback viewer targeting 60 frames/second, README, JSON reviewer scorecard template, manifest and per-image SHA256. Independently checked all 510 files against their manifest hashes, ZIP integrity and absence of sealed mapping. This is a playback viewer of deterministic frames, not a verified 60Hz hardware capture.
- Reuse Issue #21 trust boundaries: reviewer-authored submissions and identities held privately, quorum two genuine non-author qualified humans, unique reviewer evidence references, tie submissions to packet digest and head, lock BEFORE mapping reveal. **Current: REVIEW_PENDING; actual submissions 0/2; no production art approval.**
- Qualitative advisory only: flame/cage depth is visible in actual 512px static render; at 64px fine talisman glyphs become subpixel detail. Continuous visual quality in motion, double-edge discomfort, gameplay placement and actual refresh performance remain unscored.

## 3. Adobe original-to-cutout evidence matrix (non-authoritative candidate matching)

Evidence sources: eight source digests from source-custody-001.json, eight generation and background-removal request pairs from paint-operations-001.json, current connected Adobe GenAIAsset search metadata, and live Adobe official guidance. Search returned 17 account-wide generation objects, with relevant Spirit Lantern candidates dated 2026-10-17. Names/timestamps make candidate correlations plausible, but **no immutable provider-side original hash, original->cutout attested binding, model/version, feature-beta flag or usage entitlement** was exposed through this search connector.

| Source part | Committed SHA256 | Matching Adobe history hint (UTC) | Verified technical custody | Provider original-to-cutout | Per-asset rights |
|---|---|---|---|---|---|
| body | 5fe9b97002dd88bcf6a04b3eee96078db0137ec52fc464d8b363d1f00dda1d5d | separately painted main body, 2026-10-17 04:35:18 | SHA + cutout-request ledger | HEURISTIC ONLY | UNVERIFIED |
| flame_a | 1c846bdffbd05ca9cb625d696182fcc333d8a9bbc16311621161e0e219575124 | cyan source flame, 06:38:28 | SHA + cutout-request ledger | HEURISTIC ONLY | UNVERIFIED |
| flame_b | 47c963b4b282a2eb348f934f64c8d473687b2ae18146e8856f1a4074bf9e6cfa | edited flame revision, 06:51:32 | SHA + cutout-request ledger | HEURISTIC ONLY | UNVERIFIED |
| flame_c | adee20a4f8b57cd22d8cf9efd0f6d44d010a89f1fef16074edde453eb9b600da | edited flame revision, 06:52:39 | SHA + cutout-request ledger | HEURISTIC ONLY | UNVERIFIED |
| flame_d | 14e8ecfc84d7db3bc01e8a0e26ab9b1acf0cd7ac1e9986e531ed8b8d59736f21 | edited flame revision, 06:53:23 | SHA + cutout-request ledger | HEURISTIC ONLY | UNVERIFIED |
| talisman_left | a8dd3c85e99c241914ffaa621447aa996befa8f079745701676296c744cfdbca | narrow talisman candidate, 06:43:21 | SHA + cutout-request ledger | HEURISTIC ONLY | UNVERIFIED |
| talisman_right | 3eaf7e990513b49b899dd4e3db189a58aa49e9d38f74d8c1b464c2fabd11281c | alternate talisman candidate, 06:43:56 | SHA + cutout-request ledger | HEURISTIC ONLY | UNVERIFIED |
| tassel | 89aadb6965d4b325483e256cf023369736a2970a4c57a549cbd43fddcc8f640a | separate silk tassel, 06:44:33 | SHA + cutout-request ledger | HEURISTIC ONLY | UNVERIFIED |

**Critical caveat:** Each history hint is a tentative human-readable matching hypothesis based on truncated Adobe asset names and creation chronology, **not** a verified one-to-one lineage mapping. Model could be Firefly or a partner model; a Firefly generation-history asset class is not model attestation. Eight committed SHA256 digests authenticate retrieved PNG *integrity*, not Adobe authorship or usage rights. Short provider URLs/IDs in existing operation logs are not certificates.

Adobe current sources:
- https://www.adobe.com/cis_en/legal/licenses-terms/adobe-gen-ai-user-guidelines.html (general output/commercial use restrictions; applicable account terms still required)
- https://helpx.adobe.com/creative-cloud/apps/generative-ai/non-adobe-models-in-adobe-products.html (Adobe partner-model applicability varies)
- https://helpx.adobe.com/firefly/web/get-started/learn-the-basics/content-credentials-overview.html (original Content Credentials vs edited-file metadata)
- https://helpx.adobe.com/firefly/web/work-with-enterprise-features/creative-production/partner-models-in-firefly-creative-production-for-enterprise.html (enterprise-specific entitlements and limited indemnity, **not assumed to cover this account**)

Adobe search connector did not expose immutable generation audit objects, precise model versions, model-specific terms at generation time, original hashes or effective license entitlements. An original download's lack of C2PA alone should not be treated as a negative rights determination: equivalent authenticated provider audit evidence may suffice.

## 4. Smallest real external blockers and explicit GO policy

**ART BLOCKER:** Deliver the sealed A/B packet to two demonstrably independent, qualified real human reviewers. Obtain privately authored authenticated submissions tied to ZIP SHA256 and seal commitment. Do not reveal mapping until submission lock. Verify full-cycle motion and actual monitor/gameplay constraints; if artistic defects are identified, use scoped RED-GREEN-visual recheck before soliciting new frozen reviews. AI self-review is advisory only.

**RIGHTS BLOCKER:** Obtain per-part authenticated source-generation record with model/provider/version/beta status and original output hash; establish original-generation -> Photoshop removal -> committed PNG link, and generation-time account/model terms covering commercial video-game distribution. Allow authenticated non-C2PA alternatives; do not fabricate a provider attestation. Human rights/legal verification as required.

Source editability / running Godot / temporal metrics technically qualified as described, not artistic approval. Preserve source-custody and rights booleans unchanged.

**Release status: ART_UNSCORED / RIGHTS_UNVERIFIED / commercialRightsCleared:false / exportAllowed:false / PRODUCTION_RELEASE_BLOCKED / PR43_DRAFT_UNMERGED.** Do not merge, mark ready or commercially redistribute while blockers remain. No fake independent review or synthetic Adobe license grant. New doc-only HEAD needs its own exact-HEAD CI verification.
