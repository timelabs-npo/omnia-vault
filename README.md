# Omnia-Vault

**Network defragmentation, orchestration, and intelligent system hygiene.**

Cross-platform native desktop application for managing SCION-based network infrastructure, cloud data orchestration, and deep system cleanup across macOS and Windows 11 Pro environments.

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                        OMNIA-VAULT                                 │
│  Native Desktop App (macOS .app / Windows .exe)                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Network      │  │  Cloud       │  │  System Hygiene          │ │
│  │  Orchestrator │  │  Defrag      │  │  Engine                  │ │
│  │              │  │              │  │                          │ │
│  │  SCION paths │  │  iCloud      │  │  Cache purge             │ │
│  │  GNS3 topo   │  │  Google      │  │  Telemetry wipe          │ │
│  │  VPN isol    │  │  Azure       │  │  Data propagation        │ │
│  │  SIG routing │  │  Microsoft   │  │  Deep scan & cleanup     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────────┘ │
│         │                 │                      │                 │
├─────────┴─────────────────┴──────────────────────┴─────────────────┤
│                       SCION + GNS3 Docker                          │
│              (runs on EITHER host — reversible)                    │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│   ┌─────────────────────┐      ┌─────────────────────┐            │
│   │  mio.local (macOS)  │◄────►│  wd.local (Win11Pro) │            │
│   │  Ed25519 SSH        │      │  WSL2 Ubuntu         │            │
│   │  192.168.0.11       │      │  192.168.0.27        │            │
│   └─────────────────────┘      └─────────────────────┘            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

## Hosts

| Host | OS | Hostname | IP | Role |
|---|---|---|---|---|
| Mac Studio | macOS | `mio.local` | 192.168.0.11 | Primary workstation, can be SCION orchestrator |
| Desktop | Windows 11 Pro | `wd.local` | 192.168.0.27 | Hypervisor (WSL2), cloud endpoints |

**Reversible topology**: Either host can run the SCION+GNS3 Docker backbone and serve clean network to the other.

## Cloud Endpoints (via wd.local)

- Apple iCloud
- Google Cloud
- Microsoft 365 / OneDrive
- Azure

## Current State

- **GNS3 Server**: v3.0.6 running in WSL2 Ubuntu on `wd.local`, managed by `systemd` (`gns3.service`, enabled)
- **Connectivity**: Passwordless SSH (`Ed25519`) from `mio.local` → `wd.local`
- **Windows autostart**: Scheduled Tasks `GNS3-WSL-Autostart` + `GNS3-WSL-Autostart-Logon`
- **GNS3 API**: `http://127.0.0.1:3080` (local to WSL, mirrored networking mode)
- **Native app**: Built and installed at `~/Applications/Omnia-Vault.app`
- **Git**: 3 local commits on `master` ahead of upstream

## Build

```bash
# Frontend
npm run build

# Native app (macOS)
npx tauri build --bundles app

# Native app (Windows) — via CI or local
npx tauri build --bundles msi,nsis
```

## Project Structure

```
omnia-vault/
├── src/                    # React frontend
│   ├── App.tsx             # Main application UI
│   └── index.css           # macOS System Settings styling
├── src-tauri/              # Rust native backend
│   ├── src/
│   │   ├── lib.rs          # App runtime, commands, tunnels
│   │   └── main.rs         # Entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Bundle & window config
├── .github/workflows/
│   └── release.yml         # CI/CD → GitHub Releases (macOS + Windows)
└── package.json            # Frontend deps
```

## Credits & Technology Stack

| Component | Technology | License |
|---|---|---|
| Native runtime | [Tauri](https://tauri.app) v2.11 | MIT / Apache-2.0 |
| Frontend framework | [React](https://react.dev) v19 | MIT |
| Build toolchain | [Vite](https://vitejs.dev) v8 | MIT |
| TypeScript | [TypeScript](https://typescriptlang.org) v6 | Apache-2.0 |
| Icons | [Lucide](https://lucide.dev) | ISC |
| Rust compiler | [Rust](https://rust-lang.org) 1.98 | MIT / Apache-2.0 |
| Networking | [SCION](https://scion-architecture.net) | Apache-2.0 |
| Network simulation | [GNS3](https://gns3.com) v3.0.6 | GPL-3.0 |
| Containerization | [Docker](https://docker.com) (WSL2) | Apache-2.0 |
| CI/CD | [GitHub Actions](https://github.com/features/actions) | — |
| SSH transport | OpenSSH (Ed25519) | BSD |
| macOS bundling | Xcode Command Line Tools | Apple EULA |
| Windows subsystem | WSL2 (Ubuntu) | Microsoft EULA |
| Cloud integrations | iCloud / Google Cloud / Azure / Microsoft 365 | Respective TOS |
