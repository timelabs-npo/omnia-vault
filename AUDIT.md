# Omnia Vault: External Audit Guide

Welcome to the external audit for **Omnia Vault**. This document serves as a guide for AI agents (like Codex or Gemini) and human contributors reviewing this repository for hallucination prevention, bug identification, and architecture validation.

## Architecture Overview

Omnia Vault is a dual-tier storage orchestration system:
- **Frontend / Proxy (Node.js)**: Runs on port `3001`. Handles UI requests and aggregates metrics. Serves a React frontend on `localhost:3000`. Located in `frontend/server/storageEngine.js`.
- **Local Supervisor (Rust)**: Runs on port `4000`. Acts as the primary daemon for real system interactions. Located in `supervisor/`. Uses `axum` for HTTP API routing and `rusqlite` for persistent state storage.

## Recent Architectural Shifts

In the current implementation phase, several core concepts were shifted to improve data safety and consistency:
1. **GitHub-First Storage**: The Vault directory, previously hardcoded to `~/.nebula_vault_store`, was moved to `omnia-vault/VaultData` to ensure the stubbed payloads are encapsulated inside the working directory and can be pushed/synced easily with GitHub.
2. **SQLite State Tracking**: A lightweight SQLite database (`vault_state.db`) has replaced the legacy `manifest.json`. This database tracks which files are currently stubbed, containing the symlink target path, the original file size, and the stubbing timestamp.

## Checklist for Audit

When auditing the repository, please verify the following critical components:

### 1. `cloud_stub_handler` (Rust: `supervisor/src/main.rs`)
- **Action**: Moves large files out of the local OS namespace into `VaultData` and creates a symlink in their original place.
- **Audit Focus**: 
  - Are symlinks created atomically? 
  - Is `fs::rename` properly handling cross-device links? (We currently use a `copy` and `remove` fallback if `rename` fails).
  - Is the `rusqlite` insert properly maintaining causal consistency for the `stubbed_files` table?

### 2. `cloud_restore_handler` (Rust: `supervisor/src/main.rs`)
- **Action**: Re-hydrates stubbed files, moving the physical payload from `VaultData` back to its original path and removing the symlink.
- **Audit Focus**: 
  - Are we safely removing the symlink before renaming the actual file back?
  - Does the SQLite database cleanly `DELETE` the row, leaving no dangling state?

### 3. Node.js Proxy (`frontend/server/storageEngine.js`)
- **Action**: Relays `/api/offload` and `/api/hydrate` to the Rust daemon's `/cloud/stub` and `/cloud/restore`.
- **Audit Focus**:
  - Is the JSON payload properly translated between the proxy (using `fileId`) and the Rust daemon (using `file_path`)?
  - Note: Previously there was a JSON serialization error due to using `path` instead of `file_path`. This was patched, but verify no edge cases remain.

## Audit Commands

You can run the following to verify the current state:

**1. Inspect the Database:**
```bash
sqlite3 supervisor/vault_state.db "SELECT * FROM stubbed_files;"
```

**2. Check Active Symlinks in test folder:**
```bash
ls -la ~/Downloads/
```

**3. Build and Test the Rust Daemon:**
```bash
cd supervisor
cargo build
cargo test
```

## Known Limitations / "Hallucination" Risks
- The frontend currently utilizes an in-memory `mockLocalFiles` array to display the UI. Real filesystem traversal (e.g. `walkdir` in Rust) has not been connected to the UI yet. Ensure that the proxy integration strictly relays real data rather than returning mocked `stubbed: true` states prematurely.
- There is currently no file watcher to track if a user manually deletes a symlink. 
