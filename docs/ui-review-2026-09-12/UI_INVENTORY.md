# Current UI correction inventory

Source review, 12 September 2026. No application code, UI settings, proxy settings, services, files in provider accounts, or installed panes were changed. This is the implementation brief for Antigravity, not evidence that the corrections already work.

All **new product labels** below use plain English. Keep recognizable provider names where needed. NDI is an allowed name. Do not expose Mole, Rheknel, Keiky, LIT-001, valve temperatures, engine metaphors, or internal module names as product labels. Technical identifiers and protocol names can remain in a clearly identified Details view when they are needed to diagnose an actual connection.

## Which code is active

- The root [package.json](/Users/sa/scion/omnia-vault/package.json:6) builds the root Vite/React project. [index.html](/Users/sa/scion/omnia-vault/index.html:11) imports `/src/main.tsx`, which imports [App.tsx](/Users/sa/scion/omnia-vault/src/main.tsx:4) and [index.css](/Users/sa/scion/omnia-vault/src/main.tsx:3).
- [Tauri configuration](/Users/sa/scion/omnia-vault/src-tauri/tauri.conf.json:6) selects root `../dist`, development URL `http://localhost:5173`, and a Tauri app window. This establishes the configured build route, not the provenance of an arbitrary running binary.
- [src/App.css](/Users/sa/scion/omnia-vault/src/App.css:1) contains unused starter-page styling. No import appears in the active source. Editing it will not correct this screen.
- `frontend/` is a separate React 18/Vite 6 project named `nebulavault-macos`, configured for port 3000, with another App and many storage views. The root Tauri configuration does not select it. Treat it as a separate implementation until an explicit migration connects it. Do not report its features as present in root App.tsx. [Separate package](/Users/sa/scion/omnia-vault/frontend/package.json:1), [separate entry](/Users/sa/scion/omnia-vault/frontend/src/main.jsx:1).
- The real `/Library/PreferencePanes/NDI Output.prefPane` exists. [BlueshoesPane.swift](/Users/sa/scion/OmniaWorkspace/BlueshoesPane/BlueshoesPane.swift:5) declares an `NSPreferencePane`. Preserve the real System Settings pane. Do not replace it with this Tauri window or claim that React styling creates an OS pane. The menu item currently named `NDI Output (System Settings)` only shows Tauri and navigates to a React tab. [Tray route](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:62).

## Release blockers that renaming alone cannot fix

1. **Invented observations:** [App initial state](/Users/sa/scion/omnia-vault/src/App.tsx:127) supplies active connections, eight running services, three routes, four lab nodes, latency and traffic values before any observation. Failed reads silently preserve these values. Backend service/path/node lists are also fixed arrays, and connection traffic/latency is a fixed lookup. Empty, unavailable and not configured must be distinct states. Remove production fixtures from both layers. [Read/error handling](/Users/sa/scion/omnia-vault/src/App.tsx:210), [fixed network values](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:118), [fixed inventory](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:250).
2. **Failure becomes success:** cleanup catch says completed; NDI catch says broadcasting; AI catch says a proposal was validated. Tunnel catch says kickstarted even on an exception. Return actual errors and retain useful failure detail; success requires a verified postcondition. [Handlers](/Users/sa/scion/omnia-vault/src/App.tsx:295).
3. **Wrong response field:** AI reads `res.content`, but Rust returns `reply`. A successful real response can disappear. Replace `any` with the actual response contract and handle success, failure, missing credentials and cancellation. [Frontend](/Users/sa/scion/omnia-vault/src/App.tsx:363), [response type](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:16).
4. **Misleading control scope:** the Mac “valve” changes the Wi-Fi automatic proxy URL/state; the Windows “valve” changes a local LaunchAgent. Neither operation is a general machine connection switch, a SCION path selector or an isolation control. The proxy state is stored before shell success and command failures are ignored. [Actual effects](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:162).
5. **NDI restart is only a local JSON write:** there is no sender restart or broadcasting check in the handler. Keep NDI as reference material in the agreed beta scope, and preserve the installed pane. Remove the cloned runtime control from this product UI. [NDI implementation](/Users/sa/scion/omnia-vault/src-tauri/src/control.rs:396).
6. **Cleanup reports attempted bytes as freed:** it counts before deletion and ignores removal errors. Make the action reviewable, app-scoped and accurately reported before exposing it. The current Security page also hides its completion/error text because messages render only in the System tab. [Cleanup](/Users/sa/scion/omnia-vault/src-tauri/src/metrics.rs:197), [message placement](/Users/sa/scion/omnia-vault/src/App.tsx:634), [other entry point](/Users/sa/scion/omnia-vault/src/App.tsx:1231).

