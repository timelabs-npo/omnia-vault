# Backend correction brief for Antigravity

## Scope and decision

Read EXTRA_COMMAND_REVIEW.md with this file. Follow-up inspection confirmed that all four SSH helper functions are reachable through the active socket server, which also has a Windows TCP branch. Being absent from the Tauri registration does not make a function unreachable.

Read-only review of `control.rs`, `metrics.rs`, `tray.rs`, `lit.rs`, `ssh_manager.rs` and `lib.rs` under `/Users/sa/scion/omnia-vault/src-tauri/src`. No app command, cleanup, database write, SSH session, reboot or network test was run. This checkout has not been matched to the installed binary. A reported successful SCION test remains a user report; the findings below concern what this backend returns and does.

**Keep a control only when it performs a useful, named action and reports its real result. Remove fabricated live data and unsupported action claims from the working UI.** NDI may remain as a label or reference, but there is no NDI stream implementation in these files. Keep required dependency notices in About/Licenses; technical credits do not need to occupy operational screens. This is not an instruction to delete license notices.

## Findings, corrections and acceptance

### 1. P0 — SCION tables and flow numbers are fixed sample data

**Evidence:** [control.rs:118](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:118) selects fixed traffic totals, path counts and latency from two Bool values. [control.rs:250](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:250), [327](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:327) and [359](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:359) return literal daemon, path and topology lists. They do not query SCION or GNS3. The tray initially claims active valves and blended SCION before collecting anything ([tray.rs:14](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:14)).

**Correction:** remove these values from production responses, or put them behind an explicit demo mode. Return unavailable/not connected until a collector supplies a source, target and observation time. Do not turn configured topology into running topology.

**Acceptance:** with all collectors disconnected, no running daemon, active path, traffic total or latency appears as a live fact. A test fixture is visibly marked Demo and cannot drive an action.

### 2. P0 — a valve action changes something different from its claimed result

**Evidence:** the local flag starts `true` ([control.rs:9](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:9)). Its action sets that flag before issuing `networksetup`, ignores errors, edits only a hardcoded Wi-Fi service, and logs that traffic is routed through SCION ([control.rs:162](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:162)). Turning it off disables auto-proxy; it does not restore the previous configuration. The Windows Bool comes from the PID of a local launch agent, not remote readiness ([control.rs:120](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:120)). Tunnel start/stop ignore failures; restart returns `Ok` even after a non-zero kickstart result ([199](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:199), [240](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:240)).

**Correction:** name the actual actions, such as “Set proxy for this network service” and “Start local GNS3 tunnel.” Separate requested state, applied configuration, local process state, remote API reachability and tested payload delivery. Save/read back the affected settings. Return command failures; do not infer a route from a PID or a TCP connect.

**Acceptance:** failed commands leave no success flag; Ethernet and renamed services are handled explicitly; disable restores the saved state or states exactly what it changes; a running local process with an unreachable helper is not “Windows active.”

### 3. P0 — NDI restart claims a stream that it never starts

**Evidence:** defaults say enabled when the settings file is missing or unreadable ([control.rs:396](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:396)). `restart_ndi_stream` only writes a JSON file and returns “restarted” and “Broadcasting” ([414](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:414)). There is no SDK call, process restart or receiver check in that function.

**Correction:** remove the Restart/Broadcast action from operational UI while NDI remains a reference. If the settings editor has a purpose, call the result “Settings saved”; do not label a file-write timestamp as a stream restart.

**Acceptance:** no NDI runtime installed means no claim of an enabled stream, successful restart or broadcast. A malformed file is a visible settings error, not enabled defaults.

### 4. P0 — Quick Clean can report success after failed deletion

**Evidence:** [metrics.rs:197](/Users/sa/scion/omnia-vault/src-tauri/src/metrics.rs:197) counts entry sizes before deletion, removes whole log/cache directories, ignores removal/recreation errors, and returns successful cleanup text. Its temporary-file pass checks names, not age or active ownership. The estimate scans a different set of files and forces a minimum of 12 MB ([168](/Users/sa/scion/omnia-vault/src-tauri/src/metrics.rs:168)). Tray cleanup discards the result ([tray.rs:86](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:86)). No Mole executable is invoked by this action.

