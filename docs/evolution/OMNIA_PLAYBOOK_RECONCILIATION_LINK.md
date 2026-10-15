# Omnia Playbook reconciliation link

Status: proposed evolution linkage; no runtime gate is promoted by this document.

This Omnia Vault evolution branch is semantically reconciled against the companion `omnia-playbook` red-team branch and draft PR.

## Local branch / PR

- Repository: `timelabs-npo/omnia-vault`
- Branch: `evolution/kudu-omnia-v1`
- Draft PR: `#2`
- Prior head before this linkage commit: `78abf24821ed982dbd581d009e3fdf0f8ff3358e`
- Frozen Omnia baseline: `f5995536fede02d403f0525ff9093996457efecb`

## Companion semantic branch / PR

- Repository: `timelabs-npo/omnia-playbook`
- Branch: `evolution/maintenance-semantic-redteam-v1`
- Draft PR: `#9`
- Companion head observed before this linkage commit: `9921ece3bc33dfe9f0a3a8c3985e522d75b0411a`
- Companion baseline: `c9220eee388bba1b4d256d0a6ebd241cf5060102`

## Source dialect lock

- Kudu upstream: `AdventDevInc/kudu@92dbc52336ad9c9eb2968a180d22c72670de3b45`

## Authority boundary

`omnia-playbook` defines portable semantic invariants, fixtures, platform-equivalence checks, and adversarial validation. It does not authorize or execute mutation.

`omnia-vault` remains the owner of state-transition semantics, host policy enforcement, physical execution adapters, and durable operation receipts.

Any later Kudu translator or runtime integration must cite both this Omnia evolution branch and the exact playbook contract revision it was validated against. A changed companion head requires revalidation rather than silent semantic drift.
