# Networking contract for technical refinement

Status: proposed requirements, 12 September 2026. This is a fresh contract. Earlier macOS code, panes, controls and successful tests are not the implementation baseline. No running setting or service is changed by this document. Requirements below use ordinary product language; identifiers are proposed references for the LIT-001 evidence chain, not claims that an API already exists.

## 1. Deployment roles and unchanged upstream behavior

**NET-01 — Two deployment profiles.** The current lab profile has a primary Mac and a Windows helper. The Mac owns the user's application work and approved connection policy. Windows supplies only the explicitly listed lab services, such as the GNS3 compute or SCION processes running in WSL. The lab must state exactly which traffic stops if Windows, WSL, its link, or a helper service becomes unavailable.

The target profile remains a **self-contained, single-host Mac deployment**. It must not quietly require the Windows helper, its filesystem, an SSH tunnel, or a Windows-only controller. List every required local service and show how the selected upstream version runs it on the target host. Platform support is a gate to prove, not an assumption. Normal remote peers needed for a particular network service are listed separately; this requirement does not invent a new external gateway service or promise offline Internet access. A topology contained on one host can prove local mechanics but cannot prove cross-host or Internet operation.

**NET-02 — Keep SCION and GNS3 semantics.** SCION supplies inter-domain path control, failure isolation and explicit routing trust; payload encryption and user identity remain separate responsibilities. Its common underlay uses UDP/IP and standard host sockets. Windows/WSL routing, NAT, interface and firewall rules therefore remain relevant. GNS3 manages a lab's controller, computes, nodes and virtual links; it is not an application traffic router merely because its controller responds. No kernel bypass, new L2 transport, packet blending or custom routing protocol is part of this refinement. [SCION scope](https://docs.scion.org/en/v0.15.1/overview.html), [SCION underlay](https://docs.scion.org/en/latest/protocols/underlay.html), [GNS3 architecture](https://docs.gns3.com/docs/using-gns3/design/architecture), [Microsoft WSL networking](https://learn.microsoft.com/en-us/windows/wsl/networking).

The deployment record must pin SCION, scion-apps, GNS3 and relevant runtime versions, configuration revisions, node roles and the applicable upstream documentation. The v0.15.1 references here explain reviewed upstream behavior; they do not select or certify the next installation.

## 2. What a route claim means

**NET-03 — Keep five observations separate.**

| Observation | What it proves | What it cannot prove |
| --- | --- | --- |
| Process or local port responds | That named local service was observable at that time | A usable SCION path or a model connection |
| SCION path is discovered or probed | A path was returned, or the named probe succeeded | Origin TLS, application traffic, or several paths carrying data |
| Proxy choice is configured | A particular client setting selected a proxy under a stated rule | Every app uses that setting, or the proxy used SCION |
| Strict SCION connection and origin TLS succeed | A new connection reached that exact target over the recorded SCION segment and passed origin identity verification | Authentication, model streaming, existing session migration, or VPN independence |
| Correlated application operation succeeds | That application operation used the observed route and completed its stated check | Other apps, endpoints, future availability or absence of shared failure dependencies |

The selected path, proxy, app connection and origin are distinct objects. A normal Internet domain needs an explicit native SCION endpoint or an appropriate gateway/egress arrangement. Stock SIG tunnels IP between peers and requires ordinary IP routing into it; it does not turn any domain into a native SCION host. A PAC file selects proxies for participating clients. Chrome's HTTPS PAC evaluation strips path/query information; host rules are different from page rules. [SIG deployment](https://docs.scion.org/en/v0.15.1/manuals/gateway.html#basic-sig-pair), [Chrome proxy behavior](https://chromium.googlesource.com/chromium/src/+/HEAD/net/docs/proxy.md).

Every observed connection records both `transport = SCION | ordinary_IP | unknown` and `underlay_VPN = used | not_used | unknown`, plus the evidence source. SCION may itself travel over a VPN underlay. A proxy bypass of SCION is not proof that the connection bypassed the VPN.

## 3. Priority applies only where there is a working adapter

**NET-04 — A priority has an exact scope:** application and process role, destination set, selected adapter, and the unit it can control: a new connection, request, or stream. A supported adapter must have a documented setting/API, readback or equivalent effective-state observation, and a demonstrated scope. An app restart or a language-server restart is not a live priority change.

| Requested preference | Required behavior for eligible new work |
| --- | --- |
| Keep current | Leave current routing and connection selection unchanged |
| Prefer SCION | Use the verified SCION candidate for this scope; otherwise use only the separately approved and verified fallback |
| Prefer VPN | Use the verified VPN route for this scope; a SCION alternative is allowed only if the policy explicitly permits it |

