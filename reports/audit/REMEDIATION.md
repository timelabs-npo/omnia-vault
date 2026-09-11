# Omnia Vault Remediation Plan

This report turns the architecture audit into semantic fixes. Priority is
**P0** for integrity/security boundaries and **P1** for deterministic sync.

## P0 — eliminate unsafe filesystem authority

### R-001: Replace client paths with capability-scoped item IDs

**Current evidence:** `supervisor/src/main.rs:35-38, 209-224` accepts an arbitrary
`file_path` and hashes that string into a vault filename.

**Fix:** configure a vault/domain root at startup; resolve provider-issued item
IDs beneath it with no-follow directory handles. Reject absolute paths, `..`,
symlinks, mount/reparse crossings, and paths outside the root. Store the
canonical relative item ID in state.

**Why required:** the OS projection authority and least-privilege contracts in
`docs/ARCHITECTURE_DEEP_DIVE.md` prevent sandbox escape and path substitution;
descriptor-relative no-follow resolution is the TOCTOU defense.

### R-002: Make stub and restore transactional and hash-verified

**Current evidence:** `supervisor/src/main.rs:226-235` falls back to
copy/delete and creates a symlink before the database write; restore removes
the link before `:282-297` completes.

**Fix:** write a unique staged object on the same volume, fsync it and its
directory, verify size and SHA-256 from the opened source/destination, then
publish the projection atomically. Add an intent record before the filesystem
operation and mark it complete only after the SQLite row and projection agree.
Recovery must resume or roll back intents idempotently.

**Why required:** Git/IPFS immutable-object semantics require verified object
identity; ZFS-style transactional publication requires the old view to remain
usable after a crash. Copy/delete is not atomic and can lose data on power
failure.

### R-003: Never trust symlink text during restore

**Current evidence:** `supervisor/src/main.rs:273-280` restores whatever target
the user-controlled symlink names, and `:176-185` classifies targets by a
substring.

**Fix:** load the authoritative row by item ID, require an exact vault object
ID, verify the target is beneath the configured vault root, reject links whose
`lstat` identity differs from the recorded projection, and verify the object
hash before replacement. Treat mismatches as quarantine/manual repair.

**Why required:** state-authenticity and no-follow contracts prevent symlink
redirection, confused-deputy writes, and state manipulation.

### R-004: Remove hard-coded host paths and unsafe startup defaults

**Current evidence:** `supervisor/src/main.rs:56, 203` uses a developer-specific
absolute path; `:128-130` falls back to `/Users/sa`.

**Fix:** require configured roots, validate them at startup, fail closed when
they are absent, and persist the device/domain identity separately from paths.

**Why required:** deployment isolation and least privilege require explicit
resource boundaries; a fallback can write outside the intended sandbox.

## P1 — make the repository a deterministic Merkle history

### R-005: Use canonical object, tree, and revision IDs

**Current evidence:** `frontend/server/core/gccmp_daemon.js:60-80` hashes only
event content, creates time/random manifest and commit IDs, and leaves
`parent_id` null (`:77`).

**Fix:** define a versioned canonical encoding for blobs, sorted tree entries,
metadata, and revisions. Hash the encoded bytes; record all parent IDs and a
logical clock. Add a single durable head with generation/expected-head CAS.

**Why required:** Git Merkle-DAG and IPFS CID properties require identity to be
determined by content and references, not wall-clock randomness. Explicit
parents are necessary for causal reconciliation.

### R-006: Commit related writes in one database transaction

**Current evidence:** `commitEvent` executes three independent inserts
(`:69-80`) and does not enable foreign-key enforcement.

**Fix:** wrap blob, manifest/tree, revision, and head update in one transaction;
enable foreign keys; use constraints for canonical IDs and parent existence.
Readers should select a head and its complete reachable graph consistently.

**Why required:** SQLite WAL protects one database transaction, but it does not
join unrelated writes. Atomic revision swaps require a single commit boundary.

### R-007: Replace timestamp ordering with three-way reconciliation

**Current evidence:** `getLatestCommits` orders by `created_at`
(`frontend/server/core/gccmp_daemon.js:85-92`); no merge or common-base logic
exists.

**Fix:** exchange head IDs and missing objects, find a common ancestor, perform
path/metadata-aware three-way merge, and create a multi-parent merge revision.
Represent conflicts explicitly and retain both object IDs.

**Why required:** wall-clock last-writer-wins is nondeterministic under clock
skew and violates causal ordering; Git-style ancestry and explicit conflicts
are the industry-standard remedy.

### R-008: Separate the UI projection from authoritative state

**Current evidence:** `frontend/server/storageEngine.js:34-46, 168-171` serves
`mockLocalFiles` while the supervisor and GCCmp databases hold other state.

**Fix:** derive `/api/files` from a verified projection index, include the
revision/change token, and make mutations update the authoritative journal
before returning success. Remove mock entries from production paths.

**Why required:** File Provider and CFAPI enumerate durable change tokens and
retry idempotently; a mutable in-memory list cannot provide those guarantees.

## P1 — harden traversal and network boundaries

### R-009: Make scans no-follow, bounded, and race-resistant

**Current evidence:** `scan_directory` uses `WalkDir` and explicitly includes
symlinks (`supervisor/src/main.rs:158-186`), then follows target metadata
(`:177-179`).

**Fix:** do not follow symlinks/reparse points, enforce depth/count/size
budgets, detect cycles by file identity, and hash/open files through stable
handles before reporting them. Return partial-scan status rather than silently
dropping errors.

**Why required:** this is the symlink-loop, resource-exhaustion, and TOCTOU
contract at the OS boundary.

### R-010: Authenticate local control APIs and constrain browser access

**Current evidence:** the supervisor binds loopback (`main.rs:82`) but has no
request authentication; the Node proxy sets wildcard CORS
(`storageEngine.js:109-112`).

**Fix:** use an OS-protected per-user capability/token or authenticated IPC,
validate request size/content type, and replace wildcard CORS with an explicit
origin plus CSRF protection for state-changing requests.

**Why required:** loopback is not an authentication boundary; any local process
or malicious webpage can otherwise invoke destructive projection operations.

## P2 — disconnected operation and lifecycle

### R-011: Add durable offline queue and retry semantics

Persist local mutations and remote sync intents with idempotency keys, explicit
retryable/permanent errors, and last-verified-head metadata. On reconnect,
exchange missing objects, verify them, merge, and publish via expected-head CAS.
Never report a remote commit while offline or replace a missing hydrated file
with an empty file.

**Why required:** the disconnected-operation policy in the deep dive preserves
availability without sacrificing causal integrity.

### R-012: Define safe garbage collection and audit telemetry

Retain objects reachable from all protected heads, queued events, conflict
records, and active projections. Add operation IDs, expected/resulting heads,
object IDs, and failure classes to audit events; redact credentials and remote
URLs.

**Why required:** immutable stores need reachability-based GC, and production
reconciliation needs evidence that state transitions were authorized and
replayable.