## Navigation, identity and shared controls

The table inventories visible routes and controls, including those with no handler. “Hide” means unavailable in the released UI until the specified behavior exists, not a claim that its implementation already exists.

| Current element | User purpose and current effect | Decision and exact new label | Source proof |
|---|---|---|---|
| Search field | Intended to find settings; uncontrolled text input, no search handler | Hide until functional; then **Search settings** | App.tsx:394 |
| M avatar; Mika IO; Enterprise Node · wd.local | Intended identity/context; avatar and name are literals, host comes from tunnel status whose backend target is also fixed. This is not evidence of account linkage. The real OS account may indeed have this name. | Remove copied account card. If device context is needed, **This Mac**, with measured device name below. Do not alter the actual Apple Account pane. | App.tsx:397; control.rs:79 |
| NDI Output navigation and page title | Opens React `control_pane`, which is also the default route | Hide cloned control route. Optional reference entry **NDI** belongs under **About**, with honest reference text. Real OS pane remains intact. | App.tsx:117,406,492 |
| 60p badge | Shows selected `frameRate` plus `p`, not measured stream output | Remove from sidebar. If a future verified sender is approved, **Frame rate** with **60 fps**; distinguish configured vs measured rate. | App.tsx:420 |
| Mole Status; Mole System Telemetry & Maintenance | Opens machine metrics | Keep view; rename both **System** | App.tsx:424,493 |
| Network & SCION; Network & SCION GNS3 Infrastructure | Opens network subviews | Keep view; rename both **Network** | App.tsx:432,494 |
| WARM / COLD / HOT / OFF badge | Boolean combination of proxy flag and tunnel-process status | Remove. Future badge **Connection status** must use actual states **Checking**, **Connected**, **Disconnected**, **Unavailable** at the stated scope. | App.tsx:438; control.rs:118 |
| External LLMs; External LLM Gateway (Codex / Trae / OpenRouter) | Opens AI query form | Remove from normal beta navigation. Any development-only AI view must have truthful results and a defined use | App.tsx:450,495 |
| VPN Isolation; VPN Isolation (SCION IP Gateway) | Opens a static green isolation claim | Hide route until actual policy and traffic verification exist; future label **Connection protection** | App.tsx:458,496,1209 |
| Security & Sync; Node Security & Data Sync | Opens one cleanup action; has no security controls or sync monitor | Remove misleading route. Move cleanup to **System** → **Storage**. Do not remove the separately requested real sync work from the product scope. | App.tsx:466,497,1228 |
| Stack & Credits; Architecture & Attribution | Opens static implementation claims | Rename **About**, with verified **Version** and **Credits** | App.tsx:474,498,1244 |
| Back and Forward arrow buttons | Appear interactive; neither has an onClick | Remove until navigation history exists; then accessible names **Back**, **Forward** and correct disabled states | App.tsx:488 |
| Window close button | Native window close request is intercepted and hides the Tauri window; app remains running | Keep platform behavior if intentional; provide **Quit** in menu, document background operation without calling it System Settings | lib.rs:187 |

## NDI clone: every visible element

These are reference-copy controls in the active React app. They do not manage the installed NDI pane.

| Current element | Current effect | Decision and exact new label | Source proof |
|---|---|---|---|
| Video Format select: 720p HD ITU Rec 709; 1080p HD ITU Rec 709; 4K UHD ITU Rec 2020 | Changes React `videoFormat`; restart handler later writes it to an app-owned JSON file | Hide with cloned route. If documenting the reference UI, **Video format**; preserve exact formats only as reference data | App.tsx:512; control.rs:425 |
| Frame Rate select: 24, 30, 50, 59.94, 60 | Changes React `frameRate`, not a observed sender | Hide with cloned route; reference label **Frame rate**, values with **fps** | App.tsx:527 |
| Final Cut Pro X A/V Output paragraph | Static instructions copied into unrelated product screen; no FCP detection or control | Remove from product flow; optional verified link in reference documentation | App.tsx:542 |
| Restart NDI | Calls `handleRestartNdi` → `restart_ndi` → `restart_ndi_stream`; JSON write only | Remove product action. Do not rename it to a working transport operation. Reference navigation, if required: **Open NDI settings**, only after it truly opens the installed pane | App.tsx:547,345; lib.rs:78; control.rs:414 |
| Restarting / restarted / broadcasting result box | Always green styling; catch manufactures success | Remove false result; any retained settings operation uses **Saving**, **Saved**, **Could not save** only for actual local settings persistence | App.tsx:346,354,552 |
| V1.0.260413 footer | Literal version, unrelated to root package 0.2.1 | Remove; app **Version** must come from build metadata, NDI version only from actual installed component | App.tsx:567; package.json:4 |
| NDI trademark text and ndi.video link | Static attribution; anchor opens external URL | Move to **About** → **Credits**; link label **NDI website** | App.tsx:569 |