**Correction:** replace “Wipe Caches (Mole)” with a precise owned-resource action. Use the same eligibility rules for preview and execution, skip active/unknown files, preserve queues and current incident logs, and report errors and confirmed removals. Do not claim measured disk space freed from directory-entry sizes.

**Acceptance:** an empty cache estimates zero; a permission failure reports failure/partial completion; an active matching `.tmp` file survives; no failed deletion contributes to removed-byte totals.

### 5. P1 — “System Settings” opens an internal tab

**Evidence:** [tray.rs:17](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:17) labels the item “NDI Output (System Settings).” The handler only shows the Tauri window and emits `navigate-tab: control_pane` ([62](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:62)). The existing real NSPreferencePane is a separate surface.

**Correction:** either open the actual installed preference pane or call this item “Open settings” and make clear it is app settings. Do not replace the working System Settings integration with a visual imitation.

**Acceptance:** the label describes the surface that actually opens; only one supported navigation path is advertised for each destination.

### 6. P1 — metrics mix real samples, guesses and misleading units

**Evidence:** [metrics.rs:88](/Users/sa/scion/omnia-vault/src-tauri/src/metrics.rs:88) creates a new `Networks` object per call and reads refresh deltas with no retained sampling interval; these are not a stable throughput series. The score uses arbitrary CPU/RAM thresholds and the first listed disk, treating a missing disk as zero usage ([100](/Users/sa/scion/omnia-vault/src-tauri/src/metrics.rs:100)). It can say Optimal while the required service is down. The snapshot has no collection timestamp, source validity or freshness field ([32](/Users/sa/scion/omnia-vault/src-tauri/src/metrics.rs:32)).

**Correction:** retain a network sample history, declare interface scope and units, and handle reset counters. Keep CPU/RAM/disk measurements; remove the global health score. Show the relevant volume, unavailable states and sample age. `sysinfo` 0.33.1 in the lockfile defines `received()` as bytes since the previous refresh; the local dependency source was checked.

**Acceptance:** a known transfer produces a bounded, timed rate; a new interface does not create a fake spike; unavailable disk data is not healthy; stale measurements stop appearing current.

### 7. P0 for archive use — publication identity and retries are unsafe

**Evidence:** [lib.rs:93](/Users/sa/scion/omnia-vault/src-tauri/src/lib.rs:93) truncates caller IDs to the first 16 UTF-8 bytes, uses a constant owner, fetches the latest head itself and creates a new operation ID on every call. Different long IDs can collide; a retry cannot refer to the original operation; the caller cannot supply the revision it actually edited. [lit.rs:256](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:256) returns a cached receipt for the same operation key without comparing the new request digest.

**Correction:** validate full canonical IDs, bind owner identity explicitly, accept stable operation IDs and the caller's expected revision, and reject reuse of an operation ID with different data or parameters. Return a typed receipt, not only a display string.

**Acceptance:** IDs sharing the first 16 bytes remain distinct; an unchanged retry returns the same receipt; a changed retry is rejected; editing an old revision preserves a conflict instead of silently adopting the latest head.

### 8. P0 for archive use — latest revisions and read verification are incomplete

**Evidence:** a successful publish records only the changed item in the new revision ([lit.rs:326](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:326)). `read_pinned` requires an exact revision/item match ([371](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:371)); it cannot find an unchanged earlier item at the new workspace head. Reads verify each chunk hash but do not recompute the selected manifest digest or validate total size ([381](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:381)). Several database errors are converted to “not found” or a genesis head ([214](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:214), [257](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:257), [296](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:296)).

**Correction:** define whether a revision is a full workspace snapshot or an item revision; implement reads accordingly. Verify the manifest and full size as well as chunks. Distinguish an absent row from database corruption or access failure; validate stored field lengths before copying.

**Acceptance:** publish A, then B, and read both at the latest workspace revision if that is the promised model. A swapped/reordered manifest must fail verification. Database errors must not create a fresh-looking workspace.

