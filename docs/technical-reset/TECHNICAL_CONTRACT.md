# Technical contract for review

Status: proposed. Implementation remains stopped. See [the requirements register](REQUIREMENTS.md) for accepted scope and [the network contract](NETWORK_CONTRACT.md) for detailed network rules.

## 1. The useful outcome

For each selected application, the system must answer four questions:

1. What connection carries my work now?
2. Has the alternative passed a check for this application's real workflow?
3. Exactly which new work will a priority change affect?
4. What happens if that path fails, and what remains on the old path?

Every proposed function must identify its user task, input, resource owner, actual command or API, precondition, observable result, deadline and recovery behavior. Remove a function from the design if these cannot be stated. A status card cannot compensate for a missing capability.

## 2. Workload and release scope

Codex and Antigravity are the first network workflows to specify because protecting ongoing model work is the current concern. A normal authenticated model operation, including its stream and completion state, defines application success. A public HTTP response, a TLS handshake or a running daemon does not define that success. No additional paid generation is authorized merely to collect a test result.

The present lab uses a primary Mac and a Windows/WSL helper. Its Windows dependency must be explicit. The proposed independent target runs the required local components on the Mac without an undeclared Windows dependency. Remote Internet peers remain normal dependencies. A lab milestone and a standalone milestone are separate results.

The complete beta scope has not been reduced to networking. iCloud Drive, Google Drive, OneDrive, S3/MinIO, Mac folders, Windows folders and NAS remain requested. Folder sync keeps conflicting versions. The archive covers user files with configurable exclusions and uses the user's existing storage/key scheme by default. These requirements need their own technical and acceptance work; they cannot be checked off because the connection layer works.

## 3. Ownership before architecture

These are responsibilities to assign, not a prescription for new daemons.

| Responsibility | Required owner and boundary |
| --- | --- |
| Application request and result | The application or its supported adapter owns dispatch, response, completion and uncertain outcomes. The network controller does not invent request success. |
| Connection preference | One coordinator owns a versioned preference for a named app/process, destination set and adapter. Concurrent writers use an expected prior revision. |
| Local change | The supported host adapter owns the exact OS/client setting and reads it back. It reports privilege and restart requirements before applying. |
| SCION routing | Stock SCION components own SCION paths and packet forwarding. Their scope is not expanded into universal app control by a UI label. |
| GNS3 lab | GNS3 owns the declared lab nodes, links and compute lifecycle. A management connection is not evidence of traffic crossing the lab. |
| Evidence | The observer records a bounded check with target, source, version, configuration and time. A blocked measurement remains inconclusive. |
| Verification record | An admitted LIT implementation records and retrieves exact accepted bytes under the pinned contract. A record is not packet-delivery evidence by itself. |

No component owns all of these merely because it is reachable on a local port. No zero-IPC, kernel-bypass or universal VPN-replacement claim is accepted without a precise meaning and corresponding evidence.

## 4. Priority is a change to eligible new work

The proposed choices are **Keep current**, **Prefer SCION**, and **Prefer VPN**. Each choice belongs to an explicit application scope. It is not a global ON flag and does not turn off the VPN.

The adapter must first prove whether it controls new connections, new requests, or both. A new request can reuse an old connection. An adapter that applies only when a process starts cannot claim a live switch. Unsupported control keeps the current route and reports the missing capability.

The coordinator records the intended revision and prepares the candidate. It checks the real targets, supported application protocol and fallback dependencies. It applies only the approved scope, reads back effective state, and correlates eligible new traffic with the selected route. During a planned policy change, the coordinator must not close existing connections. External path loss can still interrupt them and is handled by the agreed failure policy. A drain deadline reports unfinished work; it does not permit killing it.

Fallback is allowed only under the explicit policy and after its dependencies have been checked for the named failure. It must not depend on the failed component it is meant to cover. Changing a proxy preference does not prove that SCION avoids the VPN underlay; those observations are recorded separately.

## 5. Failure rules

- A check or preparation step must not disable the VPN, restart an application or shared helper, change firewall policy or close active connections.
- A failed candidate stops receiving new work. A failed or uncertain application operation is not automatically sent again over another path.
- Retry before dispatch is different from replay after dispatch. Local operation IDs do not create provider idempotency guarantees.
- An apply timeout means its outcome may be unknown. Read back and reconcile the actual state before another change.
- If the coordinator disappears, existing data paths remain independent of the UI process. Recovery first inspects actual state; it does not re-run startup commands blindly.
- If recording the result fails after an OS change, the change may still have happened. LIT and the OS are not one atomic transaction. Block further changes to that scope, preserve existing work and reconcile the durable intent with OS/client and traffic evidence.
- A rollback changes the assignment of eligible new work. It does not claim to rewind remote requests, move an established socket or restore an in-memory model session.

## 6. Evidence required for a future control

Each evidence record must bind the requirement, chosen contract version, operation ID, expected policy revision, requested scope, adapter identity, input/configuration digest, result stage, observation source, start/end time, deadline, route evidence and final observed outcome. A separate later acceptance record references the immutable evidence; an evidence record does not include its own later acceptance. Secrets, prompts, response bodies and authentication headers are excluded from general diagnostics.

There are separate states for capability, evidence freshness, policy application and request outcome. A returned command, a saved setting and a successful real operation must not share one success flag. Relevant configuration or dependency changes invalidate earlier readiness evidence.

Before the next implementation begins, select the actual adapter for each application and prove its supported setting, pooling behavior, restart requirements and route observation. Compare a proxy-aware application path with any proposed IP-level route only against the required workload and actual platform support. Do not silently choose a new tunnel or network extension to make a diagram complete.

## 7. Concrete acceptance work

| Gate | Exit condition | Current status |
| --- | --- | --- |
| R0: scope | Accepted requirements, terminology, deployment profiles and open decisions are recorded without inheriting prototype claims. | Draft prepared; review pending |
| R1: LIT contract | Original bytes, profile and acceptance rules are pinned; an implementation passes independent conformance checks. | Blocked: both inspected engines differ from the recovered candidate |
| R2: app adapters | Each real application has a proved control surface and supported change scope. | Not executed for the new baseline |
| R3: network design | Stock components, host dependencies, target coverage, DNS, TLS, routing and fallback ownership form one consistent deployment contract. | Draft prepared; unresolved items remain |
| R4: test contract | Workload, stream duration, failure matrix, interruption limits and resource/cost budgets are fixed and testable. | Pending |
| R5: macOS/product implementation admission | R0–R4 accepted; one implementation owner and exact revision identified; no live model work used as a fault test. | Unlocked |

LIT contract review, oracle work and engine qualification follow their own prerequisite gates; they are not blocked by the macOS/product implementation gate. No new product UI or network adapter is authorized by verification-tool work.

For R4, include candidate failure before dispatch, loss after dispatch, an old pooled connection, helper failure, stale configuration, blocked observation, incomplete readback, coordinator crash, missing receipt and recovery. Check zero unintended duplicate model operations and zero silent state loss. Quantitative availability or latency promises require agreed measurements; the phrase “no failures” is not a test contract.

## 8. Window and naming constraints

The main work surface must be a normal movable, resizable, minimizable window with keyboard navigation and readable content. A tray popup, if retained, is a compact entry point and status view. The real System Settings integration, if supported by the selected macOS version, is native configuration only. It must not be imitated by a locked desktop popup.

Use task names in navigation and ordinary English in actions. Timelabs appears only as vendor information in About or legal text. Protocol names such as SCION and NDI can remain where they help identify a real function. NDI is a reference toolkit in this scope, not an implemented media feature. No layouts or mockups are admitted during this refinement phase.
