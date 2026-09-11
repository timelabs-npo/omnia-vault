# Omnia-Vault: Next Session Bootstrap

> This file lives IN the repo so the next conversation can `cat` it and instantly know where we are.
> Last updated: 2026-09-11T02:30 MSK

## Identity

Omnia-Vault is a **cross-platform native desktop application** — a unified control pane for:
1. **SCION network orchestration** via GNS3 Docker topologies
2. **Cloud data defragmentation** across iCloud, Google Cloud, Azure, Microsoft 365
3. **Intelligent system hygiene** — deep scan, cache purge, telemetry wipe, data propagation cleanup

The user calls it "an intelligent network defragmentator / orchestrator / network engineer-mathematician."

## Topology (Reversible)

```
mio.local (macOS, 192.168.0.11) ◄──Ed25519 SSH──► wd.local (Win11Pro, 192.168.0.27)
        │                                                  │
        │  Can run SCION+GNS3 Docker                       │  Currently runs SCION+GNS3 Docker
        │  and serve clean network ──►                     │  in WSL2 Ubuntu (systemd gns3.service)
        │                                                  │
        └──── Both hosts run Omnia-Vault native app ───────┘
```

Either host can be the backbone. The app must support flipping the direction.

## What Works Right Now

| Component | Status | Location |
|---|---|---|
| GNS3 v3.0.6 | ✅ running, enabled | WSL2 on wd.local, systemd `gns3.service` |
| Passwordless SSH | ✅ Ed25519 | mio.local → wheel@wd.local |
| Windows autostart | ✅ Scheduled Tasks | `GNS3-WSL-Autostart`, `GNS3-WSL-Autostart-Logon` |
| GNS3 API | ✅ responding | `127.0.0.1:3080` inside WSL (mirrored networking) |
| macOS .app | ✅ built & installed | `~/Applications/Omnia-Vault.app` |
| Windows .exe | ⏳ CI Matrix Ready | GitHub Actions `.github/workflows/release.yml` |
| Native IPC Socket Server | ✅ Active (0600) | `${XDG_RUNTIME_DIR}/omnia_vault.sock` or `/tmp/omnia_vault.sock` |
| SSH & Backbone Core | ✅ in `ssh_manager.rs` | Rust backend (tunnel supervisor, flip_backbone, reboot) |
| Frontend build | ✅ clean | `npm run build` passes |
| Stack & Credits UI | ✅ Present | "Stack & Credits" tab (Tauri in credentials only) |
| Git | ✅ clean working tree | local commits on `master` |

## Control Flow: Unix Domain Socket IPC

Omnia-Vault backend runs an authorized Unix Domain Socket listener for headless, CLI, and inter-daemon control:
- **Default Path**: `${XDG_RUNTIME_DIR}/omnia_vault.sock` (falls back to `/tmp/omnia_vault.sock`)
- **Permissions**: `0600` (strictly restricted to the local user session)
- **JSON Protocol**:
  - Health check: `{"cmd": "check_daemon_health"}` -> `{"status": "ok", "message": "Omnia-Vault daemon is healthy and running"}`
  - Backbone flip: `{"cmd": "flip_backbone", "args": {"current_host": "mio.local"}}`
  - Tunnel control: `{"cmd": "start_ssh_tunnel", "args": {...}}` / `{"cmd": "stop_ssh_tunnel"}`
  - Node Reboot: `{"cmd": "prepare_and_reboot"}`

Example CLI invocation:
```bash
echo '{"cmd":"check_daemon_health"}' | nc -U /tmp/omnia_vault.sock
```
- Cross-compile via CI (GitHub Actions `release.yml` already has the matrix)
- Or build directly on wd.local (Rust + Node already installed)
- Windows variant must function identically

### Priority 3: Reversible topology
- Button/config to flip: "mio.local serves SCION" vs "wd.local serves SCION"
- Docker-based GNS3 deployment script that works on either host

### Priority 4: Cloud data defragmentation
wd.local has active connections to:
- iCloud (via Apple folder)
- Google Cloud
- Microsoft 365 / OneDrive
- Azure

The "defrag" module should:
- Inventory fragmented data across these endpoints
- Provide unified view and smart cleanup recommendations
- Propagate/sync selectively

### Priority 5: Intelligent system hygiene ("smart cleanup")
- Cross-platform deep cache analysis
- Telemetry/tracking data identification and removal
- Selective data propagation control
- System entropy analysis and recommendations

## Key Technical Facts

- **WSL2 networking mode**: `mirrored` (set in `.wslconfig`)
  - `localhostForwarding` has NO effect in mirrored mode
  - WSL ports are directly on the Windows host's loopback
  - Direct port access from LAN to WSL is NOT possible (Windows firewall shows OK but packets don't route through)
  - **Solution**: SSH tunnel from macOS → Windows, forwarding `127.0.0.1:3080`
- **WSL proxy**: There's an HTTP proxy at `127.0.0.1:10809` inside WSL (from autoProxy). Always use `--noproxy "*"` or `NO_PROXY` for local API calls.
- **GNS3 v3.0 auth**: Uses JWT via `/v3/access/users/login` with `x-www-form-urlencoded`
- **Windows SSH users**: `wheel` (primary), also has `Sirius`, `root`, `CodexSandbox*`, `DevToolsUser`
- **macOS user**: `sa` on `mio.local`

## Repository

```
/Users/sa/limavm/scion/           # Main repo (fork of scionproto/scion)
└── omnia-vault/                   # The app lives here
    ├── src/                       # React frontend
    ├── src-tauri/                 # Rust native backend
    └── .github/workflows/         # CI/CD
```

Git remote `origin` points to upstream `scionproto/scion` (read-only, push will 403).
User needs to either add their own remote or create a new repo.

## Files To Clean Up

```
~/Library/LaunchAgents/com.omniavault.gns3tunnel.plist   # Remove after app manages its own tunnel
~/.omnia-vault/                                          # Logs dir for the plist, can be repurposed
```

## Build Commands

```bash
cd /Users/sa/limavm/scion/omnia-vault

# Dev
npm run dev                    # Vite dev server on :5173
npx tauri dev                  # Native window with hot reload

# Production
npm run build                  # Frontend → dist/
npx tauri build --bundles app  # macOS .app
npx tauri build --bundles msi  # Windows .msi (run on Windows)
```