## System: every action and metric

| Current element | User purpose and current effect | Decision and exact new label | Source proof |
|---|---|---|---|
| Optimal/Good/Warning/Critical, sun icon, green/orange dot, % Health | Hand-built score from CPU, used-memory ratio and first disk thresholds; not OS health diagnosis | Remove health percentage and implied diagnostic authority. Show individual measured readings; data state **Updated** / **Unavailable** | App.tsx:579; metrics.rs:100 |
| Memory Pressure in banner | `used memory / total memory`, not a pressure reading | Rename **Memory used** and avoid OS-pressure semantics | App.tsx:584; metrics.rs:61 |
| OS name · GB · Cores · up h/m | Values come from sysinfo when available, otherwise invented initial state | Keep; use **System**, **Memory**, **Processor cores**, **Uptime**; no numeric fallback when unknown | App.tsx:586; metrics.rs:56,145 |
| Quick Clean (Wipe) | `run_quick_clean`: removes app log/cache directories and matching temporary files | Hide until preview, scope and result are accurate. Entry **Review app files**; final explicit action **Delete selected files**. State whether logs are selected; do not call logs only cache. | App.tsx:599,295; metrics.rs:197 |
| Awake / Awake Active | Only flips React `isAwake`; no power assertion | Hide until real power control; then **Keep awake**, with actual OS state | App.tsx:603 |
| Restart Tunnel action dock | Calls actual LaunchAgent restart attempt | Move to Network connection details; **Restart connection**. No duplicates in System | App.tsx:611,308; control.rs:222 |
| Valve A (Cold On/Cold Off) | Calls Mac Wi-Fi automatic proxy setting path | Move to Network details; **Use automatic proxy** only after verifying selected network service, old settings, command result and actual readback | App.tsx:615; control.rs:162 |
| Valve B (Hot On/Hot Off) | Loads/unloads local GNS3 tunnel LaunchAgent | Move to Network details; **Start connection** / **Stop connection**, with target identified | App.tsx:623; control.rs:199 |
| CPU Activity %, colored bar | Global CPU usage from sysinfo; thresholds drive colors | Keep **Processor use**; validate first sample and sampling interval, show unavailable rather than fake initial 14.2 | App.tsx:667; metrics.rs:53 |
| Active Cores | Logical CPU count, not number currently doing work | Rename **Processor cores** | App.tsx:677; metrics.rs:57 |
| Load: CPU/12, denominator /8 | Arbitrary frontend arithmetic; not load average | Remove | App.tsx:678 |
| Memory Pressure %, bar, used/total GB | Used-memory fraction plus bytes | Keep **Memory used**, **Used**, **Total**; correct binary/decimal display units consistently | App.tsx:685; metrics.rs:59 |
| Storage %, free/total GB, bar | Only first disk; missing disk becomes zero, disk identity is hidden | Keep **Storage**, show real **Drive**, **Used**, **Free**, **Total**. Missing data **Unavailable**, not 0. Verify chosen drive/mount | App.tsx:703; metrics.rs:70 |
| Network Throughput total and ↑/↓ KB/s | Backend creates a fresh Networks object and sums counters without a time denominator; not proven bytes/second | Keep only after interval-delta implementation; **Network speed**, **Upload**, **Download**. Label selected interfaces. Remove SCION attribution | App.tsx:721; metrics.rs:88 |
| SCION Mesh Fabric · Port 3080 Tunnel | Hardcoded claim attached to all host network counters | Remove; do not attribute machine traffic to a specific transport without scoped counters | App.tsx:729 |
| LaunchAgent label; Online (3080)/Connecting/Stopped | Process lookup plus TCP connect to loopback 3080; no GNS3 response validation, no SCION transfer proof | Move to Network → **Connection details**. **Process**, **Local port**, **Server** are separate observations; **Connected** requires a defined application check | App.tsx:736; control.rs:73 |
| Target Host and PID | Fixed `wd.local` plus parsed PID | Keep in details as **Server**, **Process ID**, only if observed/configured truthfully; do not describe configured hostname as discovered peer | App.tsx:746 |
| Start / Stop beside tunnel | Toggles LaunchAgent | Move; **Start connection** / **Stop connection**; verify postcondition and expose failure | App.tsx:748,320; control.rs:199 |
| Kickstart beside tunnel | Same restart handler as other restart controls | Merge duplicates; **Restart connection** | App.tsx:755 |
| TOP PROCESSES (SYSINFO ENGINE) | Five processes sorted by CPU | Move verbose technical table under System details; title **Processes**, headers **Process ID**, **Name**, **Processor use**, **Memory** | App.tsx:769; metrics.rs:133 |
| Collecting real-time process telemetry... | Shown whenever process list is empty, including possible lack of access/error | Distinguish **Loading processes**, **No processes found**, **Could not load processes** | App.tsx:791 |
| Cleanup and tunnel result banners | Temporary text disappears after four seconds; cleanup is always green | **Working**, **Completed**, **Failed** only from accurate result; preserve errors long enough to inspect/copy, render feedback next to the initiating control | App.tsx:295,308,634 |

