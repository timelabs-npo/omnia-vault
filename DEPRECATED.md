# Deprecated Tasks and Architecture

As of Phase 2, the following approaches and implementations are considered **DEPRECATED**. 

This document serves as an audit trail for developers and contributors cloning this repository.

## 1. Node.js System Metrics (Replaced)
**Status**: Deprecated & Removed
**Legacy implementation**: 
Previously, `NebulaVault.app/server/storageEngine.js` used fragile shell commands (e.g., `exec('vm_stat')`, `exec('df -h')`) to calculate available memory and storage. 
**New Implementation**:
We now use the `supervisor` (Rust daemon). It uses the `sysinfo` crate for instantaneous, cross-platform metrics retrieval and exposes them over HTTP (`:4000/metrics`).

## 2. Node.js Cloud Directory Scanning
**Status**: Deprecated & Replaced
**Legacy implementation**:
Node.js was crawling the file system synchronously or shelling out to find heavy files in iCloud and Google Drive.
**New Implementation**:
The Rust daemon now uses `walkdir` to asynchronously and safely crawl large directory trees without locking the UI or crashing the V8 engine due to memory exhaustion (`:4000/cloud/scan`).

## 3. Mocked UI Data
**Status**: Partially Deprecated
**Legacy implementation**:
The React UI was using mocked sets of heavy files and mock "stubbed" files to simulate GCCmp functionality.
**New Implementation**:
The UI (`CloudCommanderView.jsx`) now fetches genuine file system data from the Rust supervisor. The "Stub" buttons currently trigger the API, and Phase 3 will replace the remaining mock functions with actual GCCmp causal-tree stubbing logic.

## Summary for Auditors
If you are joining this project:
1. Do not add any new `exec()` calls in Node.js.
2. All OS-level interactions (file scanning, moving, stubbing, metric gathering) MUST be routed through the Rust `supervisor`.
3. The React frontend should only interface with the Node.js proxy, which securely passes requests down to the Rust layer.
