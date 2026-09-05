# OMNIA-LIT-001 Contract Amendment v1.1

Status: PROPOSED CONTRACT AMENDMENT. This freezes two encodings omitted by v1.0.
No implementation or product acceptance gate is marked PASS by this document.

Parent contract: OMNIA-LIT-001_HANDOFF.md
Frozen Omnia baseline: f5995536fede02d403f0525ff9093996457efecb

## A. Initialization request digest

`InitRequestDigest = SHA-256("OMNIA-INIT-V1\0" || owner_id[16] || actor_id[16] || workspace_id[16] || replica_id[16] || bootstrap_operation_id[16])`

All identifiers are raw 16-byte values. The digest is raw 32 bytes.

## B. Publish terminal receipt encoding

The canonical terminal publish receipt is:

`"OMNIA-RECEIPT-V1\0" || U8(kind) || owner_id[16] || actor_id[16] || workspace_id[16] || replica_id[16] || operation_id[16] || request_digest[32] || expected_revision_id[32] || U64(expected_generation) || result_revision_id[32] || U64(result_generation) || item_id[16] || file_manifest_id[32]`

`kind`:
- `1` = `LOCAL_COMMITTED`; `result_*` is the newly committed head.
- `2` = `CONFLICT`; `result_*` is the conflicting head actually observed under the write serialization boundary.

`ReceiptDigest = SHA-256(canonical receipt bytes)` may be used as an evidence identifier but is not an authority token.

The receipt is immutable. Exact replay returns the stored canonical bytes and semantic fields; it is not reconstructed from the current head.

## C. Bootstrap receipt encoding

The canonical bootstrap receipt is:

`"OMNIA-INIT-RECEIPT-V1\0" || owner_id[16] || actor_id[16] || workspace_id[16] || replica_id[16] || bootstrap_operation_id[16] || init_request_digest[32] || genesis_revision_id[32] || U64(0) || empty_tree_id[32]`

`BootstrapReceiptDigest = SHA-256(canonical bootstrap receipt bytes)` is evidence identity only.

## D. Encoding rules inherited unchanged

- Tags are literal ASCII followed by one NUL.
- Integers are unsigned big-endian fixed-width.
- IDs are exactly 16 raw bytes; SHA-256-derived IDs are exactly 32 bytes.
- Unknown versions, lengths, tags, extra/trailing bytes and domain substitutions are rejected.
- Object, FileManifestId, TreeId, RevisionId, request digest and receipt digest are separate domains even where all are 32 bytes.

## E. Scope

This amendment does not add a network API, filesystem path input, projection, replication, eviction, model authority, or receipt-driven capability. It only removes ambiguity in independently testable canonical bytes.