`swap_total_mb`, `swap_used_mb`, `cleanable_estimate_mb` and disk mount/name fields exist in the frontend type but are not currently rendered as independent values. Do not claim they are existing visible controls. The cleanable estimator also has a forced minimum of 12 MB, which must not become a real “reclaimable” figure. [Types](/Users/sa/scion/omnia-vault/src/App.tsx:41), [estimator](/Users/sa/scion/omnia-vault/src-tauri/src/metrics.rs:194).

## Network: every subview, action and metric

| Current element | Current effect and purpose | Decision and exact new label | Source proof |
|---|---|---|---|
| Dual-Valve Mixer tab | Selects `valves` subview | Rename **Connections** | App.tsx:809 |
| SCION Daemons (8) tab | Selects fixed service inventory | Move under Network details; **Services**. Count only observed services, otherwise **Unavailable** | App.tsx:815; control.rs:250 |
| Path Explorer (3) tab | Selects fixed routing rows | Move under Network details; **Routes**. Do not display invented count | App.tsx:821; control.rs:327 |
| GNS3 Lab (4) tab | Selects fixed node inventory | Move under Network details; **Test network**. Identify actual configured project inside details | App.tsx:827; control.rs:359 |
| Blended Multi-Path / Native Host Only / Hypervisor GNS3 Only / Isolated; Warm/Cold/Hot/Off badge | Derived from boolean flags, not measured route or isolation state | Remove all heat/mixer labels. Separate **Automatic proxy** and **Server connection** status. Both enabled does not prove multipath | App.tsx:838; control.rs:123 |
| Concurrency Principle paragraph | Static claim that both “valves” blend traffic across SCION paths | Remove. Future help text must describe measured behavior in plain English | App.tsx:848 |
| Throughput; Active Paths; mio Latency; wd Latency | Fixed values 6240/2840/3400, 4/2, 0.4/1.2 from booleans | Hide until instrumented. Then **Transfer speed**, **Active routes**, **Mac response time**, **Server response time**, with measurement scope/time | App.tsx:851; control.rs:123 |
| Valve A: mio.local title; Cold Water (Active)/Closed | Mac local proxy flag | Rename **Automatic proxy**, states **On**, **Off**, **Unknown**, derived from actual selected network service | App.tsx:865; control.rs:167 |
| Mac direct IPC/zero-overhead paragraph; Role: Native Cold Stream | No proof of zero overhead or packet routing from shown control | Remove. Details can show **Network service** and actual **Proxy address** | App.tsx:871 |
| Mac Ping / Offline | Fixed latency from enabled flag, no ping | Hide; future **Response time** only from actual timed check, missing **Not checked** | App.tsx:875 |
| Turn Off Cold Valve / Open Cold Valve | Changes automatic proxy settings | Replace with clearly scoped **Use automatic proxy** toggle after backend correction; never claim disabling internet or device traffic | App.tsx:878; control.rs:170 |
| Valve B: wd.local title; Hot Water (Active)/Closed | Local tunnel process running flag | Rename **Server connection**; actual configured server shown separately. States **Running**, **Stopped**, **Unknown** for process only | App.tsx:900 |
| Windows WSL backbone/hypervisor paragraph and Role: Hypervisor Hot Stream | Hardcoded architecture claim | Move necessary observed **Server**, **Platform**, **Local address** to Details; remove “backbone”/“stream” assertions | App.tsx:906 |
| Windows Ping / Offline | Fixed 1.2 ms or zero from process flag | Hide; future **Response time** measured to defined target | App.tsx:910 |
| Turn Off Hot Valve / Open Hot Valve | Starts/stops local LaunchAgent, not remote Windows host | Rename **Stop connection** / **Start connection** | App.tsx:913; control.rs:164 |
| LaunchAgent bar: label, Target, Port 3080, PID, dot | Same process/loopback-port observations as System card | Keep one Network details card only: **Connection details**, **Server**, **Local port**, **Process ID**; errors separate | App.tsx:932 |
| Kickstart in network bar | Same restart action | **Restart connection** | App.tsx:945 |
| Managed-service table title | “SCIONPROTO SPEC” implies authoritative discovered inventory | Rename **Services**; source name/version in Details. Empty data must explain **No service data** | App.tsx:960 |
| All AS, 1-ff00:0:110, 1-ff00:0:111 filter buttons | Local filter of displayed fixed array; no fetch or command | Keep functional filtering after real inventory: **All networks**, real identifiers as values; accessible label **Network filter** | App.tsx:964 |
| Service ENTITY, ISD-AS, TYPE, PORT, PACKETS, STATUS columns and green running states | Render fixed returned fields; no service start/stop controls exist | Headers **Service**, **Network**, **Type**, **Port**, **Packets**, **Status**; only observed rows/counts; identifiers kept as data, unavailable metrics as **Not measured** | App.tsx:983; control.rs:250 |
| Eight service rows | CS110, BR110→111, BR110→112, dispatcher110, sciond110, gateway110, CS111, BR111 are all constants with ports/counters | Remove fixture rows in production. Actual process/service names may be data in Details, not invented friendly labels | App.tsx:142; control.rs:250 |
| PATH-AWARE MULTI-PATH ROUTING MATRIX | Static table title over fixture paths | **Routes** | App.tsx:1021 |
| Path DESTINATION AS, HOPS, LATENCY, MTU, POLICY, STATUS; Active/Standby | Three fixture routes with fixed timings, policies, MTU and activation | Headers **Destination**, **Route**, **Response time**, **Packet size limit**, **Selection rule**, **Status**. Active/Standby requires actual usage/selection evidence; otherwise **Not checked** | App.tsx:1024; control.rs:327 |
| Three path rows | Direct110→111, alternate110→112→111, direct110→112 | Remove production fixtures; actual route list may be read-only. No route selector exists in this code | App.tsx:153; control.rs:327 |
| GNS3 VIRTUAL LAB NODES (QEMU / DOCKER ON WSL2) title | Static architecture claim; initial frontend QEMU rows differ from backend Docker rows | Rename **Test network**; display detected environment separately | App.tsx:1060,159; control.rs:359 |
| NODE ID, NODE NAME, TYPE, CONSOLE PORT, AS MAPPING, STATUS; started dots | Four fixture rows, no actual GNS3 request in getter | Headers **Device ID**, **Name**, **Type**, **Console port**, **Network**, **Status**; only real project inventory | App.tsx:1063; control.rs:359 |
| Four lab rows | AS110 CS/BR, AS111 CS, AS112 BR, all started | Remove production fixtures; no launch/stop/console action currently exists | App.tsx:159; control.rs:359 |

