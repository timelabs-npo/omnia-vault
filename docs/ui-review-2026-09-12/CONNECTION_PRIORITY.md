# Connection priority handoff

Status: 12 September 2026. **Keep the VPN connected. Connection priority is not implemented yet.**

## Current evidence

The recorded model check shows existing Codex and Antigravity TCP connections using the VPN. The system PAC, HTTP proxy, and SOCKS proxy are off. A local SCION proxy responds, but its direct fallback means a successful proxy request alone would not prove SCION use.

| Strict test | Observed result |
| --- | --- |
| `youtube.com` | One verified TLS connection completed in about 5.4 seconds. A later test reached its 10-second deadline. Reliable availability is not established. |
| `chatgpt.com` | Failed: the SCION gateway returned “bad gateway” during origin TLS verification. |
| `daily-cloudcode-pa.googleapis.com` | Failed: the SCION gateway returned “bad gateway” during origin TLS verification. |

Evidence: the recorded `model-check-result.json` and earlier `strict-youtube-result.json`. These are snapshots, not continuous monitoring. The tests open fresh SCION connections and verify the destination's TLS certificate. They send no HTTP request, login, prompt, or model API operation. They do not cover every hostname used by either application or transfer existing sessions. Gateway identity is not authenticated by the outer QUIC TLS layer in the current probe; origin TLS verification is separate.

The native pane update is prepared. **Rendering and runtime verification are pending.** Do not count installation, usability, or the connection-priority control as verified.

## What priority must mean

The macOS service-order control cannot place a VPN below ordinary network services. This needs application connection selection, not a service-order change. [Apple's service-order documentation](https://support.apple.com/en-lamr/guide/mac-help/mchlp2711/mac)

For a supported application, prefer a verified SCION path when opening a **new connection** for a new request. Preserve all existing TCP streams on their current transport until they finish naturally. A new request that reuses an existing connection still uses that connection's transport.

If SCION cannot establish the new connection, a separately verified VPN path may be selected. It must work independently of the SCION selector; a fallback that loops through the same broken proxy is not a fallback. Do not report ordinary TCP or VPN fallback as SCION success.

Failover does not authorize replay of a model request. If application bytes may already have been sent, do not automatically resend a POST or restart a stream. Report the interruption unless the application has an explicit safe retry or deduplication contract.

## Next actions

1. **Prepare a second gateway instance.** The current gateway's allowed destinations are fixed at startup by its allowlist. Use the known source/configuration to prepare a separate instance with the required hosts, then prove strict origin TLS access there. Do not kill the working gateway to discover whether the replacement works. Direct only new test connections to the replacement; let the old instance drain before retirement.
2. **Prove each application hook.** Antigravity reads `http.proxy` when its language server starts. Changing it does not move the running language server's connections. Test the next separate or naturally started instance; preserve the active one. Codex's usable proxy hook is still unproven. Do not claim coverage for Codex until its real traffic is observed using the selected path.
3. **Prove selection and failure behavior.** For each supported application, record a fresh successful SCION connection, a fresh successful VPN fallback, and a controlled SCION failure that cannot produce a false SCION success. Check the application's actual destinations and DNS behavior; a reference hostname is not complete application coverage. Start with a disposable request that sends no private content.
4. **Keep rollback local to new connections.** Revert the selection policy to the last verified VPN path for future connections. Keep both transport instances available while existing streams drain. Do not restart the VPN, network services, current gateway, or active model sessions as rollback.
5. **Finish the pane check.** Verify rendering, responsive actions, fresh timestamps, timeout states, and the difference between a TLS test result and actual application use. Until then, show the priority feature as unavailable or not configured.

Completion requires observed application traffic on the intended path, a verified independent fallback, and preserved existing streams during the test. The current results do not meet that gate.
