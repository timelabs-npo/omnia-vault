# Review coverage and completion checks

## What this review establishes

Reviewed on 12 September 2026, using the user's screenshots, the current Antigravity conversation, the real System Settings accessibility tree, active build configuration, source code, and original SCION/GNS3 docs and upstream source. The task was to produce and deliver corrections. This review did not execute cleanup, change proxy settings, stop a VM, send AI requests, or rerun the network gates.

The active root project is `omnia-vault` inside the `scion` workspace. Its package and Tauri configuration point to root `src/App.tsx`, `src/index.css`, and `src-tauri`, not the separate `frontend/` app. The installed build was not matched to this checkout. The current Antigravity conversation is **SCION Integration And Tools**. Source line references are locations at review time and may move during editing.

## Coverage ledger

| Area | Evidence examined | Runtime coverage |
|---|---|---|
| Seven React routes and their controls | Full root App.tsx; entry, style and build files | User's screenshots; no mutation controls exercised |
| System measurements and cleanup | metrics.rs plus every frontend display and handler | Source only; no files deleted |
| Connections, services, paths, lab devices and NDI settings | control.rs, lib.rs, frontend handlers | Source only; reported network success preserved |
| Menu bar | tray.rs and screenshot | Current labels visible in screenshot; action routes traced in source |
| Native settings pane | Live System Settings tree, bundle presence, BlueshoesPane.swift, scionctl.py, Mac/Windows Python daemon source | Pane and controls observed; switches not pressed |
| Registered app commands | All 16 registered names traced | Source only |
| Local socket commands | All 13 handlers / 15 accepted names traced | Source only; no requests sent |
| AI and proposal checks | llm.rs and rheknel.rs | Source only; no keys or prompts sent |
| Local publication/archive claims | lit.rs and lib.rs entry point | Source only; no user data opened or written |
| SSH/process actions | ssh_manager.rs and socket dispatch | Source only; no SSH, restart, or reboot action run |
| File sync and provider scope | Current root command and UI inventory, prior accepted requirements | No real connector or restore verified in this active root UI |
| SCION/GNS3 alignment | Linked official docs and pinned scion-skip source | No installation change or active topology regeneration |

“Every function” here means the current product's visible functions and its app/socket command surface. It does not claim to be a line-by-line audit of all libraries, all processes on both hosts, or a successful runtime test of every command.

## Data and result review

| Category | Observed defects | Assessment |
|---|---|---|
| Live values | Fixed network inventory and numbers in frontend and backend | Must correct before showing live status |
| Accuracy | Byte counts called speed; used memory called pressure; fake load | Definitions and sampling must be corrected |
| Missing data | Failed reads keep sample values or become empty success | Must show unknown/error separately |
| Freshness | No observation time in snapshots; several tables load only once | A live claim is unsupported |
| Action results | Errors become success; some actions only change text/settings | Must correct before enabling retained controls |
| Scope | Local process/port described as remote readiness or path use | Each status needs an explicit target and check |

## Product and implementation review

| Category | Observed defects | Assessment |
|---|---|---|
| User purpose | NDI clone, unrelated AI, static protection, architecture filler | Remove from normal beta flow |
| Control meaning | Same valve names perform different actions | Serious risk of unexpected service changes |
| Native integration | Real pane exists; tray link instead opens a Tauri tab | Preserve native pane and fix navigation |
| Cleanup | Unknown active ownership, mismatched estimate, ignored failures | Disable broad action until corrected |
| Hidden commands | Socket still exposes reboot, AI, cleanup, cosmetic route switch | Removing UI alone is incomplete |
| Privacy | AI credentials and content enter subprocess arguments | Must fix or disable that command path |
| Archive | Local plaintext store presented near broad security claims | Not evidence of the requested private archive |
| Platform claims | Windows socket branch exists; many actions are Mac-only | Check capabilities; do not infer Windows readiness |

## Acceptance cases for Antigravity

Run the cases that apply to retained functions. Prefer local test fixtures for failure injection and destructive-action tests. Record Not run, Not applicable, or Blocked honestly; none are Passed by this review.

| ID | Case | Expected result |
|---|---|---|
| T01 | First launch with collectors absent | Checking then Unavailable; no invented nodes, routes, traffic, or health |
| T02 | Collector disconnects after a valid sample | Last update shown; stale values cannot appear current |
| T03 | Valid empty service/project/route result | Clear empty state, distinct from failed request |
| T04 | Slow or out-of-order responses | Newer result wins; UI remains responsive; calls reach deadlines |
| T05 | Proxy command fails or access is denied | Failed result, no success flag, prior settings preserved |
| T06 | Ethernet/renamed network service and existing PAC | Correct service selected; previous settings restored after the tested operation |
| T07 | Tunnel process exists but remote GNS3 fails | Process and remote service show different states |
| T08 | Restart fails or a replacement SSH connection fails | Truthful result; existing working connection not silently discarded |
| T09 | Repeated click while an action is running | One change per resource; pending state; no duplicate processes |
| T10 | Empty eligible cache | Estimate zero; no invented minimum or fake freed bytes |
| T11 | Permission-denied file and active temporary file | Partial/error result; active file survives; failed removal not counted |
| T12 | Preview followed by changed files/links | Scope checked again; no newly active or outside file deleted |
| T13 | Known byte-counter samples at timed intervals | Correct upload/download rate and units; no spike on reset |
| T14 | Missing drive or unavailable process list | Unavailable or error; no healthy zero or endless loading |
| T15 | Menu opens settings | Actual Timelabs System Settings pane opens; optional NDI link opens its actual pane |
| T16 | Keyboard, narrow supported window, long error | All retained controls reachable/readable; text selectable; no clipped action |
| T17 | App window closes; app quits | Hiding vs quitting has the documented effect on owned work; no false continuity claim |
| T18 | Missing/invalid socket fields, oversized or stalled client | No inferred action; bounded error; other status requests remain available |
| T19 | Local caller lacks required access | Mutation refused; insecure endpoint setup does not continue |
| T20 | Removed AI/NDI/flip/reboot function invoked directly | Unsupported action disabled, or retained action has a documented purpose and full checks |
| T21 | Retained AI path has no key, HTTP error, bad body, or timeout | No simulated success; no credentials/content in process arguments or errors |
| T22 | Real service/path/lab inventory | Every row has a source and time; installed-version API/command used |
| T23 | Website through chosen proxy | Record origin/CONNECT result separately from actual SCION/direct/unknown route evidence |
| T24 | SCION paths available but traffic uses one | UI does not claim several active paths or added bandwidth |
| T25 | System Settings daemon response differs from expected text | Unknown/error, not a silently wrong checkmark; deployed protocol identified |
| T26 | Build and platform checks | Active root build and native pane checked; Windows-specific behavior tested on Windows/WSL before claiming support |
| T27 | If local publication is retained for archive use | Identity, retries, conflicting edits, full reads, damaged manifests, crash/recovery and restore checks in BACKEND_REVIEW.md pass |
| T28 | Files feature is not yet connected | Not set up; no fake synced rows, counts, backup claims, or one-way overwrite default |

The UI correction can be completed with unsupported features clearly removed or marked Not set up. It need not pretend that all archive/provider acceptance cases have passed.

## Delivery standard

Return changed files, decisions per inventory row, checks and actual results, screenshots tied to the running build, and remaining limits. Keep the active network setup working. Do not publish a new release just to deliver this correction task. Do not equate an HTTP response, FFI link test, receipt, or UI screenshot with proof of every system guarantee.