The UI subscribes to system metrics, tunnel and connection-flag events, and polls those three every 2.5 seconds. Service/path/lab lists are requested once. They have neither refresh feedback nor freshness metadata. A live-looking table is not a live observation. [Data lifecycle](/Users/sa/scion/omnia-vault/src/App.tsx:210).

## AI, protection, maintenance and About

The core task removes AI from normal beta navigation. The field-level labels below apply only if a development-only view is retained; they do not add an AI feature to the beta scope.

| Current element | Current effect and purpose | Decision and exact new label | Source proof |
|---|---|---|---|
| External LLM Models Gateway heading | AI query form | Remove normal beta route; any retained development view is **AI** | App.tsx:1100 |
| Provider Gateway select | React provider change also swaps hardcoded model | **Provider**; use only actually supported providers | App.tsx:1105 |
| OpenRouter (Multi-Model Consensus) | Single OpenRouter chat completion when credentials supplied; no consensus | **OpenRouter** | App.tsx:1117; llm.rs:79 |
| OpenAI Codex Engine | OpenAI `/v1/chat/completions`, not Codex app/CLI control | **OpenAI**; do not promise Codex capabilities | App.tsx:1118; llm.rs:120 |
| Trae Autonomous Runner | Backend returns formatted text; no runner invocation | Hide until a verified integration exists. Future provider value uses its real provider name, without “autonomous” claims | App.tsx:1119; llm.rs:160 |
| Model Architecture select | Static IDs: deepseek/deepseek-r1, anthropic/claude-3.5-sonnet, openai/gpt-4o, meta-llama/llama-3.3-70b-instruct; OpenAI gpt-4o, gpt-4o-mini, code-davinci-002; Trae trae-agent-v1 | **Model**. These are current source literals, not verified availability. Populate from a validated provider capability list; retain actual model IDs as data | App.tsx:1126; llm.rs:33 |
| API Key / Token password field and Environment default or custom key placeholder | Holds React string; trimmed value or null is sent; backend can read environment | **API key**; placeholder **Enter an API key**. Show **Key available** only from actual configuration; state storage behavior accurately. No “connected” from key existence alone | App.tsx:1156,368; llm.rs:81 |
| Inference Prompt & Keiky iOS Keyboard Sync, textarea | Text is passed in one query; no keyboard-sync call | **Message**; preserve editable text | App.tsx:1170 |
| Query provider / Querying LLM... button | `query_llm`; disables during promise, no cancel/timeout in this frontend | **Send** / **Sending**; real error/result. If cancellation is added, **Cancel** must cancel the actual request | App.tsx:1179,359 |
| Verified Output · provider(model) | Display heading unconditionally asserts verification | **Response**, provider/model as context; no accuracy claim | App.tsx:1195 |
| Synced to Keiky iOS Extension | Unconditional label, no sync operation | Remove | App.tsx:1198 |
| Response text / proposal fallback | Success reads wrong field; catch manufactures validated text; backend no-key cases also return simulator success | Fix contract and show actual response. **API key required**, **Request failed**, **No response** as appropriate; simulations only in explicit development demo | App.tsx:371; llm.rs:85 |
| SCION IP Gateway (SIG) Isolation, green dot, Hardware-level path isolation active | Static strings, no observation; chevron has no action | Remove claim and inactive chevron. Hide route until actual protection implementation and acceptance evidence; future **Connection protection** | App.tsx:1217 |
| Clear Propagation Cache and Purge local SCION path telemetry & temp logs row | Clickable div calls generic cleanup; no propagation cache API | Move to System → Storage as **Review app files**; use actual button semantics, scope preview and result | App.tsx:1231 |
| Omnia-Vault Enterprise Control Pane, green dot, Native Hybrid Runtime · v0.1.0 | Static product/runtime/version assertions; inconsistent with 0.2.1 package | About shows actual product name and **Version** from build metadata. Remove “Enterprise”, runtime claim and status dot unless meaningful verified data | App.tsx:1253; package.json:4 |
| CORE TECHNOLOGIES & ARCHITECTURE | Static list | **Credits**; verified dependency/license facts only | App.tsx:1263 |
| Mole System Monitoring & Diagnosis Engine and description | Claimed external engine; actual metrics use sysinfo and local cleanup | Remove product module label. If credited as inspiration, make that relationship explicit in Credits; system feature called **System information** | App.tsx:1268; metrics.rs:5 |
| SCION Protocol full expansion and cryptographic isolation copy | Attribution mixed with runtime/security claim | Credits may retain actual SCION project name and a verified reference; no inference that current app has measured isolation | App.tsx:1274 |
| GNS3 Virtual Network Hypervisor, v3.0.6 on WSL2/systemd | Static version/environment attribution | Credits may retain GNS3 name; use **Network testing** as feature description. Show installed version only after detection | App.tsx:1280 |
| LIT-001 Publication CAS Engine; 243-byte receipts/WAL/pinned reads | Static internal architecture description, no visible action invokes `lit_publish_text` | Move verified implementation documentation out of user flow; no replacement product card required | App.tsx:1286; lib.rs:93 |
| Rheknel Zero-Trust Advisory Gate; fail-closed/zero-allocation copy | Static claim; AI handler never calls `evaluate_proposal` | Remove from product UI. A future verified feature may be **Review changes**; do not claim enforcement from a registered unused command | App.tsx:1292; lib.rs:137 |

