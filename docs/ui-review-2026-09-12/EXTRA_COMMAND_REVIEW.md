# Additional backend review: AI, proposal checks and local command server

Source-only follow-up to `BACKEND_REVIEW.md`. Read `llm.rs`, `rheknel.rs` and `socket_server.rs` under `/Users/sa/scion/omnia-vault/src-tauri/src`. No runtime configuration, environment contents, key files or user payloads were read. No requests, commands, tests or builds were executed.

## Important correction to the first review

The four SSH helper functions are not registered Tauri commands, **but all four are reachable through the socket server started by `lib.rs:172`**. The socket module also has a real Windows branch. This establishes a Windows IPC implementation, not portability of the macOS actions it calls. Removing a UI button does not remove these routes.

## Findings and corrections

### P0 — the local command server exposes mutations without an application authorization check

**Evidence:** [socket_server.rs:23](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:23) binds a Unix socket and attempts mode 0600, but continues if setting permissions fails. It also removes an existing socket-path entry without checking whether another instance owns it. [socket_server.rs:65](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:65) binds a Windows loopback TCP listener. The request contains only a command and arguments; the dispatcher has no client identity or action-policy check. Routes include cache deletion, SSH control and local reboot ([112](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:112), [159](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:159)). Commands run with the app's privileges; OS permission failures may still stop them.

**Correction:** fail if the endpoint cannot be secured, enforce a single owner, authenticate/authorize callers according to the actual local transport, and apply the same resource and active-work rules to IPC as to UI actions. Loopback is not an identity check. Disable routes with no supported product purpose.

**Acceptance:** another local user cannot invoke a mutation through the Windows endpoint; a Unix permission failure prevents serving commands; removing an action from the product also removes or explicitly disables its backend routes.

### P0 — caller input is converted into defaults for actions

**Evidence:** the SSH route defaults missing strings to empty and casts any `u64` port to `u16`, allowing wraparound ([socket_server.rs:172](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:172)). Tunnel toggle defaults a missing/invalid `enable` to true ([196](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:196)). Reboot dispatches immediately with local OS syntax ([159](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:159)).

**Correction:** validate a typed action request before execution. Reject absent/invalid targets, unsupported ports and missing intended state; validate SSH destination and identity references. Do not infer permission or intent from a missing field.

**Acceptance:** malformed requests cause no mutation. Every accepted action names the affected host/resource and reports the command's actual outcome.

### P1 — one slow client can block the command server

**Evidence:** both listener loops read one unbounded line and execute its command before accepting another connection ([socket_server.rs:42](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:42), [73](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:73)). There is no read deadline, message-size limit or bounded per-client execution. Response write errors disappear. LLM dispatch can hold the same handler while its subprocess runs.

**Correction:** bound request size, read/write time and execution time; prevent one connection from holding all service access. Preserve command result/error and a request ID. Keep resource mutations serialized even if reads gain concurrency.

**Acceptance:** a client that sends no newline cannot block other status requests indefinitely; an oversized request is rejected; a stalled provider call reaches a deadline without freezing unrelated status.

### P1 — health and response labels promise more than they check

**Evidence:** `status`/`check_daemon_health` always return “healthy and running” ([socket_server.rs:98](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:98)). That only proves this handler replied. Serialization failures in several routes become `{}`/`[]` with `status=ok` ([104](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:104), [125](/Users/sa/scion/omnia-vault/src-tauri/src/socket_server.rs:125)).

**Correction:** call this “Command server responding,” or check and identify the promised dependencies. Return a typed error when serialization fails, not empty valid-looking data.

**Acceptance:** a live listener with a failed SCION/helper/storage dependency cannot report that dependency healthy.

### P0 for privacy — AI calls send prompts to external providers and put secrets in process arguments

**Evidence:** [llm.rs:97](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:97) sends the prompt to OpenRouter; [137](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:137) sends it to OpenAI's HTTPS chat-completions API. The request can carry an API key; otherwise the backend reads its environment. The curl helper places the authorization header and JSON body in command arguments ([182](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:182)). This can expose secrets and prompts through process inspection/diagnostics. No secret value was printed in this review.

