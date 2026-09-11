# Omnia Vault Architecture Deep Dive

**Scope.** This document describes the implementation currently in the repository and
the contracts required before it is treated as a production synchronization engine.
It deliberately distinguishes implemented behavior from the intended GCCmp/Rhea
architecture.

## 1. Current data paths

There are two independent local stores:

* `frontend/server/core/gccmp_daemon.js` stores UTF-8 event payloads in SQLite
  `blobs`, file metadata in `manifests`, and event rows in `commits`. SQLite is
  configured for WAL mode, but each event is currently an unrelated root:
  `parent_id` is always `NULL`, and IDs are time/random identifiers.
* `supervisor/src/main.rs` stores OS stub records in a separate SQLite database.
  Stubbing moves or copies a path into `VaultData`, creates a symlink at the
  original path, and then inserts a row in `stubbed_files`. Restoration performs
  the inverse sequence.

The Node proxy also exposes an in-memory `mockLocalFiles` view. It is not a
projection of either database, so UI state can disagree with filesystem state.
No File Provider extension or Windows Cloud Files API (CFAPI) adapter exists in
this checkout; the Rust supervisor is a POSIX-style prototype.

## 2. Intended causal model

A production revision should be a content-addressed immutable object:

```text
blob = H(algorithm || length || bytes)
tree = H(canonical(sorted(path, mode, metadata, blob-or-tree-id)[])
revision = H(schema || author || logical-clock || parent-ids || tree-id)
```

Each revision may have one parent for a linear local journal or multiple parents
for a merge. The durable head is a compare-and-swap pointer:

1. Read the current head and its generation.
2. Build and validate a new immutable tree outside the lock.
3. In one SQLite transaction, insert objects/events and update the head only when
   the expected generation still matches.
4. Publish the new head after commit; readers retain the old head until their
   operation completes.

The current JavaScript implementation has only the first half of this model:
blob hashes are SHA-256(content), but manifest and commit identifiers are
non-deterministic, manifests are not tree roots, and no atomic head exists.
Consequently two replicas cannot independently derive the same revision or
deterministically reconcile it.

## 3. Comparison with established systems

| Concern | Current implementation | Git Merkle-DAG | ZFS snapshots | IPFS-style chunking |
| --- | --- | --- | --- | --- |
| Object identity | Content hash only for event bytes; path-derived hash for OS payloads | Hash covers canonical object bytes and references | Block/tree checksums plus transactional dataset state | CID covers canonical block and codec |
| Directory state | Flat manifest rows; no directory root | Tree objects recursively reference entries | Consistent filesystem view at a transaction boundary | UnixFS/DAG links form a named tree |
| Revision ancestry | `parent_id` is always null | Commit parents form an explicit DAG | Snapshot lineage and transaction groups | DAG links are explicit, application-defined |
| Atomicity | Separate filesystem and DB operations | Ref update is atomic within repository semantics | Copy-on-write transaction groups | Immutable blocks; pin/ref update is separate |
| Reconciliation | Not implemented; latest timestamp query only | Three-way merge with explicit base | Snapshot rollback/clone, not peer merge | Graph exchange; merge policy is above the block layer |
| Large files | One SQLite BLOB | Packfiles/delta compression (implementation-dependent) | Block-level copy-on-write | Chunked blocks and resumable transfer |

The gap is not solved by enabling WAL. SQLite WAL provides reader/writer
concurrency and crash recovery for one database; it does not make a filesystem
rename plus a second database commit atomic, nor does it create causal history.

## 4. Deterministic reconciliation contract

The sync layer must reject a revision unless all of the following hold:

* every object is addressed by a versioned hash algorithm and canonical encoding;
* every parent is present locally or the revision is quarantined as incomplete;
* a merge records the complete parent set and the common base;
* path comparison uses normalized, case-policy-aware, separator-safe names;
* equal paths with different object IDs are conflicts, not last-writer-wins;
* metadata conflict policy is explicit (preserve, merge, or quarantine);
* a remote head is advanced with an expected-head/generation check;
* untrusted objects are size-limited, hash-verified, and committed only after
  validation.

Conflict copies are preferable to silent loss. A disconnected device may create
local revisions and queue immutable objects, but it must not claim that a remote
head advanced while offline.

## 5. Atomic revision swaps

The filesystem projection must be treated as a materialized cache of a revision,
not as the source of truth. Build a staging tree in the same filesystem, verify
all object hashes and expected file types, fsync files and the staging directory,
then atomically exchange the projection root (or use a journaled per-entry
protocol where the platform cannot exchange roots). Persist `projection_revision`
only after the swap succeeds. Recovery replays the intent journal and chooses
the last fully verified revision; it never infers state from a partially written
directory.

For a single file stub, the minimum safe protocol is: open and verify the source
without following links, copy to a uniquely named vault object, fsync it, create
the replacement link with no-follow validation, fsync the parent directory, and
record the revision. A cross-device copy must not delete the source until the
destination hash and durable metadata are verified.

## 6. OS projection security contracts

These contracts apply to a future macOS File Provider domain and Windows CFAPI
provider, and to the current supervisor while it uses filesystem paths:

1. **Authority:** accept only provider-issued item IDs and paths below an
   allowlisted domain root. Never accept an arbitrary client path as authority.
2. **No-follow resolution:** resolve each component relative to an opened root
   directory using platform no-follow primitives; reject symlinks, reparse
   points, mount crossings, `..`, alternate data streams, and device names.
3. **TOCTOU resistance:** keep an open descriptor/handle from validation through
   read, hash, replace, and metadata capture. Re-stat and compare identity before
   commit; never validate a string path and use it later.
4. **Type and resource limits:** reject unexpected file types, cycles, sparse-file
   surprises, oversized names/objects, and excessive depth. Walkers must not
   follow links or reparse points.
5. **Atomic publication:** stage, hash, fsync/flush, and atomically publish.
   Failure leaves the prior projection and database head usable.
6. **State authenticity:** database rows and provider metadata are advisory until
   the referenced object ID, size, and hash are verified. A symlink target is
   never trusted merely because it contains `VaultData`.
7. **Least privilege:** the provider has access only to its domain and vault,
   binds local control APIs to loopback, authenticates requests, and uses
   origin/CSRF controls for browser callers.
8. **Platform semantics:** File Provider enumerations/change tokens and CFAPI
   placeholders/ hydration callbacks must be idempotent, resumable, and safe to
   retry. Remote disconnects return a retryable/offline status, not an empty
   directory.

## 7. Disconnected-operation policy

* **Offline reads:** serve the last verified local revision and expose its age.
* **Offline writes:** append immutable local events and retain a durable queue;
  never overwrite a newer local head without an expected-head check.
* **Hydration unavailable:** keep the placeholder and return a retryable error;
  do not create a zero-byte substitute.
* **Reconnect:** exchange heads and missing object IDs, verify signatures/hashes,
  perform a three-way merge, and publish only after validation.
* **Permanent conflict:** retain both versions with stable conflict IDs and
  surface them to the user; do not resolve by wall-clock timestamps.
* **Crash/restart:** replay the intent/WAL queue idempotently. Garbage collection
  may remove only objects unreachable from retained heads, queued events, or
  active projections.

## 8. Required observability

Every state transition should record operation ID, actor, expected head,
resulting head, object IDs, provider item ID, and failure class. Metrics should
separate validation failures, conflicts, retryable network failures, and local
I/O failures. Logs must not contain credentials or raw remote URLs.
