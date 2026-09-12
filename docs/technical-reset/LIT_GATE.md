# LIT-001: admission gate blocked

**No LIT publication or verified LIT chain has been issued for this technical reset.** The original contract package was located and compared with both local implementations before any store command was executed.

## Original package

The recovered `v2/01_contracts/lit/` package includes `LIT_RECEIPT_V1.md`, `LIT_INIT_V1.md`, `LIT_FREEZE_CANDIDATE_V1_R2.md`, `LIT_FULL_PACKAGE_V1_R2_AUDIT.md` and `OMNIA-LIT-001_HANDOFF.md`. The companion specification is `v2/docs/TECH_SPEC_LIT_001.md`.

R2 calls itself a candidate for full-package review and **NOT_FROZEN**. It is a review-package revision, not a new byte protocol. Its advisory audit does not admit a runtime: the controller gates remain unexecuted and later stages locked. The handoff suggests an implementation/test-adapter location; it does not identify a qualified executable.

The proposed reference for refinement is this recovered candidate, subject to its acceptance work. A self-declared implementation version cannot silently replace it.

## Reproducible source findings

| Check | Recovered candidate | Supervisor prototype | Tauri prototype |
| --- | --- | --- | --- |
| Publish receipt | 243 bytes and exact field/rejection rules | 258 bytes, additional actor field and different order | 243 bytes, but required parser/request/transition checks are missing |
| Bootstrap receipt | 225 bytes, with the required profile binding | 206 bytes; profile binding absent | No demonstrated conformance to the recovered bootstrap contract |
| Owner/actor profile | Same bytes in the restricted profile | Separate values permitted | Matching receipt length alone does not qualify ownership or behavior |
| Same operation, different request | Reject | Request comparison exists, but other rules differ | Cached receipt can be returned without the required request comparison |
| Historical replay cleanup | Required rollback/idle cleanup before returning original bytes | Replay uses COMMIT | Required behavior is not established |
| Retained state and conflict | Full retained tree; conflict must not publish submitted content | Different canonical encodings/profile | Changed-item-only revision mapping and premature content insertion conflict with the candidate |

These are source findings, not completed runtime fault tests. The supervisor was copied to an isolated source snapshot and compiled with its locked dependencies as a tooling check. It was not admitted as the LIT engine. **No `init`, `publish`, or other store command was run; no production store was accessed.**

The supervisor's extra features do not repair its wire incompatibility. The Tauri receipt's correct length does not repair its missing semantic checks. Neither can currently supply a chain labeled compliant with the recovered candidate.

## Required next verification sequence

1. Pin the candidate documents, vectors, profile, rejection order and acceptance decisions by exact digest. Resolve the contract's remaining acceptance items without silently changing its byte format.
2. Establish an independent oracle for canonical encoding, request binding, init, replay, conflict, retained-tree reads and deterministic rejection. Do not derive both expected bytes and implementation from the same unchecked helper.
3. Qualify one implementation against that contract and its fault/cleanup/durability cases. Record source and executable digests. Do not migrate an existing database as part of qualification.
4. Use a fresh, verified host-local **nonsynced** disposable store for admitted tests. The Documents workspace is not assumed nonsynced. Export only a quiesced or SQLite-consistent snapshot, including the required sidecars or proper backup operation.
5. For each artifact, capture its exact input bytes and prior accepted head. Publish through the admitted interface, require the actual committed outcome, recover the operation receipt, check its canonical fields and request binding, and read the artifact at its explicit resulting revision.
6. Compare the readback byte-for-byte. Confirm the prior-to-result revision relation, retained earlier artifacts, conflict behavior and store integrity. An inspection hash is not a commit acknowledgement.
7. Only then publish the next acceptance record linked to the prior accepted revision and evidence. A missing acknowledgement stays uncertain; reconcile the same operation before retrying. Do not invent a new receipt with guessed success.

The intended chain is **requirement → accepted technical revision → scoped operation → observed evidence → acceptance decision**. Publication proves that exact evidence bytes were retained under the admitted contract. Actual network delivery, application success, durability, identity, encryption and external tamper resistance each require their own evidence.

## Current chain status

| Stage | Status |
| --- | --- |
| Locate and compare source contracts | Completed as a source audit |
| Admit a LIT contract and engine | Blocked |
| Publish refinement artifacts through admitted LIT | Not started |
| Verify and accept a LIT revision chain | Not started |
| Resume macOS implementation | Unlocked |

The ordinary hashes accompanying this package preserve document identity while this gate is blocked. They are explicitly not LIT receipts and do not bypass the gate.
