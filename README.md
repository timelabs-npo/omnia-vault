<p align="center">
  <img src="docs/readme/hero.svg" alt="Omnia Vault — The Cave Remembers" width="100%" />
</p>

<h1 align="center">OMNIA VAULT</h1>
<p align="center"><strong>THE CAVE REMEMBERS.</strong></p>
<p align="center"><em>Bytes survive the weather. State survives the argument.</em></p>

<p align="center">
  <a href="https://blueshoes.space/rhea/">Rhea Pantheon</a> ·
  <a href="docs/ARCHITECTURE_DEEP_DIVE.md">Architecture Deep Dive</a>
</p>

---

Agents crash. Clouds disappear. Laptops sleep. Network links lie. Two machines can both be absolutely certain they own “the latest version” and both be wrong.

**Omnia Vault is an immutable-first storage experiment for making that kind of disagreement explicit instead of silently destructive.**

The long-term target is a content-addressed, causally ordered state substrate that can work disconnected, reconcile deliberately, and project verified revisions back into native operating-system file surfaces.

```text
bytes
  │
  ▼
content hash
  │
  ▼
immutable objects ───────► causal parents
  │                            │
  └──────────────┬─────────────┘
                 ▼
             revision
                 │
        expected-head / generation
                 │
                 ▼
          atomic publication
                 │
                 ▼
        verified projection
```

## Why the cave?

Rhea hides the infant Zeus in Crete while Cronus consumes the children he believes will replace him. The engineering translation is intentionally simple:

> **What must survive cannot depend on the thing currently trying to consume it.**

The Vault is the cave: a place where state is preserved by identity, ancestry, and evidence rather than by somebody's confident memory of what happened last.

No, this is not an etymological claim that “Rhea literally means flow.” The Greek name `Ῥέα` has attracted that association for centuries; the project's architecture does not depend on the wordplay being philologically settled.

## Target invariant

A production revision should be derivable from canonical bytes and explicit parents rather than wall-clock vibes:

```text
blob     = H(algorithm || length || bytes)
tree     = H(canonical(sorted(entries)))
revision = H(schema || author || logical-clock || parent-ids || tree-id)
```

A head advances only after the candidate revision is complete and validated, and only if the expected head/generation still matches.

**Conflict is data. Silent overwrite is data loss.**

## Reality receipt: what exists today

This repository is **not yet a production synchronization engine**.

The current checkout contains two independent prototype data paths:

- a Node/SQLite path that stores event bytes, manifests, and commits;
- a Rust supervisor path that records stubbed files in a separate SQLite database and performs POSIX-style move/copy + symlink projection.

SQLite WAL is enabled in the Node path, and event bytes receive SHA-256 content hashes. But the current implementation does **not** yet provide the complete target causal model:

- commit ancestry is not a real causal DAG;
- manifest/commit identities are not fully deterministic content-derived revision identities;
- no atomic compare-and-swap head currently closes the publication protocol;
- filesystem effects and the two databases are not one transaction;
- deterministic peer reconciliation is not implemented;
- native macOS File Provider and Windows CFAPI providers are not present in this checkout.

That gap is documented deliberately in [`docs/ARCHITECTURE_DEEP_DIVE.md`](docs/ARCHITECTURE_DEEP_DIVE.md). The deep dive is the receipt; this README is not allowed to overrule it.

## The design contract

### 1. Immutable before distributed

Do not synchronize mutable ambiguity faster. Establish canonical object identity first.

### 2. Causality before “latest”

A timestamp is not ancestry. A merge without a recorded base and parent set is a story, not a revision.

### 3. Projection is a cache

The visible filesystem should be a materialized projection of a verified revision, not the ultimate source of truth.

### 4. Offline is a state, not an exception

Disconnected writes may append local immutable work. They may **not** claim that a remote head advanced while nobody was connected to it.

### 5. Native OS boundaries matter

Future File Provider / CFAPI work must preserve provider-issued identity, no-follow path resolution, TOCTOU resistance, bounded resources, retry-safe hydration, and atomic publication semantics.

## Where this wants to go

```text
                 OMNIA VAULT
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
   immutable       causal       durable
     CAS           revisions     receipts
       │             │             │
       └─────────────┼─────────────┘
                     ▼
             reconciliation
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
   native projection        remote object exchange
 macOS / Windows / BSD      cloud / peer / removable
```

The desired end state is boring in the best possible way: unplug a machine, reconnect it, crash it mid-write, retry the same operation, and still be able to explain **exactly which bytes became state and why**.

## The Rhea family

| Project | Mythic role | Engineering role |
|---|---|---|
| **Rhea Project** | Rhea / succession | staged architecture + authority boundaries |
| **Rheknel** | the stone | deterministic invariant gate |
| **Omnia Vault** | the Cretan cave | immutable-first state preservation |
| **Omnia Playbook** | the Kouretes' dance | checks, invariants, procedures |
| **Blueshoes** | open terrain | Flow Surgery + adaptive routing research |

Explore the public family map at **https://blueshoes.space/rhea/**.

## License

MIT. Open research project by Timelabs NPO.

---

<p align="center"><strong>THE CAVE REMEMBERS WHAT THE NETWORK FORGOT.</strong></p>
