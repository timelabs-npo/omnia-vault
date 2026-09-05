# Windows projection architecture

## Product placement and baseline

The requested `evolution/windows11-omnia-v1` branch starts at Omnia's pinned Kudu
evolution head. Additions live under `frontend/Omnia.Windows`, with a Windows CI
workflow and an evolution link. Existing product files, supervisor, semantic core
and sealed audit branch are untouched.

The checked-out macOS product has a React module surface and
`frontend/NebulaVaultNative/Sources/NebulaVaultNative/main.swift`, a Swift CLI.
No separately named RheaPlay host exists at this source revision. The Windows
implementation mirrors the requested product taxonomy and the evolution contract;
it does not copy the legacy Swift deletion path, synthetic metrics or server routes.

## Dependency direction

```text
WinUI views -> Omnia.Host interfaces/presentation -> Omnia.Contracts
                  |                         |
        GET-only projection reader    Kudu CleanTarget normalizer
                  |                         |
        injected host adapter        playbook proposal-only normal form
                  |
        Omnia core/policy/receipts (external; not implemented or modified here)
```

`Omnia.Contracts` has no UI or filesystem dependencies. `Omnia.Host` may read an
embedded source catalog and a configured HTTP projection; it does not resolve any
candidate path. WinUI renders the projection and prepares transient review drafts.

## Boundary owners

| Boundary | Current implementation | Authority |
|---|---|---|
| `IHostState` | `HttpHostState`, one bounded GET on refresh | Observation only |
| `IHostPolicy` | `FrozenHostPolicy` | Always denies mutation |
| `IProposalIntake` | `DisabledProposalIntake` | Returns not accepted; no transport |
| `IReceiptVerifier` | `UnavailableReceiptVerifier` | Cannot establish execution |
| Omnia state head / CAS / receipt durability | External frozen core | Never reimplemented in UI |

Replacing the policy with one returning `Allowed=true` still cannot execute a UI
mutation: the buttons are disabled and no effect handler exists. Future effects
require an independently reviewed host slice, physical qualification, a typed
request boundary and a receipt verifier. The UI has no native effect API to invoke.

## Proposal translation

The bounded adapter consumes pinned Kudu `CleanTarget` fields using their upstream
camelCase spelling. Unknown members and duplicate keys are rejected. The adapter
rejects executable actions, unsupported child traversal, performance cache reset,
missing privilege metadata and a changed upstream revision.

Accepted rules produce `maintenance-proposal/v1`, exactly the companion normal form:

- `effect.authority = proposal_only`; no executable authority enum exists.
- `effect.mode = propose_reclaim`, `destructive = false` for descriptor discovery.
  A decoded proposal may describe `destructive=true`, as the companion schema permits;
  that flag remains a proposal description and never grants capability.
- `filesystem_region` is deliberately conservative. A source label saying cache
  does not establish that the actual data is disposable.
- Elevation changes risk metadata, never permission. Unknown user-data risk persists.
- Required evidence includes provenance, identity, freshness, scope, age, privilege,
  recovery, independent policy and execution receipt. Requiring evidence is not
  evidence that a check ran. Missing `deepRecencyCheck` remains omitted, not false.
- No locator expansion, scanning, target classification assertion or recovery claim.

`MaintenanceCandidate` adds size/age observations, resolved item identity and an
observed expected head outside the playbook proposal. `ProposalRequest` copies these
observations into an ephemeral dry-run request with a new correlation ID. It does
not advance a revision, persist a queue, mint a receipt or manufacture missing IDs.

The Windows projection transport is explicitly a **new adapter contract**. It is
not claimed to be an existing frozen supervisor API. A future adapter must translate
authoritative state into it without changing core schemas or qualification gates.

## Observation and receipt semantics

`known` requires a value and timestamp; observed `0` is displayed as zero. `unknown`
and `unavailable` require no value. `empty` describes a timestamped collection, never
a scalar. `stale` retains prior values with age and a stale label. Five-minute age
checks and future timestamp checks prevent a payload claiming `known` from staying
fresh indefinitely. A stale envelope downgrades nested known observations. A UI
timer updates age labels without polling the host or changing its stored projection.

Host failures produce unavailable projections, not successful empty results.
No local persistence or cached alternate head survives restart.

An operation may have a host-reported status and a receipt containing its ID,
expected/resulting head, outcome, issuer, timestamp, digest and failure class.
Matching receipt IDs, heads, outcomes and non-future times are necessary but not
sufficient for verification. A separate verifier must establish host authenticity
and receipt proof. No Boolean in the HTTP payload can select `Verified`.
The shipped verifier always returns `Unavailable`; even HTTP 200 with a success
receipt remains explicitly unverified. Stale observations cannot earn current
verification. Historical receipt fields remain visible as reported evidence.

## Independent checks and stop boundary

BUILD: .NET/WinUI compilation; VERIFY: standalone xUnit adversarial expectations
plus Python JSON Schema validation of C# normalizer output; DOC: exact source pins,
behavior and limitations; CUT: draft PR only, no merge and no physical gate promotion.
These are separate checks in this delivery, not a claim of independent human or
agent review. The tests do not depend on UI bindings to decide authority.

Parity inputs use independently authored equivalent `CleanTarget` examples for
Darwin/Windows/Linux. The semantic oracle compares intent, effect, risk, target
class, preconditions and evidence; platform family, adapter and locator may differ.
Negative controls deliberately alter risk, evidence and effect. This proves this
bounded translator's semantics, not parity of every upstream platform catalog or
filesystem behavior. Pinned full system catalogs are additionally schema-validated.

The frozen audit contract, golden vectors and `LIT-01..12` are outside this app's
qualification. No application test is evidence for core durability, concurrent CAS,
crash recovery, filesystem scope/reparse safety or execution authorization.
