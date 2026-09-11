# The real System Settings pane

## What was observed

System Settings was inspected through its live accessibility tree. It contained the selected **Blueshoes** row and its actual controls, plus a separate **NDI Output** row. The installed bundles exist at `~/Library/PreferencePanes/Blueshoes.prefPane` and `/Library/PreferencePanes/NDI Output.prefPane`. This is evidence of a real pane, not just a screenshot of a similar window.

The relevant source is `/Users/sa/scion/OmniaWorkspace/BlueshoesPane/BlueshoesPane.swift`. Its class inherits from `NSPreferencePane`. The reviewed source was not rebuilt or matched byte-for-byte to the installed binary. No switch or test/cleanup button was pressed during the review.

## Every visible function

| Current element | Finding | Correction |
|---|---|---|
| Blueshoes: The New World Order | Unhelpful slogan, source line 15 | Timelabs, with a short description of the settings |
| Bare-Metal SCION Multi-Host Mesh Controller | Unsupported implementation claims in the main heading, line 21 | Connection and file settings |
| Mac valve checkbox | Runs `scionctl.py open-mac/close-mac`, lines 143–146 | Identify the actual installed daemon and name its real action; do not equate this with the Tauri proxy switch |
| Windows valve checkbox | Runs `open-win/close-win`, lines 149–152 | Identify the actual Windows/WSL implementation and its real effect; a saved flag is not a traffic control |
| Fire L2 SCION Test Frame (EtherType 0x3082) | Calls custom `scionctl.py fire`, lines 155–157 | Remove from normal settings; a replacement Run connection check must perform a real, supported check and report what it checked |
| Launch GNS3 Topology Server (:3080) | Opens `/Applications/GNS3.app`, lines 160–161 | Open GNS3; do not claim that merely opening the app starts a server |
| Launch scion-top Terminal Monitor | Runs the custom `scionctl.py` terminal interface, lines 164–167 | Open network details, or Open terminal monitor in developer tools; identify this as a custom helper |
| Live telemetry and diagnostics text | Dumps CLI output into a fixed-height label | Show structured status and last update; put selectable logs in Details |
| Checkmark/status refresh | Reads substrings in stdout, lines 132–133 | Use a structured response and distinct On, Off, Unknown, Failed states |
| Layout | Fixed frames in a 668×560 container; long button/log text has little room | Native layout constraints, correct scrolling and resizing; no clipped controls |

## Different controls currently share one name

The reviewed `/Users/sa/scion/mio_valve.py` handles OPEN by calling `limactl start scion-dev` and spawning GNS3 server; CLOSE stops that VM and runs `pkill -f gns3server`. It ignores process exit failures and then writes a status file. These are significant service actions. Do not expose them as a generic connection toggle or broadly kill every matching server. Identify and manage only the intended process and VM, with active-work checks.

The reviewed `/Users/sa/scion/windows_wsl/wd_valve.py` writes OPENED/CLOSED to a temporary status file. It does not change routing in that file. There is also a Rust implementation in the tree. The live pane reported `STATUS_VALVE_OPENED`, while this Python file returns `STATUS_OPENED`. Therefore the deployed Windows daemon must be identified before assuming this file is the running one. Do not overwrite a working deployment based on this source mismatch.

The Tauri controls in `control.rs` have different effects: the Mac control changes automatic proxy settings; the Windows control manages a local GNS3 SSH tunnel. Reusing the same two labels across both surfaces gives the user no reliable way to predict the effect.

## Fix execution and status

- `sendValveCommand` accepts host/port arguments but does not use them; the CLI chooses hardcoded targets. Remove misleading parameters or route through actual target configuration.
- Its synchronous `waitUntilExit` runs from button handlers and can freeze the settings pane. Run work in the background, drain output while the process runs, handle launch/exit errors, and enforce a deadline.
- Read stdout and stderr safely, return a structured result, and propagate nonzero exit status. The CLI currently prints some failures without making the process fail.
- `refreshState` runs at load and after actions; no continuous refresh is established here. Do not label old output live. Show age, refresh on activation, and stop background collection when appropriate.
- The Windows status substring differs from the checked Python response. Unknown status must not silently become Off. Match the deployed protocol and version.
- In `scionctl.py`, GNS3 version and projects calls use `/v3/version` and `/v2/projects` respectively. Check the installed API before selecting endpoints. Failed project queries must not become a successful zero-project result.
- The CLI memory calculation uses total minus free pages; do not call it memory pressure. Measure memory with a documented definition and handle read failures as unavailable.
- `fire` tries a local Rust binary or a local socket. That dispatch alone does not establish wire delivery. Keep experimental raw-frame claims separate from stock SCION path and application checks.

The old Swift menu app is another source tree under `OmniaWorkspace/OmniaVaultMac`. Antigravity's current conversation says it was replaced by the Tauri build. Do not patch or launch it by accident. If it remains shipped, include it in the same status, label, action, and build-provenance checks.

## Completion check

Open the real installed pane from the corrected menu. Confirm the displayed version belongs to the rebuilt pane, each control affects its named target, failed commands are visible, no UI freezes, long text remains readable, and closing the settings window does not interrupt ongoing work. Preserve the third-party NDI pane; removing the app's copied NDI page is not permission to uninstall NDI.