**Correction:** retain AI only for a defined user-facing task. Make the provider and payload scope explicit, keep user files/telemetry out unless included by policy, and use protected credential references. Avoid secrets or payloads in process arguments. Removing the AI screen alone does not disable `query_llm` over Tauri or the socket route. These files do not prove that the external HTTPS request travels through SCION.

**Acceptance:** provider requests contain only the selected input; process listings and error reports contain neither test credentials nor test prompt bodies; disabled AI cannot be invoked through either interface.

### P1 — simulated model replies are returned as successful integrations

**Evidence:** absent API keys produce fabricated replies with `status=ok` ([llm.rs:85](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:85), [126](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:126)). The Trae branch just formats a string claiming Active ([160](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:160)); it does not contact or inspect an agent. Provider lists are literals; Trae is always configured and other configuration checks test only environment-variable presence ([33](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:33)). The “codex” route is an OpenAI API call, not evidence of integration with the installed Codex app.

**Correction:** use Not configured, Unsupported or explicitly marked Demo. Separate credential presence from a verified provider response. Hide fabricated integration controls from normal operation.

**Acceptance:** missing credentials never produce a successful model answer; no Trae process produces no Active claim; provider/model availability is not inferred from a static list.

### P1 — the AI HTTP wrapper is unbounded and accepts unexpected replies

**Evidence:** the async function runs blocking `curl.output()` with no connect/total deadline or output-size bound ([llm.rs:182](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:182)). It checks process exit, not HTTP status. Unexpected JSON becomes a successful raw body ([215](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:215)); parse errors include the full response body ([201](/Users/sa/scion/omnia-vault/src-tauri/src/llm.rs:201)).

**Correction:** handle HTTP status and the expected response schema, bound time and size, and redact error details. A received body is not automatically an assistant answer.

**Acceptance:** timeout, 401/429/5xx, oversized output and unexpected JSON have distinct bounded failures; no full private response is echoed into a generic error.

### P1 — Rheknel is a text classifier, not an authorization boundary

**Evidence:** [rheknel.rs:48](/Users/sa/scion/omnia-vault/src-tauri/src/rheknel.rs:48) checks a few substrings. Everything else becomes an authorized diagnostic ([77](/Users/sa/scion/omnia-vault/src-tauri/src/rheknel.rs:77)). Harmless formatting text can trigger “format”; an unlisted mutation phrase can pass. The proposal ID contains only four hash bytes ([44](/Users/sa/scion/omnia-vault/src-tauri/src/rheknel.rs:44)). This module executes nothing, and direct mutation routes do not consult it.

**Correction:** label the result as a text classification, or remove the review widget if it has no real workflow. Do not display “authorized” as permission to execute. Actual permission belongs to the typed action and its policy check. Use collision-resistant IDs if proposals are stored or referenced.

**Acceptance:** a passed text check cannot grant cleanup/reboot/routing authority, and direct actions cannot bypass their policy. Do not claim a complete security gate from two keyword tests.

## Socket command inventory: 13 handlers, 15 accepted names

| Route / line | Actual effect |
|---|---|
| `status`, `check_daemon_health` :98 | Constant health message. |
| `get_metrics`, `get_system_metrics` :104 | Local metrics collection. |
| `quick_clean` :112 | Local deletion through the previously reviewed cleaner. |
| `flip_backbone` :118 | Returns a text-only claimed flip; no route change. |
| `get_llm_providers` :125 | Static provider list/config flags. |
| `query_llm` :133 | External HTTPS call or simulated response. |
| `prepare_and_reboot` :159 | Local shutdown command; not a remote helper reboot. |
| `stop_ssh_tunnel` :166 | Kill tracked SSH child. |
| `start_ssh_tunnel` :172 | Spawn reverse SSH forwarding. |
| `get_tunnel_status` :182 | Local launch-agent/TCP check. |
| `restart_tunnel` :187 | Local launchctl action. |
| `toggle_tunnel` :196 | Local launchctl start/stop. |
| `restart_ndi` :206 | Save JSON, then falsely claim stream restart. |

These routes are active runtime code when the server binds successfully. `query_llm`, `get_llm_providers` and `evaluate_proposal` are also registered through Tauri as documented in the first review. There is no socket route for `evaluate_proposal` here. Keep necessary technical credits in About/Licenses; they neither justify an unused control nor prove a live integration.