## Menu bar inventory

Preserve the native menu bar surface. Correct its labels and behavior with the same state model as the real pane/app. Sources: [tray setup](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:12), [handlers](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:52), [updates](/Users/sa/scion/omnia-vault/src-tauri/src/tray.rs:100).

| Current menu item or display | Effect | Decision and exact new label |
|---|---|---|
| ⚡ 0% 0% title; later two percentages | Initial zeros, then CPU and memory ratios without names | **CPU … · Memory …**, with actual measured values; until first sample **Loading**; optional concise format after user preference |
| CPU/RAM summary disabled row | Read-only machine readings | **Processor use** and **Memory used**; no “RAM pressure” claim |
| SCION: Blended (Warm Flow) disabled row | Boolean-derived mode text | Remove; display actual **Connection status** only when checked |
| SCION Topology & Mole Monitor | Shows Tauri monitor tab, not topology | **Open system information** |
| NDI Output (System Settings) | Shows Tauri NDI tab | Remove misleading entry. **Open settings** must open actual agreed OS pane; optional **Open NDI settings** only if it opens the installed NDI pane |
| Valve A (mio.local): Active (Cold)/Closed | Mutates Mac Wi-Fi proxy | Move out of one-click menu until proper scope/rollback/readback; **Automatic proxy settings** can open the reviewed settings page |
| Valve B (wd.local): Active (Hot)/Closed | Starts/stops tunnel | **Start connection** / **Stop connection**, after actual state and failure handling |
| Wipe Caches (Mole) | Deletes immediately; ignores returned cleanup result | Replace direct destructive action with **Review app files**, opening the scoped review |
| Quit Omnia-Vault | Calls app.exit(0) | Keep **Quit**; do not claim this also stops unrelated helpers/LaunchAgents without implementation |
| Tooltip Omnia-Vault: SCION Multi-Path & System Monitor / dynamic flow | Includes unsupported multipath state | Actual product name plus measured **Processor use**, **Memory used**, **Connection status** only |

