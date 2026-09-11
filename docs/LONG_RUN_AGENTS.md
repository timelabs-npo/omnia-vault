# External Antigravity IDE & Trae Long-Run Integration Guide

## Overview
This document specifies how to orchestrate autonomous, continuous long-runs of **Omnia-Vault** across:
1. **Primary macOS Control Node (`bebra@macos` / `mio.local`)**
2. **Secondary Windows Node (`happ@win11pro` / `wd.local`)**
3. **Headless Antigravity IDE & Trae Autonomous Agent Clusters**

---

## 1. Remote Antigravity IDE on Windows (WD)
The Windows node (`192.168.0.27`) runs **Windows 11 Pro** with active WSL2 (`Ubuntu`) hosting GNS3 v3.0.6.

### Recommended Agent Setup
To launch and supervise tasks from an external Antigravity IDE instance or Trae:
- **Workspace path on WD**: `C:\Users\wheel\scion\omnia-vault` (synced via git or WSL shared drive).
- **Socket / IPC Listener**:
  - On Windows, Omnia-Vault runs either with a Named Pipe or an internal loopback port (`127.0.0.1:49152`) restricted to localhost.
  - Commands accept the exact same JSON format:
    ```json
    { "cmd": "get_metrics" }
    { "cmd": "flip_backbone", "args": { "current_host": "wd.local" } }
    { "cmd": "quick_clean" }
    { "cmd": "check_daemon_health" }
    ```

---

## 2. Trae Configuration for Free / Background Agents
When using Trae agents for overnight or long-running tasks:
1. **Daemonized Process Monitoring**:
   - Ensure the agent runs commands with output redirection or detached terminals:
     ```powershell
     Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run", "tauri", "dev"
     ```
2. **Health Check Heartbeat**:
   - Trae agents should execute the heartbeat query every 60 seconds:
     ```bash
     echo '{"cmd":"check_daemon_health"}' | nc -U /tmp/omnia_vault.sock
     ```
3. **Automated Recovery**:
   - If the GNS3 container stops or WSL restarts, the agent triggers:
     ```bash
     wsl -d Ubuntu systemctl restart gns3.service
     ```

---

## 3. Reversible Network Topology & Failover
- If macOS restarts or undergoes an update, the Windows node automatically acts as the primary SCION backbone.
- System metrics and telemetry stream seamlessly into the tray icon on both operating systems.