### 9. P0 for archive use — this is a local byte store, not an encrypted private archive

**Evidence:** [lit.rs:92](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:92) uses HOME with a `/tmp` fallback. The SQLite schema and inserts store payload bytes directly ([117](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:117), [278](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:278)); `lit_publish_text` passes plaintext bytes. There is no encryption, remote archive commit or recovery-key handling in this path. WAL uses `synchronous=NORMAL` ([110](/Users/sa/scion/omnia-vault/src-tauri/src/lit.rs:110)). SQLite documents that a committed WAL/NORMAL transaction may roll back after power loss or an OS crash. [SQLite durability rules](https://sqlite.org/pragma.html#pragma_synchronous)

**Correction:** keep the honest label “Local publication” until the agreed existing archive/key scheme is connected and verified. Use an OS-specific persistent data directory; do not fall back to temporary storage for authoritative data. Set and test the durability contract before treating a local receipt as permission to discard a source. Encryption must happen before remote upload; never add real credentials to source/config exports.

**Acceptance:** a receipt identifies local versus remote commit and the verified storage guarantee. Recovery tests preserve acknowledged data within the stated fault model. A known test plaintext is not present in the remote encrypted payload or manifest. No actual secrets need to be printed to test this.

### 10. P1 — polling and child processes need bounded ownership

**Evidence:** tray handlers call blocking control/cleanup work directly ([tray.rs:70](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:70)); the endless monitor loop launches status work every cycle without a command deadline or stop handle ([103](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:103)). Calls to `Command::output()` can wait indefinitely. The global metrics mutex covers collection and cache scanning. Window close hides the window, but Quit exits the process containing the background socket server ([lib.rs:172](/Users/sa/scion/omnia-vault/src-tauri/src/lib.rs:172), [tray.rs:92](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:92)).

**Correction:** schedule bounded background jobs, show pending/error states, serialize changes to each resource, and stop/join owned jobs deliberately. Define Quit separately from hiding UI; do not imply that in-process services survive application exit.

**Acceptance:** hung subprocesses cannot freeze menu actions or retain a live status indefinitely; repeated clicks do not overlap mutations; closing a window preserves work; Quit has an explicit, tested effect on active work.

### 11. P1 — SSH helper functions have incomplete effects and lifecycle

**Evidence:** [ssh_manager.rs:8](/Users/sa/scion/omnia-vault/src-tauri/src/ssh_manager.rs:8) kills the old tunnel before proving a replacement works and calls spawn success “started.” It uses reverse forwarding (`-R`), with no application readiness check. Stop takes away the stored child before kill succeeds and never waits to reap it ([33](/Users/sa/scion/omnia-vault/src-tauri/src/ssh_manager.rs:33)). Concurrent starts can replace an owned handle. `flip_backbone` only returns a string ([45](/Users/sa/scion/omnia-vault/src-tauri/src/ssh_manager.rs:45)). `prepare_and_reboot` launches local shutdown with caller-selected argument syntax, has no drain, and is not a remote helper reboot ([50](/Users/sa/scion/omnia-vault/src-tauri/src/ssh_manager.rs:50)). These four functions are **not registered Tauri commands in this `lib.rs`**.

**Correction:** do not expose cosmetic flip or unguarded reboot as working controls. If tunnel management is needed, validate target/identity references, preserve normal host verification, confirm forwarding, retain ownership on errors, serialize replacements and reap children. Rust does not automatically wait for a dropped child. [Rust process lifecycle](https://doc.rust-lang.org/std/process/struct.Child.html)

**Acceptance:** an unavailable SSH server never becomes Ready; a failed replacement does not silently discard a working connection; no orphan/zombie accumulates; any reboot action identifies the actual host and passes active-work guards.

### 12. P1 — Windows support is not established by these functions

**Evidence:** unguarded `launchctl`, `networksetup`, `id -u`, HOME/Library paths and fallback UID 501 appear throughout [control.rs:73](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:73). Metrics can report “macOS” as a fallback OS name ([metrics.rs:146](/Users/sa/scion/omnia-vault/src-tauri/src/metrics.rs:146)). A Bool changes shutdown syntax, not execution host. `lib.rs` starts a server described as Unix without a platform branch; the follow-up in EXTRA_COMMAND_REVIEW.md confirms a Windows TCP branch but not portable service actions.

**Correction:** keep macOS controller operations separate from Windows/WSL helper operations. Return Unsupported where an OS adapter is absent. Select data directories and commands through a real platform capability check. Do not claim Windows compilation or runtime readiness until checked.

**Acceptance:** running on another OS cannot show successful macOS proxy/tunnel/cleanup results from missing commands or guessed paths. A remote action names and verifies the remote target.

## Complete registered command inventory in this scope

The 16 names below are registered at [lib.rs:148](/Users/sa/scion/omnia-vault/src-tauri/src/lib.rs:148). This lists the backend surface, not proof that every frontend caller works.

| Command / definition line in lib.rs | Actual route and effect |
|---|---|
| `get_system_metrics` :23 | Local sysinfo collection, cache estimate and heuristic score. |
| `run_quick_clean` :28 | Deletes selected local cache/log/temp content. |
| `get_tunnel_status` :33 | Local launchctl query and TCP connect to local port 3080. |
| `toggle_tunnel` :38 | Local launchctl load/kickstart or stop/unload. |
| `restart_tunnel` :43 | Local launchctl kickstart. |
| `get_valves` :48 | Local flag + launch-agent PID; fixed derived flow values. |
| `set_valve` :53 | Local proxy change or local tunnel action. |
| `get_scion_daemons` :58 | Literal sample daemon list. |
| `get_scion_routing_paths` :63 | Literal sample path list. |
| `get_gns3_nodes` :68 | Literal sample topology list. |
| `get_ndi_config` :73 | Reads JSON or returns enabled defaults. |
| `restart_ndi` :78 | Writes JSON; does not restart a stream. |
| `query_llm` :83 | Delegates to `llm::query_llm_provider`; external implementation reviewed in EXTRA_COMMAND_REVIEW.md; external calls and simulated results need correction. |
| `get_llm_providers` :88 | Delegates to `llm::list_providers`; static/config-presence flags reviewed in EXTRA_COMMAND_REVIEW.md. |
| `lit_publish_text` :93 | Converts text and truncated IDs into a local SQLite publication. |
| `evaluate_proposal` :137 | Delegates to `RheknelJudge::evaluate`; keyword-based text classification; see EXTRA_COMMAND_REVIEW.md. |

No registered command here performs cloud-folder sync, encrypted archive upload, restore, or an NDI stream operation. That is a finding about this registration list, not a claim that no other component exists.

## Complete tray action inventory

| Tray ID / handler line | Actual effect |
|---|---|
| `open_dashboard` :54 | Show/focus main window; emit `navigate-tab` with `monitor`. |
| `open_control_pane` :62 | Show/focus main window; emit `navigate-tab` with `control_pane`. Does not open System Settings. |
| `toggle_valve_mio` :70 | Invert local flag through `set_valve_state`; emit successful result only; errors disappear. |
| `toggle_valve_wd` :78 | Toggle local launch agent through `set_valve_state`; emit successful result only; errors disappear. |
| `quick_clean` :86 | Delete content, discard result, recollect metrics and emit snapshot. |
| `quit` :92 | Exit app process. |

`metrics_summary` and `scion_flow` are disabled display rows. The background loop emits `system-metrics-update` and `dual-valves-update` and updates titles; these events are not additional action confirmations.

## Privacy and review limits

No literal credential value was reproduced in this report. The six-file scope contains identity-file references and plain user-text storage, not evidence of a completed secret-store integration. The follow-up EXTRA_COMMAND_REVIEW.md covers the AI module and socket interface. App capability enforcement and deployed caller identity still require runtime checks before claiming privacy or complete protection. Do not dump environment variables, key files, token contents, stored user payloads or raw command output to make that review easier.

The existing metrics test checks only basic numeric bounds; the two LIT tests cover one publish/read and one generation conflict. They do not establish the acceptance cases above. No tests or builds were run during this source review.
