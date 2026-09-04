# Omnia Vault (NebulaVault + GCCmp Core)

![Omnia System Concept](https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/Network_topology.svg/512px-Network_topology.svg.png)

*An open-source (MIT) "Operating System" for Multi-Agent Developer telemetry and immutable state storage.*

## The Problem
Modern distributed and AI-augmented software development faces a critical fragmentation problem:
- **Schizo Risks:** Multiple agents (Trae, Copilot, ChatGPT, Antigravity) running locally or in the cloud lack a unified, shared state and context.
- **Session Vulnerability:** When network links drop or instances crash, uncommitted multi-modal work dies in memory.
- **Observability Void:** It's difficult to monitor which LLM processes are burning resources across distributed macOS and Windows machines in real time.

## The Solution
Omnia Vault merges the systemic monitoring capabilities of **NebulaVault** with the robust, content-addressed offline-first core of **GCCmp / Rhea Comparator**. 

### Three Pillar Architecture

1. **Semantic Storage Engine (GCCmp + Redis + Encrypted Containers)**
   - Resolves fragmented AI states.
   - Every file change, log (Log.0), or AI memory artifact is written to a local SQLite WAL.
   - Causal Commit Graph ensures conflict-free merges when network restores.
2. **Systemic Monitor & Command Center (NebulaVault UI)**
   - Built on React/Node.js to visualize local drives, raw cloud (G-Drive, iCloud) limits, and encrypted containers seamlessly.
   - Manages smart caching and maintenance tasks.
3. **Telemetry & Cross-Platform Sync (NDI Pulse)**
   - Lightweight telemetry broadcasting using NDI (Network Device Interface).
   - macOS and Windows machines report CPU, RAM, and LLM process stats.
   - iOS client acts as a zero-latency control board for the distributed cluster.

## Solo Dev Strategy: Avoiding "Schizo Risks"
To prevent cognitive overload when building this massive system alone:
- **Strict Separation of Concerns:** Never mix UI logic with the causal graph. The UI (NebulaVault) is just a dumb viewer of the local SQLite WAL (GCCmp Daemon).
- **No Monolithic Kernel Drivers:** Do not attempt POSIX compliance everywhere. Use native APIs: CFAPI on Windows, File Provider on macOS, and SAF on Android.
- **Incremental Steps:** Start with the SQLite WAL tracking a mock folder, then add the Redis event sourcing, and only later attach the NDI UI.

## License
MIT License. Open research project by Timelabs NPO.

## Sources & Inspirations
- **GCCmp Architecture:** Immutable content repository, Causal DAGs, disconnected operation principles.
- **NDI Protocol:** Low-latency LAN broadcasting originally for AV, repurposed for system telemetry.
- **CRDTs (Conflict-free Replicated Data Types):** For robust multi-agent state merging without central authority.
