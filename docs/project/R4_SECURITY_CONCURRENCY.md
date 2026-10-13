# R4 — Workspace State and Godot Package Concurrency Security

**Status:** TECHNICAL TESTS PASS / EXTERNAL REVIEW PENDING. **Not a production release qualification.**

**Repository:** `roronoazoroshao/game-artist-mcp`; **product PR:** [#29](https://github.com/roronoazoroshao/game-artist-mcp/pull/29). This document describes the Phase 3 product branch. It does not alter historical POC-005C1/C2 verdicts, and this code is not in `main` until an authorized merge.

## Supported execution contract

The following is the bounded, tested deployment model for `AssetStore` and the opt-in v2 immutable Godot package publisher:

- Node.js 22+ processes on **one trusted host**, cooperating through the **same local filesystem** and the `AssetStore` API; directory creation and rename have local POSIX-style atomic semantics.
- The workspace root, `assets/`, and per-asset directories must be ordinary directories; asset state must be an ordinary file. A symlink in any checked component fails closed. Export names are allowlisted.
- Each state mutation obtains the exclusive per-asset `.asset-write-lock` directory and performs revision compare-and-swap while holding it. The v2 publisher holds that **same asset lock** through checking source digest, writing immutable files, and switching the current pointer. Contending callers fail with `ASSET_BUSY`.
- State JSON is limited to **16 MiB** both before write and when loading through a bounded read loop. State tempfile names are unpredictable and exclusively created; data and containing directory are synced.
- Package content hashes bind immutable outputs. Publishing validates existing package contents before updating `godot-v2-current.json`. Previously selected packages are not deleted on a new export.
- **Unsupported:** NFS/SMB/distributed mount semantics, different machines sharing a workspace, uncooperative writers directly editing `state.json` or `godot-v2-current.json`, and hostile same-UID filesystem actors able to swap ancestor directories between path checks. Do not claim safe multi-host export or sandbox isolation solely from these tests.
- **Crash-safety scope:** Process-crash and error handling with the OS/filesystem still running. The workflow has not qualified sudden **host power loss** or all nested directory fsync/durability cases. Do not claim power-loss-durable publication.

## Evidence-driven R4 TDD

| Step | Exact evidence | Result |
|---|---|---|
| RED — symlink workspace creation and unbounded state | [CI #38144147784](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38144147784), test commit `a59ee8f3` | Four genuine failing assertions |
| GREEN — root/assets checks and bounded state read/write | [CI #38144231621](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38144231621), fix commit `e5d4fe92` | Full workflow SUCCESS |
| Adversarial verification — distinct Node OS processes | [CI #38144362650](https://github.com/roronoazoroshao/game-artist-mcp/actions/runs/38144362650), test commit `6bb3f90b` | 192/192 Node PASS, 13/13 synthetic PASS, POC004 and Phase3 actual pinned Godot runtime PASS, FolderForge child MCP PASS |

Two independent OS processes start from revision zero and attempt to save conflicting revision-one states; exactly one succeeds. A separate process obtains the same asset lock and is killed with SIGKILL; subsequent writers remain blocked, the old state remains available, and manual lock removal only after the holder has exited allows safe recovery. These are Linux CI integration tests, not independent human security attestations.

## Fail-closed stale-lock recovery runbook

Do not delete a lock automatically based on age, PID guesses, or hostname alone: process identity can be reused and the filesystem may be shared unexpectedly. For an operator-controlled recovery:

1. Stop all Game Artist MCP writers/exporters using this workspace. Verify that **no live process** or host can continue writing this asset, using the hosting system's process supervisor/container orchestration. If ownership cannot be established, leave the asset blocked.
2. Back up the workspace and inspect the current `state.json` and `godot-v2-current.json` plus referenced package files. Treat unknown symlinks and damaged manifests as security incidents, not reasons to delete data.
3. Only after exclusive ownership is established, remove the **empty** directory `assets/<asset_id>/.asset-write-lock` using `rmdir`, not recursive deletion. Do not remove `state.json`, immutable version directories or pointers. Leftover `.v2-staging-*` directories from killed publishers are not current; inspect before any separate cleanup.
4. Restart **one** server and re-run focused state/export verification; if checks fail, stop and restore from the verified snapshot. Never bypass a state revision conflict.

## Residual risks and gate decision

- **Technical:** `lstat`/path verification cannot eliminate all ancestor swap TOCTOU by a malicious local actor with matching filesystem privileges; the supported model **requires a trusted workspace**. This is not a claim of adversarial multi-tenant filesystem isolation.
- **Reliability:** An orphaned lock deliberately blocks writes until an operator establishes safe recovery. This trades availability for data-integrity protection.
- **Durability:** Directory durability under whole-host sudden power loss has not been experimentally proven; no `POWER_LOSS_DURABLE` claim.
- **Independent review:** GitHub has zero independent code review submissions as of this test pass. Request a real code/security reviewer before asserting a fully independent technical pass.
- **Art/provenance:** [Issue #21](https://github.com/roronoazoroshao/game-artist-mcp/issues/21) requires authentic blind non-author human visual review; POC005C2 provider attestation is unavailable. Neither is satisfied by these tests.

**Governance update (2026-10-13):** The owner explicitly approved substituting a disclosed **AI multi-role self-review** for the former mandatory independent AppSec review of PR #29 **for technical-only integration**. This does not assert independent approval, nor relax documented trusted-local-filesystem constraints, P0/P1 remediation, branch protection, exact-head and post-merge CI, or independent production art/provider-attestation gates. Same-author GitHub review approval may be rejected by GitHub. No stable/production release is authorized. See [latest handoff](NEXT_RUN_PROMPT.md).