## Styling, interaction and acceptance requirements

- Correct the active index.css and active component tree only. Avoid restyling the unused App.css or separate legacy frontend and declaring the current screen fixed.
- React renders a second `id="root"` inside the existing HTML root; correct the duplicate ID without changing the real OS pane. [App](/Users/sa/scion/omnia-vault/src/App.tsx:386), [HTML](/Users/sa/scion/omnia-vault/index.html:10).
- Current CSS uses global `user-select: none`, fixed sidebar width, fixed-width selects, `span 2` metric cards and overflowing tables. Provide readable narrow-window behavior, keyboard focus, selectable/copyable error text and accessible names for every input/control. Labels are spans without explicit input associations; the cleanup row is a clickable div. [CSS](/Users/sa/scion/omnia-vault/src/index.css:24), [select sizing](/Users/sa/scion/omnia-vault/src/index.css:429).
- CSS comments saying “authentic”, “native”, or “pixel-perfect macOS System Settings” are not evidence of native integration. Verify actual pane opening and app window navigation as separate acceptance cases. Keep the existing pane functional throughout the work.
- Every asynchronous area requires **Loading**, **Unavailable**, error and empty states; every measurement requires source scope and freshness; every action requires a visible pending state, postcondition and truthful failure. Keep last known values only if clearly marked **Last updated** with time and stale status.
- No production screen may silently display a test fixture. No failed command may produce completed, verified, synced, isolated or broadcasting text. Read-only source review is not a runtime pass.
- Acceptance should exercise every listed route/control: keyboard navigation, selectors, filters, missing backend, failed command, missing credentials, empty inventory, stale observations, app restart and actual pane/menu opening. Network reads, proxy changes, service changes, deletion and AI queries need separate scoped test fixtures and outcome checks. Screenshots alone cannot prove them.
- Preserve the user's complete provider/sync/archive requirements. The root active UI currently exposes no provider inventory, folder picker, copy/move flow, conflict review, archive workflow or storage-account connection action. Their presence in a different frontend directory is not delivery in this configured app.

No runtime tests were executed during this audit because this task requested review and a correction brief, not activation of the current mutation controls.
