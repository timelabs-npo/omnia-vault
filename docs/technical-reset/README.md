# Technical reset

12 September 2026. **Technical refinement only. All current macOS panels are discarded prototypes.**

The immediate objective is a connection system the user can understand and control without losing ongoing work. A new layout is not the next milestone. The next milestone is a coherent contract, an admitted verification method, and evidence for the actual applications.

## Current decisions

- Keep the current VPN and active model connections intact during refinement.
- Use stock SCION and GNS3 behavior. Name every application adapter, gateway, host dependency and required privilege explicitly.
- Give priority a precise scope. A preference, an applied setting and the route carrying a request are different facts.
- Prepare an alternative before assigning new work. During a planned change, do not close existing connections. An external path failure can still interrupt them; a timed-out operation is not silently replayed.
- Use the actual LIT-001 contract for chained verification. Engine selection is blocked by the conformance findings in [LIT_GATE.md](LIT_GATE.md). No valid LIT publication is claimed in this package.
- Use plain, common English in the product. Timelabs is the vendor only, confined to About or legal information.
- Any main work window must move, resize and minimize normally and support keyboard use. A fixed popup cannot be the workspace. Logs belong in details, not in the main view.

## Read in this order

1. [Technical contract](TECHNICAL_CONTRACT.md): ownership, decisions, change behavior and the implementation boundary.
2. [LIT-001 admission gate](LIT_GATE.md): original contract, incompatible implementations and the required verification chain.
3. [Network contract](NETWORK_CONTRACT.md): 14 precise network requirements and eight proof gates.
4. [Requirements register](REQUIREMENTS.md): all accepted network, window, provider, sync, archive and maintenance outcomes.
5. [Verification status](VERIFICATION_STATUS.json): explicit blocked, pending and unexecuted states.
6. [Delivery and limits](DELIVERY.md): installed prototypes, project handoff, playbook update and check results.

## What has been stopped

The development app and its watcher were stopped. A separate installed prototype app was also closed. Both installed prototype app bundles, the preference pane, its pending replacement bundle and the prototype tray login item were moved to a private recovery archive. The tray login job was unloaded. The final process check found no running prototype app. Source files remain available for audit; they are not the starting point for another pane patch.

Antigravity acknowledged the instruction to stop implementation, preserve the prototypes, avoid relaunching them and wait for this contract. No VPN, SCION router, gateway, WSL service or model application was stopped by the reset.

## Status of this package

This is a reviewable draft, not an approved implementation specification or a release certificate. The network contract proposes the required behavior; it does not claim that an adapter or controller exists. The full requested beta still includes all previously selected storage providers. Prior tests remain historical evidence for their exact configuration and time; they do not fill the new acceptance gates automatically.

`SHA256SUMS` identifies the document bytes. It is an ordinary file manifest, **not a LIT receipt, signature, proof of truth or substitute for the blocked LIT chain**.