Selecting a preference does not disable the VPN. Unsupported adapters return `unsupported` and leave the current route in place. Do not display a global applied state when only a browser, subprocess, domain, or connection pool is covered. The strict diagnostic mode allows no ordinary-IP fallback; it is a test mode, not a hidden change to application policy.

**NET-05 — A new request can reuse an old connection.** Request-level priority is offered only when the adapter can assign new requests to a separate connection/pool without interrupting old work. Otherwise the promise is explicitly limited to new connections. In Electron, changing proxy settings can leave pooled sockets reusable, while closing all connections fails in-flight requests. Neither operation establishes a safe generic migration control for a third-party app. [Electron proxy and connection methods](https://www.electronjs.org/docs/latest/api/session#sessetproxyconfig).

## 4. Continuity, preparation and fallback

**NET-06 — Existing work keeps its existing transport unless a specific transport capability has been proved.** Ordinary TCP connection state is tied to its endpoints; a connection to one proxy is not retargeted to another by editing a preference. QUIC supports specified connection migration procedures, but those require endpoint support and path validation and can be restricted by the peer. Changing the outer SCION path, changing the proxy/gateway endpoint and restarting an application are different events. None alone proves that the inner model stream survives. [TCP specification](https://www.rfc-editor.org/rfc/rfc9293.html), [QUIC migration](https://www.rfc-editor.org/rfc/rfc9000.html#section-9).

**NET-07 — Prepare the replacement before sending new work to it.**

1. Record the current effective configuration, owned connections and fallback dependencies. If connection ownership is unavailable, do not claim those connections are safely drained.
2. Prepare the candidate through the supported adapter without stopping the current service, VPN, app or helper. Verify the target, route, TLS and required application protocol at the appropriate gates below.
3. Apply the new policy revision only to the declared scope. Read back effective state. A successful settings call alone is not proof of observed traffic.
4. Send eligible new work to the candidate. During the planned change, do not close existing connections; stop assigning them new work only when the adapter can do so without interruption. External path loss can still interrupt old work and invokes the agreed failure policy.
5. Keep the old connection and any services it needs until its work completes. A drain timeout reports `still draining`; it does not authorize killing the connection. Retirement is a separate operation.
6. If the candidate fails, stop assigning new work to it. Use only the previously verified fallback. Existing requests with uncertain remote outcomes are not automatically resubmitted.

These are product requirements around stock components, not advertised stock SCION or GNS3 features. If an upstream component cannot reload a required setting, record that limitation. A gateway restart is still disruptive to its connections even when no router or VPN is restarted.

**NET-08 — Fallback independence is measured for a named failure.** Record shared dependencies: local adapter, proxy process, Windows helper, DNS, router, uplink, credentials and remote gateway. The fallback must remain usable when the specific component it covers fails. Two paths through the same failed proxy are not independent fallback. Shared WAN or power dependencies must be disclosed. Tests involving intentional outages belong to a separately authorized maintenance/test scope; active model sessions are not test victims.

**NET-09 — No duplicated paid or mutating operation.** Route selection may retry connection establishment only before application work has been dispatched and only under the stated fallback policy. It must not race or replay model generation, writes, tool actions or other paid/mutating operations over two paths. A timeout after dispatch becomes `outcome unknown` until the application can reconcile it. A local operation ID is not a provider idempotency guarantee. Resume or retry is permitted only through a provider-documented mechanism whose coverage and outcome checks have been validated. [HTTP retry semantics](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2).

## 5. State and ownership contract

**NET-10 — State is per scope; no single ON flag replaces these dimensions.**

| Dimension | Allowed states and meaning |
| --- | --- |
| Capability | `unknown`, `supported`, `unsupported`: ability of the named adapter, not route health |
| Evidence | `unchecked`, `checking`, `transport_verified`, `application_verified`, `failed`, `inconclusive`, `stale`: the last scoped check and its age; blocked measurement is inconclusive, not a proved target failure |
| Policy application | `unchanged`, `prepared`, `applied_to_new_work`, `draining_old_work`, `rejected`, `outcome_unknown`, `rolled_back`: observed progress of this revision |
| Work | `opening`, `active`, `draining`, `completed`, `failed`, `outcome_unknown`: connection/request state owned by its actual client |

Evidence includes check ID, scope, target, process/adapter identity, version and configuration revision, start/end times, timeout, transport, fallback occurrence, result/error stage and expiry rule. A path identity and source/destination AS are included when available. Probe, connect, TLS and application latency must have separate names and units. Missing data stays unknown; an old success becomes stale after its declared lifetime or a relevant configuration/dependency change.

**NET-11 — One owner changes a given scope.** The Mac coordinator owns accepted policy revisions; each host adapter owns changes to its local resources; the app owns request outcomes; the observer owns measurements. Two writers cannot silently replace the same effective policy. Each change has an expected prior revision, an operation ID and a readback result. Reject a stale revision. On a crash or ambiguous acknowledgement, reconcile actual state before another apply or rollback; never replay a network command merely because its receipt is missing.

The LIT-001 chain links: **requirement → accepted specification/policy revision → scoped operation → adapter result → observed evidence → acceptance decision**. Use existing LIT identities and revision rules once the chain contract is agreed. Do not invent a second receipt format here. A committed record proves that evidence was recorded, not that a packet arrived or a remote operation completed. Secrets, authentication headers, prompts and model content are outside the network evidence record; use protected references where needed.

## 6. Proof gates before a scope is called ready

**NET-12 — Each gate needs an evidence reference; gates cannot be inferred from a button label.**

| Gate | Required proof |
| --- | --- |
| N0: deployment | Selected LAB or STANDALONE_MAC profile, component/version/configuration inventory, ownership, declared dependencies and platform support |
| N1: stock mechanics | Reference SCION endpoint traffic works with the selected upstream tools; GNS3 node/link IDs are correlated only if that traffic actually crosses them |
| N2: target transport | Bounded strict SCION check to each selected target/gateway, recorded path where available, no hidden TCP or proxy fallback, verified origin TLS |
| N3: app adapter | The actual installed app/network subprocess reads the chosen setting; exact endpoint and auxiliary-domain coverage are identified; pooling/restart behavior is established |
| N4: application protocol | An authorized ordinary app operation demonstrates its real HTTPS/WebSocket/stream protocol, correct origin identity, sustained delivery for the agreed test duration and an unambiguous end state; no extra billable test is sent implicitly |
| N5: priority | A policy change sends an eligible new operation/connection over the requested route, supported by correlated client and route evidence; old sessions remain on their observed routes |
| N6: drain and fallback | Controlled tests show the old work completes, failed candidates stop receiving new work, approved fallback survives the named failure, and ambiguous operations are not duplicated |
| N7: standalone | The agreed single-host workload works without a Windows helper dependency. Until proved, the successful lab result is labelled LAB only |

`scion showpaths` distinguishes discovered paths from its reachability probes; neither is N4 application proof. [showpaths](https://docs.scion.org/en/latest/command/scion/scion_showpaths.html).

For Codex, the current official network guide identifies `wss://chatgpt.com/` for sampling/streaming. A TLS check to `api.openai.com` alone is not sufficient. For Antigravity, establish the actual installed/configured model endpoint from the new inventory and supported sources; do not substitute a generic Gemini API hostname. Record all required authentication, model, update and asset endpoints by function, but keep readiness scoped to the tested workflow. [OpenAI network requirements](https://help.openai.com/en/articles/9247338-network-recommendations-for-chatgpt-errors-on-web-and-apps).

## 7. Safety invariants and historical notes

**NET-13 — Invariants.** Preparing or checking a candidate never implicitly disables the VPN, restarts an app/helper, changes the firewall or closes existing connections. A policy request is distinct from its effective readback and from observed traffic. Strict checks never succeed through fallback. A transport test never upgrades another target or app to ready. Controller loss does not authorize stopping owned data paths. Losing the primary app host cannot be described as preserving its live in-memory model session; recovery/resumption needs a separate application contract.

**NET-14 — Unproved assumptions remain explicit.** No universal VPN replacement; no automatic payload encryption from SCION; no all-app PAC coverage; no additive bandwidth from a list of paths; no automatic proxy-to-proxy session migration; no zero-interruption gateway restart; no independent fallback without a dependency test; no production readiness from a one-host test topology. The SIG documentation describes flow distribution and a default path count of one, and notes limits on configurable/implemented policy features. [SIG policies](https://docs.scion.org/en/v0.15.1/manuals/gateway.html#nomenclature).

Historical diagnostic notes only: the user reported successful HTTP 200/301 results for selected web targets. A later strict TLS probe reached one selected web target over a recorded SCION path. Some later attempts were blocked by the tool sandbox, while separate native executions reported gateway errors. Earlier app inspection identified particular default/configured model endpoints and limitations in live proxy control. These remain evidence for those timestamps and configurations; they neither prove nor disprove the new deployment's readiness. They must not populate its gates automatically.
