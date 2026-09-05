# Stash propagation and branch archaeology: omnia-vault

This documentation-only record routes archival evidence to its relevant repository. Snapshot: **2026-09-06, Europe/Moscow**, before the documentation branches created by this pass. Every comparison below uses fixed commit IDs.

The canonical archive is [rhea-project/stash](https://github.com/timelabs-npo/rhea-project/blob/3316bae0770744238099c25ae34e76e7ad4af8b4/stash/README.md). It is a normal Git branch named `stash`, separate from local `refs/stash`. Its 37 archive files total **361,824 bytes**; this pass reconstructed their UTF-8 bytes locally, verified each Git blob SHA-1 and size, and verified SHA-256 after disk readback. The four content-addressed original reports also match the SHA-256 encoded in their paths and total **115,053 bytes**.

The [original collection manifest](https://github.com/timelabs-npo/rhea-project/blob/3316bae0770744238099c25ae34e76e7ad4af8b4/stash/runs/2026-09-06-cloud-001/manifest.json) still records **41 pending items/groups** and `PARTIAL_WD_UNAVAILABLE`. That is the original cloud capture's state, not a statement that this Windows host lacks filesystem access. Mirroring the published archive does not collect the binaries, source trees, VM disks or histories merely named in those reports. Those pending artifacts were not captured in this pass.

At the six inspected main tips, no blob matches any of the 37 `stash/` archive blobs. This is exact-content evidence, not proof that no paraphrases, links or equivalent implementation exist. The propagation proposed here is a pinned documentation pointer and repository-specific findings; implementation adoption remains a separate change.

## Repository findings and routing

The audit branch `audit/rhea-step23-omnia-lit-001-v1.1-r2@548d186f590ee9c27cc418e35d51eff60c622234` diverges from main at `f5995536fede02d403f0525ff9093996457efecb`: **49 ahead / 2 behind**. All 67 returned changed files are under `audit/`. The two main-side commits update the README and hero artwork. No PR for the audit branch appears in the retrieved repository PR history.

[The published audit state](https://github.com/timelabs-npo/omnia-vault/blob/548d186f590ee9c27cc418e35d51eff60c622234/audit/FINAL_PUBLICATION_STATE.json) explicitly records `AUDIT_PUBLICATION_COMPLETE_RUNTIME_QUALIFICATION_PENDING` and LIT-01 through LIT-12 as `NOT_EXECUTED`. Candidate r2 is an exact reconstructible patch with recorded SHA-256 `594bab835d3f0a909efd70a312992ca5a3a666025309a5128e20cabc57697c47`, under `exact-patch-gzip-base64/`; `patch-parts/` is deprecated. These are observed publication records; this pass did not reconstruct, execute or qualify the candidate.

[The repair record](https://github.com/timelabs-npo/omnia-vault/blob/548d186f590ee9c27cc418e35d51eff60c622234/audit/omnia-lit-001/v1.1-r2/CANDIDATE_R2_REPAIR.json) describes two static repairs and explicitly makes no runtime claim. The v2 source declaration still pins `f5995536...`, not the current main or this audit tip. Archive publication is not implementation admission.

[Draft PR #2](https://github.com/timelabs-npo/omnia-vault/pull/2), `evolution/kudu-omnia-v1@ada2d783a3b688cb5352634d6202a45a5124273c`, contains four changed files: three adoption/reconciliation documents and a third-party license. Pair its review with [Omnia Playbook #9](https://github.com/timelabs-npo/omnia-playbook/pull/9). It is not a completed native maintenance implementation.

Route [archive compatibility](https://github.com/timelabs-npo/rhea-project/blob/3316bae0770744238099c25ae34e76e7ad4af8b4/stash/memory/COMPATIBILITY.md) and [storage/custody notes](https://github.com/timelabs-npo/rhea-project/blob/3316bae0770744238099c25ae34e76e7ad4af8b4/stash/memory/STORAGE.md) here as context. The next implementation decision must select and verify an exact candidate against its frozen contract, without treating preserved audit material as a passing execution receipt.

## Branch ledger

Pinned main: `8db7f3e6f94ba6f9a2dbedd7d32b465779bcaace`. Ahead/behind counts measure commit ancestry relative to that main. They do not measure missing patches, successful tests or merge readiness. Historical merged PRs can refer to older heads, or contain content integrated without the original ancestry.

| Branch | Pinned head | Ahead / behind main | PR evidence |
| --- | --- | --- | --- |
| `audit/rhea-step23-omnia-lit-001-v1.1-r2` | [`548d186f590e`](https://github.com/timelabs-npo/omnia-vault/commit/548d186f590ee9c27cc418e35d51eff60c622234) | 49 / 2 | none in retrieved PR history |
| `copilot/improve-engineering-standards` | [`5cff638a606a`](https://github.com/timelabs-npo/omnia-vault/commit/5cff638a606a77a54f287c4172332114edd3f282) | 0 / 3 | [#1](https://github.com/timelabs-npo/omnia-vault/pull/1) merged |
| `evolution/kudu-omnia-v1` | [`ada2d783a3b6`](https://github.com/timelabs-npo/omnia-vault/commit/ada2d783a3b688cb5352634d6202a45a5124273c) | 4 / 2 | [#2](https://github.com/timelabs-npo/omnia-vault/pull/2) open draft |
| `main` | [`8db7f3e6f94b`](https://github.com/timelabs-npo/omnia-vault/commit/8db7f3e6f94ba6f9a2dbedd7d32b465779bcaace) | 0 / 0 | none in retrieved PR history |

## Verification limits

All branch lists and PR lists fit within the 100-item first page. Comparisons cover every non-main branch. The checkpoint branch's explicit no-common-ancestor response is recorded as unrelated history. Recursive trees used for content identity checks were not truncated. GitHub comparison file lists can stop at 300 files; a 300-entry list is not a complete large-branch diff. No broad patch-equivalence analysis of the older Rhea histories was performed.

This pass used GitHub metadata, pinned trees, selected documents and local archive hashing. Component tests, builds, deployment checks, production runtime checks and pending WD artifact collection were not run. The archive's published Drive and scheduler receipts were read as historical records; those external states were not reverified or changed.
