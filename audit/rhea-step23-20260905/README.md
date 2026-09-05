# Rhea / Omnia external audit chain

**Audit branch:** `audit/rhea-step23-omnia-lit-001-v1.1-r2`  
**Frozen product baseline:** `f5995536fede02d403f0525ff9093996457efecb`  
**Purpose:** immediate external deep audit of the architecture evidence chain and the first Omnia local intact-transition candidate.

This branch is **audit-only**. It is rooted directly at the frozen Omnia baseline and does not claim that the candidate has been merged, built, executed, deployed, or hardware-qualified.

## Evidence states

The branch preserves the distinction between:

- `source_observed` / `documentation_claim` / `inferred` / `missing_in_scope` architecture evidence;
- **proposed** decisions and contracts;
- static candidate/source review;
- **physical runtime evidence**, which is still absent in the cloud environment.

`LIT-01..LIT-12` remain `NOT_EXECUTED` until the isolated local Rust/SQLite run returns build, runtime SQLite/VFS identity, golden-vector, competing-process CAS, replay, SIGKILL, corruption, negative-control, and gate receipts.

## Commit chain

1. `audit: freeze provenance and audit index`
2. `audit(step1): preserve extraction protocol`
3. `audit(step23): preserve semantic architecture handoff`
4. `audit(omnia-lit-001): preserve v1.0 implementation handoff`
5. `audit(omnia-lit-001): freeze v1.1 contract and independent oracle`
6. `audit(omnia-lit-001): add unqualified Rust candidate`
7. `audit(omnia-lit-001): candidate r2 repairs and execution boundary`

Each commit is intended to be reviewed independently. Later commits do not retroactively promote earlier proposal or test states.

## Primary invariant

Implementation repairs may change the Rust candidate, but the frozen `OMNIA-LIT-001/v1.1` contract, Python reference oracle, golden vectors, and validator expectations must not be changed to manufacture PASS. Any such change invalidates the slice.

## Original external architecture handoff

The STEP2/STEP3 material was delivered into the cloud as a complete source-bound handoff from a local Codex session. Where the original local artifact bytes are not available in this cloud runtime, this branch records the supplied representation plus the **reported original SHA-256** values. Those reported hashes must not be presented as hashes of a reserialized/reconstructed file unless the bytes actually match.
