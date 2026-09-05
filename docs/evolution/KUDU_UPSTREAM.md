# Kudu upstream provenance

This evolution branch integrates selected concepts/assets from Kudu into Omnia Vault's desktop-product layer.

## Frozen upstream

- Project: Kudu — https://usekudu.com/
- Repository: `AdventDevInc/kudu`
- Commit: `92dbc52336ad9c9eb2968a180d22c72670de3b45`
- License: MIT
- Upstream LICENSE blob: `fa28dfb600759fdd10695e4f6026cbbdc49f44bd`

The upstream is not merged wholesale. Omnia adopts selected desktop maintenance concepts and rule definitions under an explicit compatibility boundary.

## Omnia authority boundary

Kudu rule data can identify cleanup candidates. It MUST NOT directly authorize deletion, shell execution, registry mutation, remote commands, cloud control, service mutation, or any other destructive action.

All destructive evolution paths remain subordinate to Omnia's typed proposal / policy / receipt model. The frozen `OMNIA-LIT-001/v1.1` contract and audit branch are not modified by this branch.

## Explicit exclusions for this integration slice

- Kudu Cloud / fleet remote-control plane
- updater auto-execution
- malware quarantine/delete execution
- registry mutation
- service/startup mutation
- debloater execution
- secure delete
- shell-command cleanup actions

Those may be evaluated in later slices only after independent contracts and validation gates exist.
